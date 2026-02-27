import CalendarioModel from '../models/Calendario.js';
import { query } from '../database/config-db.js';
import { sendBulkEmail, canSendEmails } from '../services/emailService.js';

async function getAllowedTallerIdsForUser(user) {
    if (!user || user.tipo_usuario === 'admin') {
        return null;
    }

    if (user.tipo_usuario === 'instructor') {
        const result = await query(
            `SELECT t.id
             FROM talleres t
             INNER JOIN perfiles_instructor pi ON t.instructor_id = pi.id
             WHERE pi.usuario_id = $1`,
            [user.id]
        );
        return result.rows.map(row => row.id);
    }

    if (user.tipo_usuario === 'alumno') {
        const result = await query(
            `SELECT DISTINCT i.taller_id AS id
             FROM inscripciones i
             INNER JOIN perfiles_alumno pa ON i.alumno_id = pa.id
             WHERE pa.usuario_id = $1
               AND i.estado = 'activa'`,
            [user.id]
        );
        return result.rows.map(row => row.id);
    }

    return [];
}

function userCanAccessTaller(allowedTallerIds, tallerId) {
    if (allowedTallerIds === null) return true;
    return allowedTallerIds.includes(tallerId);
}

/**
 * Controlador de calendario
 * 
 * Fundamentos:
 * - Gestiona fechas importantes y eventos de talleres
 * - Control de acceso por instructor y taller
 * - Vistas de calendario mensual y semanal
 * - Eventos próximos y notificaciones
 */

class CalendarioController {
    static escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    static async getEmailsAlumnosInscritos(tallerId) {
        const result = await query(
            `SELECT DISTINCT u.email
             FROM inscripciones i
             INNER JOIN perfiles_alumno pa ON i.alumno_id = pa.id
             INNER JOIN usuarios u ON pa.usuario_id = u.id
             WHERE i.taller_id = $1
               AND i.estado = 'activa'
               AND u.activo = true
               AND u.email IS NOT NULL`,
            [tallerId]
        );

        return result.rows.map(row => row.email).filter(Boolean);
    }

    static async getNombreTaller(tallerId) {
        const result = await query('SELECT nombre FROM talleres WHERE id = $1 LIMIT 1', [tallerId]);
        return result.rows[0]?.nombre || 'Taller';
    }

