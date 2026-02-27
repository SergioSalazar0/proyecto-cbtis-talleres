import AvisoModel from '../models/Aviso.js';
import { query } from '../database/config-db.js';
import { sendBulkEmail, canSendEmails } from '../services/emailService.js';

/**
 * Controlador de avisos
 * 
 * Fundamentos:
 * - Gestiona CRUD de avisos de instructores
 * - Control de acceso por taller y instructor
 * - Notificaciones importantes y fechas de expiración
 * - Filtrado y búsqueda de avisos
 */

class AvisoController {
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

    static async notificarAvisoPorCorreo({ tallerId, titulo, contenido, importante }) {
        try {
            if (!canSendEmails()) {
                return { sent: false, reason: 'EMAIL_DISABLED_OR_NOT_CONFIGURED' };
            }

            const [correos, nombreTaller] = await Promise.all([
                AvisoController.getEmailsAlumnosInscritos(tallerId),
                AvisoController.getNombreTaller(tallerId)
            ]);

            if (!correos.length) {
                return { sent: false, reason: 'NO_RECIPIENTS' };
            }

            const safeTitulo = AvisoController.escapeHtml(titulo);
            const safeContenido = AvisoController.escapeHtml(contenido).replace(/\n/g, '<br>');
            const etiquetaImportante = importante ? ' [IMPORTANTE]' : '';
            const subject = `[CBTIS 258]${etiquetaImportante} Nuevo aviso: ${titulo}`;
            const text = `Taller: ${nombreTaller}\nTítulo: ${titulo}\n\n${contenido}`;
            const html = `
                <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
                    <h2 style="margin-bottom: 8px;">Nuevo aviso del taller ${AvisoController.escapeHtml(nombreTaller)}</h2>
                    <p style="margin-top: 0; margin-bottom: 12px;"><strong>Título:</strong> ${safeTitulo}${importante ? ' <span style="color:#b91c1c;">(IMPORTANTE)</span>' : ''}</p>
                    <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:12px;">${safeContenido}</div>
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
            console.error('⚠️ Error al enviar aviso por correo:', error.message);
            return { sent: false, reason: 'SEND_ERROR' };
        }
    }

    static async alumnoInscritoEnTaller(alumnoId, tallerId) {
        const inscripcionResult = await query(
            `SELECT 1
             FROM inscripciones
             WHERE alumno_id = $1 AND taller_id = $2 AND estado = 'activa'
             LIMIT 1`,
            [alumnoId, tallerId]
        );

        return inscripcionResult.rows.length > 0;
    }

    static async instructorAsignadoATaller(usuarioId, tallerId) {
        const tallerResult = await query(
            `SELECT 1
             FROM talleres t
             INNER JOIN perfiles_instructor pi ON t.instructor_id = pi.id
             WHERE pi.usuario_id = $1 AND t.id = $2
             LIMIT 1`,
            [usuarioId, tallerId]
        );

        return tallerResult.rows.length > 0;
    }

    /**
     * Obtener avisos de un taller
     */
    static async getAvisosByTaller(req, res) {
        try {
            const { tallerId } = req.params;
            const { includeExpired = 'false', limit = 20, offset = 0 } = req.query;

            if (req.user.tipo_usuario === 'instructor') {
                const permitido = await AvisoController.instructorAsignadoATaller(req.user.id, tallerId);
                if (!permitido) {
                    return res.status(403).json({
                        error: 'Acceso denegado',
                        message: 'Solo puedes ver avisos de tu taller asignado'
                    });
                }
            }

            if (req.user.tipo_usuario === 'alumno') {
                const permitido = await AvisoController.alumnoInscritoEnTaller(req.alumno.id, tallerId);
                if (!permitido) {
                    return res.status(403).json({
                        error: 'Acceso denegado',
                        message: 'Solo puedes ver avisos del taller en el que estás inscrito'
                    });
                }
            }

            const options = {
                includeExpired: includeExpired === 'true',
                limit: parseInt(limit),
                offset: parseInt(offset)
            };

            const avisos = await AvisoModel.findByTaller(tallerId, options);

            res.json({
                message: 'Avisos obtenidos exitosamente',
                data: avisos,
                pagination: {
                    limit: options.limit,
                    offset: options.offset,
                    total: avisos.length
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener avisos por taller:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener los avisos del taller'
            });
        }
    }

    /**
     * Obtener avisos para un alumno (de sus talleres inscritos)
     */
    static async getAvisosParaAlumno(req, res) {
        try {
            // Solo para alumnos
            if (req.user.tipo_usuario !== 'alumno') {
                return res.status(403).json({
                    error: 'Acceso denegado',
                    message: 'Esta funcionalidad es solo para alumnos'
                });
            }

            const { limit = 10, offset = 0 } = req.query;

            const avisos = await AvisoModel.getAvisosParaAlumno(req.alumno.id, {
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            res.json({
                message: 'Avisos obtenidos exitosamente',
                data: avisos,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: avisos.length
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener avisos para alumno:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener tus avisos'
            });
        }
    }

    /**
     * Obtener avisos del instructor autenticado
     */
    static async getMisAvisos(req, res) {
        try {
            // Solo para instructores
            if (req.user.tipo_usuario !== 'instructor') {
                return res.status(403).json({
                    error: 'Acceso denegado',
                    message: 'Esta funcionalidad es solo para instructores'
                });
            }

            const { activo, limit = 20, offset = 0 } = req.query;

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
                activo: activo === 'true' ? true : activo === 'false' ? false : null,
                limit: parseInt(limit),
                offset: parseInt(offset)
            };

            const avisos = await AvisoModel.findByInstructor(instructorId, options);

            res.json({
                message: 'Avisos obtenidos exitosamente',
                data: avisos,
                pagination: {
                    limit: options.limit,
                    offset: options.offset,
                    total: avisos.length
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener avisos del instructor:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener tus avisos'
            });
        }
    }

    /**
     * Obtener aviso por ID
     */
    static async getAvisoById(req, res) {
        try {
            const { id } = req.params;

            const aviso = await AvisoModel.findById(id);

            if (!aviso) {
                return res.status(404).json({
                    error: 'Aviso no encontrado',
                    message: 'No se encontró el aviso especificado'
                });
            }

            // Verificar permisos de acceso
            if (req.user.tipo_usuario === 'instructor') {
                // Verificar que es el instructor del aviso
                const instructorResult = await query(
                    'SELECT id FROM perfiles_instructor WHERE usuario_id = $1',
                    [req.user.id]
                );

                if (instructorResult.rows.length === 0 || 
                    instructorResult.rows[0].id !== aviso.instructor_id) {
                    return res.status(403).json({
                        error: 'Acceso denegado',
                        message: 'Solo puedes ver tus propios avisos'
                    });
                }
            } else if (req.user.tipo_usuario === 'alumno') {
                const permitido = await AvisoController.alumnoInscritoEnTaller(req.alumno.id, aviso.taller_id);
                if (!permitido) {
                    return res.status(403).json({
                        error: 'Acceso denegado',
                        message: 'Solo puedes ver avisos del taller en el que estás inscrito'
                    });
                }
            }

            res.json({
                message: 'Aviso obtenido exitosamente',
                data: aviso
            });

        } catch (error) {
            console.error('❌ Error al obtener aviso:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener el aviso'
            });
        }
    }

    /**
     * Crear nuevo aviso (instructor)
     */
    static async createAviso(req, res) {
        try {
            // Solo para instructores
            if (req.user.tipo_usuario !== 'instructor') {
                return res.status(403).json({
                    error: 'Acceso denegado',
                    message: 'Solo los instructores pueden crear avisos'
                });
            }

            const { taller_id, titulo, contenido, importante, fecha_expiracion } = req.body;

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
                    message: 'Solo puedes crear avisos en tus talleres asignados'
                });
            }

            const avisoData = {
                taller_id,
                instructor_id: instructorId,
                titulo,
                contenido,
                importante: importante || false,
                fecha_expiracion: fecha_expiracion || null
            };

            const nuevoAviso = await AvisoModel.create(avisoData);

            const emailResult = await AvisoController.notificarAvisoPorCorreo({
                tallerId: taller_id,
                titulo,
                contenido,
                importante: importante || false
            });

            res.status(201).json({
                message: 'Aviso creado exitosamente',
                data: nuevoAviso,
                email: {
                    sent: Boolean(emailResult?.sent),
                    reason: emailResult?.reason || null,
                    recipients: emailResult?.recipients || 0
                }
            });

            console.log(`✅ Aviso creado: "${titulo}" por ${req.user.email} en taller ${taller_id}`);
            if (emailResult?.sent) {
                console.log(`📧 Aviso enviado por correo a ${emailResult.recipients} alumno(s)`);
            } else {
                console.log(`📭 Aviso sin envío de correo: ${emailResult?.reason || 'NO_REASON'}`);
            }

        } catch (error) {
            console.error('❌ Error al crear aviso:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al crear el aviso'
            });
        }
    }

    /**
     * Actualizar aviso (instructor propietario)
     */
    static async updateAviso(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            // Verificar que el aviso existe
            const avisoExistente = await AvisoModel.findById(id);
            if (!avisoExistente) {
                return res.status(404).json({
                    error: 'Aviso no encontrado',
                    message: 'No se encontró el aviso especificado'
                });
            }

            // Solo instructores y admin pueden actualizar
            if (req.user.tipo_usuario === 'instructor') {
                // Verificar que es el instructor del aviso
                const instructorResult = await query(
                    'SELECT id FROM perfiles_instructor WHERE usuario_id = $1',
                    [req.user.id]
                );

                if (instructorResult.rows.length === 0 || 
                    instructorResult.rows[0].id !== avisoExistente.instructor_id) {
                    return res.status(403).json({
                        error: 'Acceso denegado',
                        message: 'Solo puedes editar tus propios avisos'
                    });
                }
            }

            const avisoActualizado = await AvisoModel.update(id, updateData);

            if (!avisoActualizado) {
                return res.status(500).json({
                    error: 'Error al actualizar',
                    message: 'No se pudo actualizar el aviso'
                });
            }

            const tituloNotificacion = updateData.titulo || avisoExistente.titulo;
            const contenidoNotificacion = updateData.contenido || avisoExistente.contenido;
            const importanteNotificacion =
                updateData.importante !== undefined
                    ? updateData.importante
                    : avisoExistente.importante;

            const emailResult = await AvisoController.notificarAvisoPorCorreo({
                tallerId: avisoExistente.taller_id,
                titulo: tituloNotificacion,
                contenido: contenidoNotificacion,
                importante: importanteNotificacion
            });

            res.json({
                message: 'Aviso actualizado exitosamente',
                data: avisoActualizado,
                email: {
                    sent: Boolean(emailResult?.sent),
                    reason: emailResult?.reason || null,
                    recipients: emailResult?.recipients || 0
                }
            });

            console.log(`✅ Aviso actualizado: ${id} por ${req.user.email}`);
            if (emailResult?.sent) {
                console.log(`📧 Actualización de aviso enviada por correo a ${emailResult.recipients} alumno(s)`);
            } else {
                console.log(`📭 Actualización de aviso sin envío de correo: ${emailResult?.reason || 'NO_REASON'}`);
            }

        } catch (error) {
            console.error('❌ Error al actualizar aviso:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al actualizar el aviso'
            });
        }
    }

    /**
     * Eliminar aviso (instructor propietario o admin)
     */
    static async deleteAviso(req, res) {
        try {
            const { id } = req.params;

            // Verificar que el aviso existe
            const avisoExistente = await AvisoModel.findById(id);
            if (!avisoExistente) {
                return res.status(404).json({
                    error: 'Aviso no encontrado',
                    message: 'No se encontró el aviso especificado'
                });
            }

            // Solo instructores propietarios y admin pueden eliminar
            if (req.user.tipo_usuario === 'instructor') {
                // Verificar que es el instructor del aviso
                const instructorResult = await query(
                    'SELECT id FROM perfiles_instructor WHERE usuario_id = $1',
                    [req.user.id]
                );

                if (instructorResult.rows.length === 0 || 
                    instructorResult.rows[0].id !== avisoExistente.instructor_id) {
                    return res.status(403).json({
                        error: 'Acceso denegado',
                        message: 'Solo puedes eliminar tus propios avisos'
                    });
                }
            }

            const eliminado = await AvisoModel.delete(id);

            if (!eliminado) {
                return res.status(500).json({
                    error: 'Error al eliminar',
                    message: 'No se pudo eliminar el aviso'
                });
            }

            res.json({
                message: 'Aviso eliminado exitosamente'
            });

            console.log(`✅ Aviso eliminado: ${id} por ${req.user.email}`);

        } catch (error) {
            console.error('❌ Error al eliminar aviso:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al eliminar el aviso'
            });
        }
    }

    /**
     * Obtener avisos importantes
     */
    static async getAvisosImportantes(req, res) {
        try {
            const { tallerId } = req.query;

            const avisos = await AvisoModel.getImportantes(tallerId || null);

            res.json({
                message: 'Avisos importantes obtenidos exitosamente',
                data: avisos
            });

        } catch (error) {
            console.error('❌ Error al obtener avisos importantes:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener avisos importantes'
            });
        }
    }

    /**
     * Buscar avisos
     */
    static async searchAvisos(req, res) {
        try {
            const { q: searchTerm } = req.query;
            const { tallerId, limit = 20, offset = 0 } = req.query;

            if (!searchTerm) {
                return res.status(400).json({
                    error: 'Parámetro requerido',
                    message: 'Se requiere el parámetro de búsqueda "q"'
                });
            }

            let instructorId = null;

            // Si es instructor, solo buscar en sus avisos
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
                limit: parseInt(limit),
                offset: parseInt(offset)
            };

            const avisos = await AvisoModel.search(searchTerm, options);

            res.json({
                message: 'Búsqueda de avisos completada',
                data: avisos,
                searchTerm,
                pagination: {
                    limit: options.limit,
                    offset: options.offset,
                    total: avisos.length
                }
            });

        } catch (error) {
            console.error('❌ Error en búsqueda de avisos:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al buscar avisos'
            });
        }
    }

    /**
     * Obtener estadísticas de avisos
     */
    static async getEstadisticas(req, res) {
        try {
            let instructorId = null;

            // Si es instructor, solo estadísticas de sus avisos
            if (req.user.tipo_usuario === 'instructor') {
                const instructorResult = await query(
                    'SELECT id FROM perfiles_instructor WHERE usuario_id = $1',
                    [req.user.id]
                );

                if (instructorResult.rows.length > 0) {
                    instructorId = instructorResult.rows[0].id;
                }
            }

            const stats = await AvisoModel.getStats(instructorId);

            res.json({
                message: 'Estadísticas de avisos obtenidas exitosamente',
                data: stats
            });

        } catch (error) {
            console.error('❌ Error al obtener estadísticas de avisos:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener estadísticas'
            });
        }
    }

    /**
     * Obtener avisos próximos a expirar
     */
    static async getProximosAExpirar(req, res) {
        try {
            const { days = 3 } = req.query;

            let instructorId = null;

            // Si es instructor, solo sus avisos
            if (req.user.tipo_usuario === 'instructor') {
                const instructorResult = await query(
                    'SELECT id FROM perfiles_instructor WHERE usuario_id = $1',
                    [req.user.id]
                );

                if (instructorResult.rows.length > 0) {
                    instructorId = instructorResult.rows[0].id;
                }
            }

            const avisos = await AvisoModel.getProximosAExpirar(parseInt(days), instructorId);

            res.json({
                message: 'Avisos próximos a expirar obtenidos exitosamente',
                data: avisos,
                days: parseInt(days)
            });

        } catch (error) {
            console.error('❌ Error al obtener avisos próximos a expirar:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener avisos próximos a expirar'
            });
        }
    }
}

export default AvisoController;