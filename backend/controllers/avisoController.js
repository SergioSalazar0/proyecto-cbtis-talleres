import AvisoModel from '../models/Aviso.js';
import { query } from '../database/config-db.js';

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
    /**
     * Obtener avisos de un taller
     */
    static async getAvisosByTaller(req, res) {
        try {
            const { tallerId } = req.params;
            const { includeExpired = 'false', limit = 20, offset = 0 } = req.query;

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

            res.status(201).json({
                message: 'Aviso creado exitosamente',
                data: nuevoAviso
            });

            console.log(`✅ Aviso creado: "${titulo}" por ${req.user.email} en taller ${taller_id}`);

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

            res.json({
                message: 'Aviso actualizado exitosamente',
                data: avisoActualizado
            });

            console.log(`✅ Aviso actualizado: ${id} por ${req.user.email}`);

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