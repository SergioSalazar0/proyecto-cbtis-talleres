import CalendarioModel from '../models/Calendario.js';
import { query } from '../database/config-db.js';

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

            res.status(201).json({
                message: 'Fecha importante creada exitosamente',
                data: nuevaFecha
            });

            console.log(`✅ Fecha importante creada: "${titulo}" por ${req.user.email} en taller ${taller_id}`);

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

            res.json({
                message: 'Fecha importante actualizada exitosamente',
                data: fechaActualizada
            });

            console.log(`✅ Fecha importante actualizada: ${id} por ${req.user.email}`);

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

            const eventosPorDia = await CalendarioModel.getCalendarioRango(
                fechaInicio, 
                fechaFin, 
                tallerId || null
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