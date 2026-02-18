import TallerModel from '../models/Taller.js';
import InscripcionModel from '../models/Inscripcion.js';
import { query } from '../database/config-db.js';

/**
 * Controlador de talleres
 * 
 * Fundamentos:
 * - Gestiona CRUD de talleres
 * - Controla acceso según tipo de usuario
 * - Maneja inscripciones y cupos
 * - Proporciona estadísticas y reportes
 */

class TallerController {
    /**
     * Obtener todos los talleres
     */
    static async getTalleres(req, res) {
        try {
            const {
                categoria,
                activo = 'true',
                search,
                limit = 20,
                offset = 0
            } = req.query;

            const options = {
                categoria: categoria || null,
                activo: activo === 'true' ? true : activo === 'false' ? false : null,
                search: search || null,
                limit: parseInt(limit),
                offset: parseInt(offset)
            };

            const talleres = await TallerModel.findAll(options);

            res.json({
                message: 'Talleres obtenidos exitosamente',
                data: talleres,
                pagination: {
                    limit: options.limit,
                    offset: options.offset,
                    total: talleres.length
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener talleres:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener los talleres'
            });
        }
    }

    /**
     * Obtener taller por ID
     */
    static async getTallerById(req, res) {
        try {
            const { id } = req.params;

            const taller = await TallerModel.findById(id);

            if (!taller) {
                return res.status(404).json({
                    error: 'Taller no encontrado',
                    message: 'No se encontró el taller especificado'
                });
            }

            res.json({
                message: 'Taller obtenido exitosamente',
                data: taller
            });

        } catch (error) {
            console.error('❌ Error al obtener taller:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener el taller'
            });
        }
    }