    static async notificarRecordatorioPorCorreo({ tallerId, titulo, descripcion, fechaEvento, tipoEvento }) {
        try {
            if (!canSendEmails()) {
                return { sent: false, reason: 'EMAIL_DISABLED_OR_NOT_CONFIGURED' };
            }

            const [correos, nombreTaller] = await Promise.all([
                CalendarioController.getEmailsAlumnosInscritos(tallerId),
                CalendarioController.getNombreTaller(tallerId)
            ]);

            if (!correos.length) {
                return { sent: false, reason: 'NO_RECIPIENTS' };
            }

            const fechaFormateada = new Date(fechaEvento).toLocaleString('es-MX', {
                dateStyle: 'full',
                timeStyle: 'short'
            });

            const safeTitulo = CalendarioController.escapeHtml(titulo);
            const safeDescripcion = CalendarioController.escapeHtml(descripcion || '').replace(/\n/g, '<br>');
            const safeTipo = CalendarioController.escapeHtml(tipoEvento || 'evento');
            const subject = `[CBTIS 258] Recordatorio: ${titulo}`;
            const text = `Taller: ${nombreTaller}\nEvento: ${titulo}\nTipo: ${tipoEvento || 'evento'}\nFecha: ${fechaFormateada}${descripcion ? `\n\nDescripción: ${descripcion}` : ''}`;
            const html = `
                <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
                    <h2 style="margin-bottom: 8px;">Nuevo recordatorio del taller ${CalendarioController.escapeHtml(nombreTaller)}</h2>
                    <p style="margin: 0 0 8px 0;"><strong>Evento:</strong> ${safeTitulo}</p>
                    <p style="margin: 0 0 8px 0;"><strong>Tipo:</strong> ${safeTipo}</p>
                    <p style="margin: 0 0 12px 0;"><strong>Fecha:</strong> ${CalendarioController.escapeHtml(fechaFormateada)}</p>
                    ${descripcion ? `<div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:12px;">${safeDescripcion}</div>` : ''}
                    <p style="margin-top: 14px; color: #6b7280;">Este mensaje fue enviado automáticamente por el sistema de talleres CBTIS 258.</p>
                </div>
            `;

            return await sendBulkEmail({
                recipients: correos,
                subject,
                text,
                html
            });
        } catch (error) {
            console.error('⚠️ Error al enviar recordatorio por correo:', error.message);
            return { sent: false, reason: 'SEND_ERROR' };
        }
    }

    /**
     * Obtener fechas importantes de un taller
     */
    static async getFechasByTaller(req, res) {
        try {
            const { tallerId } = req.params;
            const { 
                fechaInicio, 
                fechaFin, 
                tipoEvento,
                limit = 50, 
                offset = 0 
            } = req.query;

            const options = {
                fechaInicio: fechaInicio || null,
                fechaFin: fechaFin || null,
                tipoEvento: tipoEvento || null,
                limit: parseInt(limit),
                offset: parseInt(offset)
            };

            const allowedTallerIds = await getAllowedTallerIdsForUser(req.user);
            if (!userCanAccessTaller(allowedTallerIds, tallerId)) {
                return res.status(403).json({
                    error: 'Acceso denegado',
                    message: 'No tienes permisos para ver el calendario de este taller'
                });
            }

            const fechas = await CalendarioModel.findByTaller(tallerId, options);

            res.json({
                message: 'Fechas importantes obtenidas exitosamente',
                data: fechas,
                pagination: {
                    limit: options.limit,
                    offset: options.offset,
                    total: fechas.length
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener fechas por taller:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener las fechas del taller'
            });
        }
    }

    /**
     * Obtener fechas importantes del instructor autenticado
     */
    static async getMisFechas(req, res) {
        try {
            // Solo para instructores
            if (req.user.tipo_usuario !== 'instructor') {
                return res.status(403).json({
                    error: 'Acceso denegado',
                    message: 'Esta funcionalidad es solo para instructores'
                });
            }

            const { 
                fechaInicio, 
                fechaFin, 
                activo = 'true',
                limit = 50, 
                offset = 0 
            } = req.query;

            // Obtener perfil de instructor
            const instructorResult = await query(
                'SELECT id FROM perfiles_instructor WHERE usuario_id = $1',
                [req.user.id]
            );

            if (instructorResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Perfil no encontrado',
                    message: 'No se encontró el perfil de instructor'
                });
            }

            const instructorId = instructorResult.rows[0].id;

            const options = {
                fechaInicio: fechaInicio || null,
                fechaFin: fechaFin || null,
                activo: activo === 'true' ? true : activo === 'false' ? false : null,
                limit: parseInt(limit),
                offset: parseInt(offset)
            };

            const fechas = await CalendarioModel.findByInstructor(instructorId, options);

            res.json({
                message: 'Fechas importantes obtenidas exitosamente',
                data: fechas,
                pagination: {
                    limit: options.limit,
                    offset: options.offset,
                    total: fechas.length
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener fechas del instructor:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener tus fechas importantes'
            });
        }
    }

    /**
     * Obtener eventos próximos para un alumno
     */
    static async getEventosProximosAlumno(req, res) {
        try {
            // Solo para alumnos
            if (req.user.tipo_usuario !== 'alumno') {
                return res.status(403).json({
                    error: 'Acceso denegado',
                    message: 'Esta funcionalidad es solo para alumnos'
                });
            }

            const { dias = 30 } = req.query;

            const eventos = await CalendarioModel.getEventosProximosParaAlumno(
                req.alumno.id, 
                parseInt(dias)
            );

            res.json({
                message: 'Eventos próximos obtenidos exitosamente',
                data: eventos,
                dias: parseInt(dias)
            });

        } catch (error) {
            console.error('❌ Error al obtener eventos próximos para alumno:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener eventos próximos'
            });
        }
    }

    /**
     * Obtener fecha importante por ID
     */
    static async getFechaById(req, res) {
        try {
            const { id } = req.params;

            const fecha = await CalendarioModel.findById(id);

            if (!fecha) {
                return res.status(404).json({
                    error: 'Fecha no encontrada',
                    message: 'No se encontró la fecha importante especificada'
                });
            }

            const allowedTallerIds = await getAllowedTallerIdsForUser(req.user);
            if (!userCanAccessTaller(allowedTallerIds, fecha.taller_id)) {
                return res.status(403).json({
                    error: 'Acceso denegado',
                    message: 'No tienes permisos para ver esta fecha importante'
                });
            }

            // Verificar permisos de acceso
            if (req.user.tipo_usuario === 'instructor') {
                // Verificar que es el instructor de la fecha
                const instructorResult = await query(
                    'SELECT id FROM perfiles_instructor WHERE usuario_id = $1',
                    [req.user.id]
                );

                if (instructorResult.rows.length === 0 || 
                    instructorResult.rows[0].id !== fecha.instructor_id) {
                    return res.status(403).json({
                        error: 'Acceso denegado',
                        message: 'Solo puedes ver tus propias fechas importantes'
                    });
                }
            }

            res.json({
                message: 'Fecha importante obtenida exitosamente',
                data: fecha
            });

        } catch (error) {
            console.error('❌ Error al obtener fecha importante:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener la fecha importante'
            });
        }
    }

    /**
     * Crear nueva fecha importante (instructor)
     */
    static async createFecha(req, res) {
        try {
            // Solo para instructores
            if (req.user.tipo_usuario !== 'instructor') {
                return res.status(403).json({
                    error: 'Acceso denegado',
                    message: 'Solo los instructores pueden crear fechas importantes'
                });
            }

            const { 
                taller_id, 
                titulo, 
                descripcion, 
                fecha_evento, 
                tipo_evento 
            } = req.body;

            // Obtener perfil de instructor
            const instructorResult = await query(
                'SELECT id FROM perfiles_instructor WHERE usuario_id = $1',
                [req.user.id]
            );

            if (instructorResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Perfil no encontrado',
                    message: 'No se encontró el perfil de instructor'
                });
            }

            const instructorId = instructorResult.rows[0].id;

            // Verificar que el instructor está asignado al taller
            const tallerResult = await query(
                'SELECT id FROM talleres WHERE id = $1 AND instructor_id = $2',
                [taller_id, instructorId]
            );

            if (tallerResult.rows.length === 0) {
                return res.status(403).json({
                    error: 'Acceso denegado',
                    message: 'Solo puedes crear fechas importantes en tus talleres asignados'
                });
            }

            const fechaData = {
                taller_id,
                instructor_id: instructorId,
                titulo,
                descripcion: descripcion || null,
                fecha_evento,
                tipo_evento: tipo_evento || 'evento'
            };

            const nuevaFecha = await CalendarioModel.create(fechaData);

            const emailResult = await CalendarioController.notificarRecordatorioPorCorreo({
                tallerId: taller_id,
                titulo,
                descripcion,
                fechaEvento: fecha_evento,
                tipoEvento: tipo_evento || 'evento'
            });

            res.status(201).json({
                message: 'Fecha importante creada exitosamente',
                data: nuevaFecha,
                email: {
                    sent: Boolean(emailResult?.sent),
                    reason: emailResult?.reason || null,
                    recipients: emailResult?.recipients || 0
                }
            });

            console.log(`✅ Fecha importante creada: "${titulo}" por ${req.user.email} en taller ${taller_id}`);
            if (emailResult?.sent) {
                console.log(`📧 Recordatorio enviado por correo a ${emailResult.recipients} alumno(s)`);
            } else {
                console.log(`📭 Recordatorio sin envío de correo: ${emailResult?.reason || 'NO_REASON'}`);
            }

        } catch (error) {
            console.error('❌ Error al crear fecha importante:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al crear la fecha importante'
            });
        }
    }

    /**
     * Actualizar fecha importante (instructor propietario)
     */
    static async updateFecha(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            // Verificar que la fecha existe
            const fechaExistente = await CalendarioModel.findById(id);
            if (!fechaExistente) {
                return res.status(404).json({
                    error: 'Fecha no encontrada',
                    message: 'No se encontró la fecha importante especificada'
                });
            }

            // Solo instructores y admin pueden actualizar
            if (req.user.tipo_usuario === 'instructor') {
                // Verificar que es el instructor de la fecha
                const instructorResult = await query(
                    'SELECT id FROM perfiles_instructor WHERE usuario_id = $1',
                    [req.user.id]
                );

                if (instructorResult.rows.length === 0 || 
                    instructorResult.rows[0].id !== fechaExistente.instructor_id) {
                    return res.status(403).json({
                        error: 'Acceso denegado',
                        message: 'Solo puedes editar tus propias fechas importantes'
                    });
                }
            }

            const fechaActualizada = await CalendarioModel.update(id, updateData);

            if (!fechaActualizada) {
                return res.status(500).json({
                    error: 'Error al actualizar',
                    message: 'No se pudo actualizar la fecha importante'
                });
            }

            const tituloNotificacion = updateData.titulo || fechaExistente.titulo;
            const descripcionNotificacion =
                updateData.descripcion !== undefined
                    ? updateData.descripcion
                    : fechaExistente.descripcion;
            const fechaEventoNotificacion = updateData.fecha_evento || fechaExistente.fecha_evento;
            const tipoEventoNotificacion = updateData.tipo_evento || fechaExistente.tipo_evento || 'evento';

            const emailResult = await CalendarioController.notificarRecordatorioPorCorreo({
                tallerId: fechaExistente.taller_id,
                titulo: tituloNotificacion,
                descripcion: descripcionNotificacion,
                fechaEvento: fechaEventoNotificacion,
                tipoEvento: tipoEventoNotificacion
            });

            res.json({
                message: 'Fecha importante actualizada exitosamente',
                data: fechaActualizada,
                email: {
                    sent: Boolean(emailResult?.sent),
                    reason: emailResult?.reason || null,
                    recipients: emailResult?.recipients || 0
                }
            });

            console.log(`✅ Fecha importante actualizada: ${id} por ${req.user.email}`);
            if (emailResult?.sent) {
                console.log(`📧 Actualización de recordatorio enviada por correo a ${emailResult.recipients} alumno(s)`);
            } else {
                console.log(`📭 Actualización de recordatorio sin envío de correo: ${emailResult?.reason || 'NO_REASON'}`);
            }

        } catch (error) {
            console.error('❌ Error al actualizar fecha importante:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al actualizar la fecha importante'
            });
        }
    }

    /**
     * Eliminar fecha importante (instructor propietario o admin)
     */
    static async deleteFecha(req, res) {
        try {
            const { id } = req.params;

            // Verificar que la fecha existe
            const fechaExistente = await CalendarioModel.findById(id);
            if (!fechaExistente) {
                return res.status(404).json({
                    error: 'Fecha no encontrada',
                    message: 'No se encontró la fecha importante especificada'
                });
            }

            // Solo instructores propietarios y admin pueden eliminar
            if (req.user.tipo_usuario === 'instructor') {
                // Verificar que es el instructor de la fecha
                const instructorResult = await query(
                    'SELECT id FROM perfiles_instructor WHERE usuario_id = $1',
                    [req.user.id]
                );

                if (instructorResult.rows.length === 0 || 
                    instructorResult.rows[0].id !== fechaExistente.instructor_id) {
                    return res.status(403).json({
                        error: 'Acceso denegado',
                        message: 'Solo puedes eliminar tus propias fechas importantes'
                    });
                }
            }

            const eliminado = await CalendarioModel.delete(id);

            if (!eliminado) {
                return res.status(500).json({
                    error: 'Error al eliminar',
                    message: 'No se pudo eliminar la fecha importante'
                });
            }

            res.json({
                message: 'Fecha importante eliminada exitosamente'
            });

            console.log(`✅ Fecha importante eliminada: ${id} por ${req.user.email}`);

        } catch (error) {
            console.error('❌ Error al eliminar fecha importante:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al eliminar la fecha importante'
            });
        }
    }

    /**
     * Obtener calendario mensual
     */
    static async getCalendarioMensual(req, res) {
        try {
            const { tallerId, year, month } = req.query;

            if (!year || !month) {
                return res.status(400).json({
                    error: 'Parámetros requeridos',
                    message: 'Se requieren los parámetros year y month'
                });
            }

            if (!tallerId) {
                return res.status(400).json({
                    error: 'Parámetro requerido',
                    message: 'Se requiere el parámetro tallerId'
                });
            }

            const allowedTallerIds = await getAllowedTallerIdsForUser(req.user);
            if (!userCanAccessTaller(allowedTallerIds, tallerId)) {
                return res.status(403).json({
                    error: 'Acceso denegado',
                    message: 'No tienes permisos para ver el calendario de este taller'
                });
            }

            const eventos = await CalendarioModel.getCalendarioMensual(
                tallerId, 
                parseInt(year), 
                parseInt(month)
            );

            res.json({
                message: 'Calendario mensual obtenido exitosamente',
                data: eventos,
                year: parseInt(year),
                month: parseInt(month),
                tallerId
            });

        } catch (error) {
            console.error('❌ Error al obtener calendario mensual:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener el calendario mensual'
            });
        }
    }

    /**
     * Obtener eventos de hoy
     */
    static async getEventosHoy(req, res) {
        try {
            const { tallerId } = req.query;

            const eventos = await CalendarioModel.getEventosDeHoy(tallerId || null);

            res.json({
                message: 'Eventos de hoy obtenidos exitosamente',
                data: eventos,
                fecha: new Date().toISOString().split('T')[0]
            });

        } catch (error) {
            console.error('❌ Error al obtener eventos de hoy:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener eventos de hoy'
            });
        }
    }

    /**
     * Obtener eventos por tipo
     */
    static async getEventosPorTipo(req, res) {
        try {
            const { tipo } = req.params;
            const { 
                tallerId, 
                fechaInicio, 
                fechaFin, 
                limit = 20, 
                offset = 0 
            } = req.query;

            const options = {
                tallerId: tallerId || null,
                fechaInicio: fechaInicio || null,
                fechaFin: fechaFin || null,
                limit: parseInt(limit),
                offset: parseInt(offset)
            };

            const eventos = await CalendarioModel.getEventosPorTipo(tipo, options);

            res.json({
                message: `Eventos de tipo "${tipo}" obtenidos exitosamente`,
                data: eventos,
                tipo,
                pagination: {
                    limit: options.limit,
                    offset: options.offset,
                    total: eventos.length
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener eventos por tipo:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener eventos por tipo'
            });
        }
    }

    /**
     * Buscar eventos
     */
    static async searchEventos(req, res) {
        try {
            const { q: searchTerm } = req.query;
            const { 
                tallerId, 
                tipoEvento,
                limit = 20, 
                offset = 0 
            } = req.query;

            if (!searchTerm) {
                return res.status(400).json({
                    error: 'Parámetro requerido',
                    message: 'Se requiere el parámetro de búsqueda "q"'
                });
            }

            let instructorId = null;

            // Si es instructor, solo buscar en sus eventos
            if (req.user.tipo_usuario === 'instructor') {
                const instructorResult = await query(
                    'SELECT id FROM perfiles_instructor WHERE usuario_id = $1',
                    [req.user.id]
                );

                if (instructorResult.rows.length > 0) {
                    instructorId = instructorResult.rows[0].id;
                }
            }

            const options = {
                tallerId: tallerId || null,
                instructorId,
                tipoEvento: tipoEvento || null,
                limit: parseInt(limit),
                offset: parseInt(offset)
            };

            const eventos = await CalendarioModel.search(searchTerm, options);

            res.json({
                message: 'Búsqueda de eventos completada',
                data: eventos,
                searchTerm,
                pagination: {
                    limit: options.limit,
                    offset: options.offset,
                    total: eventos.length
                }
            });

        } catch (error) {
            console.error('❌ Error en búsqueda de eventos:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al buscar eventos'
            });
        }
    }

    /**
     * Obtener estadísticas de eventos
     */
    static async getEstadisticas(req, res) {
        try {
            let instructorId = null;

            // Si es instructor, solo estadísticas de sus eventos
            if (req.user.tipo_usuario === 'instructor') {
                const instructorResult = await query(
                    'SELECT id FROM perfiles_instructor WHERE usuario_id = $1',
                    [req.user.id]
                );

                if (instructorResult.rows.length > 0) {
                    instructorId = instructorResult.rows[0].id;
                }
            }

            const stats = await CalendarioModel.getStats(instructorId);

            res.json({
                message: 'Estadísticas de eventos obtenidas exitosamente',
                data: stats
            });

        } catch (error) {
            console.error('❌ Error al obtener estadísticas de eventos:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener estadísticas'
            });
        }
    }

    /**
     * Obtener vista de calendario para un rango de fechas
     */
    static async getCalendarioRango(req, res) {
        try {
            const { fechaInicio, fechaFin, tallerId } = req.query;

            if (!fechaInicio || !fechaFin) {
                return res.status(400).json({
                    error: 'Parámetros requeridos',
                    message: 'Se requieren los parámetros fechaInicio y fechaFin'
                });
            }

            const allowedTallerIds = await getAllowedTallerIdsForUser(req.user);
            if (tallerId && !userCanAccessTaller(allowedTallerIds, tallerId)) {
                return res.status(403).json({
                    error: 'Acceso denegado',
                    message: 'No tienes permisos para ver el calendario de este taller'
                });
            }

            if (allowedTallerIds !== null && allowedTallerIds.length === 0) {
                return res.json({
                    message: 'Calendario de rango obtenido exitosamente',
                    data: {},
                    fechaInicio,
                    fechaFin,
                    tallerId: tallerId || null
                });
            }

            const eventosPorDia = await CalendarioModel.getCalendarioRango(
                fechaInicio, 
                fechaFin, 
                tallerId || null,
                allowedTallerIds
            );

            res.json({
                message: 'Calendario de rango obtenido exitosamente',
                data: eventosPorDia,
                fechaInicio,
                fechaFin,
                tallerId: tallerId || null
            });

        } catch (error) {
            console.error('❌ Error al obtener calendario de rango:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener el calendario de rango'
            });
        }
    }
}

export default CalendarioController;