    /**
     * Obtener talleres por categoría
     */
    static async getTalleresByCategoria(req, res) {
        try {
            const { categoria } = req.params;

            const talleres = await TallerModel.findByCategoria(categoria);

            res.json({
                message: `Talleres de ${categoria} obtenidos exitosamente`,
                data: talleres,
                categoria: categoria
            });

        } catch (error) {
            console.error('❌ Error al obtener talleres por categoría:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener talleres por categoría'
            });
        }
    }

    /**
     * Crear nuevo taller (solo admin)
     */
    static async createTaller(req, res) {
        try {
            const tallerData = req.body;

            const nuevoTaller = await TallerModel.create(tallerData);

            res.status(201).json({
                message: 'Taller creado exitosamente',
                data: nuevoTaller
            });

            console.log(`✅ Taller creado: ${nuevoTaller.nombre} por ${req.user.email}`);

        } catch (error) {
            console.error('❌ Error al crear taller:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al crear el taller'
            });
        }
    }

    /**
     * Actualizar taller (admin o instructor asignado)
     */
    static async updateTaller(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            // Verificar que el taller existe
            const tallerExistente = await TallerModel.findById(id);
            if (!tallerExistente) {
                return res.status(404).json({
                    error: 'Taller no encontrado',
                    message: 'No se encontró el taller especificado'
                });
            }

            // Si es instructor, verificar que es su taller
            if (req.user.tipo_usuario === 'instructor') {
                if (tallerExistente.instructor_usuario_id !== req.user.id) {
                    return res.status(403).json({
                        error: 'Acceso denegado',
                        message: 'Solo puedes editar tus propios talleres'
                    });
                }
                
                // Los instructores no pueden cambiar ciertos campos
                const camposRestringidos = ['categoria', 'cupo_maximo', 'instructor_id'];
                for (const campo of camposRestringidos) {
                    if (updateData.hasOwnProperty(campo)) {
                        delete updateData[campo];
                    }
                }
            }

            const tallerActualizado = await TallerModel.update(id, updateData);

            if (!tallerActualizado) {
                return res.status(500).json({
                    error: 'Error al actualizar',
                    message: 'No se pudo actualizar el taller'
                });
            }

            res.json({
                message: 'Taller actualizado exitosamente',
                data: tallerActualizado
            });

            console.log(`✅ Taller actualizado: ${tallerActualizado.nombre} por ${req.user.email}`);

        } catch (error) {
            console.error('❌ Error al actualizar taller:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al actualizar el taller'
            });
        }
    }

    /**
     * Eliminar taller (solo admin)
     */
    static async deleteTaller(req, res) {
        try {
            const { id } = req.params;

            const eliminado = await TallerModel.delete(id);

            if (!eliminado) {
                return res.status(404).json({
                    error: 'Taller no encontrado',
                    message: 'No se encontró el taller especificado'
                });
            }

            res.json({
                message: 'Taller eliminado exitosamente'
            });

            console.log(`✅ Taller eliminado: ${id} por ${req.user.email}`);

        } catch (error) {
            console.error('❌ Error al eliminar taller:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al eliminar el taller'
            });
        }
    }

    /**
     * Obtener alumnos inscritos en un taller
     */
    static async getAlumnosInscritos(req, res) {
        try {
            const { id } = req.params;
            const { search, limit = 50, offset = 0 } = req.query;

            // Verificar que el taller existe
            const taller = await TallerModel.findById(id);
            if (!taller) {
                return res.status(404).json({
                    error: 'Taller no encontrado',
                    message: 'No se encontró el taller especificado'
                });
            }

            // Si es instructor, verificar que es su taller
            if (req.user.tipo_usuario === 'instructor') {
                if (taller.instructor_usuario_id !== req.user.id) {
                    return res.status(403).json({
                        error: 'Acceso denegado',
                        message: 'Solo puedes ver los alumnos de tus talleres'
                    });
                }
            }

            const alumnos = await TallerModel.getAlumnosInscritos(id, {
                search: search || null,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            res.json({
                message: 'Alumnos inscritos obtenidos exitosamente',
                data: alumnos,
                taller: {
                    id: taller.id,
                    nombre: taller.nombre,
                    categoria: taller.categoria
                },
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: alumnos.length
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener alumnos inscritos:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener los alumnos inscritos'
            });
        }
    }

    /**
     * Obtener talleres disponibles para inscripción (alumno)
     */
    static async getTalleresDisponibles(req, res) {
        try {
            // Solo para alumnos
            if (req.user.tipo_usuario !== 'alumno') {
                return res.status(403).json({
                    error: 'Acceso denegado',
                    message: 'Esta funcionalidad es solo para alumnos'
                });
            }

            const talleres = await TallerModel.getTalleresDisponiblesParaAlumno(req.alumno.id);

            res.json({
                message: 'Talleres disponibles obtenidos exitosamente',
                data: talleres
            });

        } catch (error) {
            console.error('❌ Error al obtener talleres disponibles:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener talleres disponibles'
            });
        }
    }

    /**
     * Inscribirse a un taller (alumno)
     */
    static async inscribirseATaller(req, res) {
        try {
            const { id } = req.params;
            const { comentarios } = req.body;

            // Solo para alumnos
            if (req.user.tipo_usuario !== 'alumno') {
                return res.status(403).json({
                    error: 'Acceso denegado',
                    message: 'Solo los alumnos pueden inscribirse a talleres'
                });
            }

            // Verificar que puede inscribirse
            const verificacion = await InscripcionModel.verificarPuedeInscribirse(req.alumno.id, id);
            
            if (!verificacion.puede) {
                return res.status(400).json({
                    error: 'No se puede inscribir',
                    message: verificacion.razon,
                    details: verificacion
                });
            }

            // Crear inscripción
            const inscripcion = await InscripcionModel.create({
                alumno_id: req.alumno.id,
                taller_id: id,
                comentarios
            });

            // Obtener información completa de la inscripción
            const inscripcionCompleta = await InscripcionModel.findById(inscripcion.id);

            res.status(201).json({
                message: 'Inscripción realizada exitosamente',
                data: inscripcionCompleta
            });

            console.log(`✅ Inscripción creada: Alumno ${req.alumno.id} en taller ${id}`);

        } catch (error) {
            console.error('❌ Error al inscribirse:', error);
            
            if (error.message.includes('ya está inscrito')) {
                return res.status(409).json({
                    error: 'Ya inscrito',
                    message: error.message
                });
            }

            if (error.message.includes('cupos')) {
                return res.status(409).json({
                    error: 'Sin cupos',
                    message: error.message
                });
            }

            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al procesar la inscripción'
            });
        }
    }

    /**
     * Obtener estadísticas de talleres
     */
    static async getEstadisticas(req, res) {
        try {
            const stats = await TallerModel.getStats();

            res.json({
                message: 'Estadísticas obtenidas exitosamente',
                data: stats
            });

        } catch (error) {
            console.error('❌ Error al obtener estadísticas:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener estadísticas'
            });
        }
    }

    /**
     * Obtener talleres del instructor autenticado
     */
    static async getMisTalleres(req, res) {
        try {
            // Solo para instructores
            if (req.user.tipo_usuario !== 'instructor') {
                return res.status(403).json({
                    error: 'Acceso denegado',
                    message: 'Esta funcionalidad es solo para instructores'
                });
            }

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
            const talleres = await TallerModel.findByInstructor(instructorId);

            res.json({
                message: 'Talleres del instructor obtenidos exitosamente',
                data: talleres
            });

        } catch (error) {
            console.error('❌ Error al obtener talleres del instructor:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener tus talleres'
            });
        }
    }

    /**
     * Verificar cupo disponible de un taller
     */
    static async verificarCupo(req, res) {
        try {
            const { id } = req.params;

            const cuposDisponibles = await TallerModel.verificarCupoDisponible(id);

            if (cuposDisponibles === -1) {
                return res.status(404).json({
                    error: 'Taller no encontrado',
                    message: 'El taller no existe o está inactivo'
                });
            }

            res.json({
                message: 'Cupo verificado exitosamente',
                data: {
                    taller_id: id,
                    cupos_disponibles: cuposDisponibles,
                    tiene_cupo: cuposDisponibles > 0
                }
            });

        } catch (error) {
            console.error('❌ Error al verificar cupo:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al verificar el cupo disponible'
            });
        }
    }

    /**
     * Obtener inscripciones del alumno autenticado
     */
    static async getMisInscripciones(req, res) {
        try {
            // Solo para alumnos
            if (req.user.tipo_usuario !== 'alumno') {
                return res.status(403).json({
                    error: 'Acceso denegado',
                    message: 'Esta funcionalidad es solo para alumnos'
                });
            }

            const { estado, limit = 10, offset = 0 } = req.query;

            const inscripciones = await InscripcionModel.findByAlumno(req.alumno.id, {
                estado: estado || null,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            res.json({
                message: 'Inscripciones obtenidas exitosamente',
                data: inscripciones,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: inscripciones.length
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener inscripciones:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener tus inscripciones'
            });
        }
    }
}

export default TallerController;