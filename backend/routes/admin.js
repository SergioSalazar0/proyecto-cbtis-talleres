import express from 'express';
import UserModel from '../models/User.js';
import TallerModel from '../models/Taller.js';
import InscripcionModel from '../models/Inscripcion.js';
import AvisoModel from '../models/Aviso.js';
import CalendarioModel from '../models/Calendario.js';
import { 
    authenticateToken, 
    authorize 
} from '../middlewares/auth.js';
import { 
    validateUUIDParam,
    validateSearchQuery,
    sanitizeRequest
} from '../middlewares/validation.js';
import { query } from '../database/config-db.js';

const router = express.Router();

/**
 * Rutas de administración
 * 
 * Fundamentos:
 * - Solo accesible para usuarios admin
 * - Gestión completa de usuarios y sistema
 * - Reportes y estadísticas globales
 * - Operaciones de mantenimiento
 */

// @route   GET /api/admin/dashboard
// @desc    Obtener datos del dashboard administrativo
// @access  Private - Admin
router.get('/dashboard', 
    authenticateToken, 
    authorize('admin'),
    async (req, res) => {
        try {
            // Obtener estadísticas generales del sistema
            const [
                userStats,
                tallerStats,
                inscripcionStats,
                avisoStats,
                eventoStats
            ] = await Promise.all([
                UserModel.getStats(),
                TallerModel.getStats(),
                InscripcionModel.getStats(),
                AvisoModel.getStats(),
                CalendarioModel.getStats()
            ]);

            // Obtener actividad reciente
            const actividadReciente = await query(
                `SELECT 
                    'inscripcion' as tipo,
                    i.fecha_inscripcion as fecha,
                    pa.nombre || ' ' || pa.apellido_paterno as usuario,
                    t.nombre as detalle
                 FROM inscripciones i
                 INNER JOIN perfiles_alumno pa ON i.alumno_id = pa.id
                 INNER JOIN talleres t ON i.taller_id = t.id
                 WHERE i.fecha_inscripcion >= CURRENT_DATE - INTERVAL '7 days'
                 
                 UNION ALL
                 
                 SELECT 
                    'aviso' as tipo,
                    a.fecha_publicacion as fecha,
                    pi.nombre || ' ' || pi.apellido_paterno as usuario,
                    a.titulo as detalle
                 FROM avisos a
                 INNER JOIN perfiles_instructor pi ON a.instructor_id = pi.id
                 WHERE a.fecha_publicacion >= CURRENT_DATE - INTERVAL '7 days'
                 
                 ORDER BY fecha DESC
                 LIMIT 10`
            );

            res.json({
                message: 'Dashboard administrativo obtenido exitosamente',
                data: {
                    estadisticas: {
                        usuarios: userStats,
                        talleres: tallerStats,
                        inscripciones: inscripcionStats,
                        avisos: avisoStats,
                        eventos: eventoStats
                    },
                    actividad_reciente: actividadReciente.rows
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener dashboard admin:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener datos del dashboard'
            });
        }
    }
);

// @route   GET /api/admin/usuarios
// @desc    Obtener todos los usuarios con filtros
// @access  Private - Admin
router.get('/usuarios', 
    authenticateToken, 
    authorize('admin'),
    validateSearchQuery,
    async (req, res) => {
        try {
            const {
                tipo_usuario,
                activo,
                search,
                limit = 20,
                offset = 0
            } = req.query;

            const options = {
                limit: parseInt(limit),
                offset: parseInt(offset),
                tipo_usuario: tipo_usuario || null,
                activo: activo === 'true' ? true : activo === 'false' ? false : null,
                search: search || null
            };

            const result = await UserModel.findAll(options);

            res.json({
                message: 'Usuarios obtenidos exitosamente',
                data: result.users,
                pagination: {
                    total: result.total,
                    limit: result.limit,
                    offset: result.offset,
                    hasMore: result.hasMore
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener usuarios:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener usuarios'
            });
        }
    }
);

// @route   PUT /api/admin/usuarios/:id/status
// @desc    Cambiar estado activo/inactivo de un usuario
// @access  Private - Admin
router.put('/usuarios/:id/status', 
    validateUUIDParam('id'),
    authenticateToken, 
    authorize('admin'),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { activo } = req.body;

            if (typeof activo !== 'boolean') {
                return res.status(400).json({
                    error: 'Parámetro inválido',
                    message: 'El campo "activo" debe ser verdadero o falso'
                });
            }

            // No permitir desactivar el propio usuario admin
            if (id === req.user.id && !activo) {
                return res.status(400).json({
                    error: 'Operación no permitida',
                    message: 'No puedes desactivar tu propia cuenta'
                });
            }

            const updated = await UserModel.updateStatus(id, activo);

            if (!updated) {
                return res.status(404).json({
                    error: 'Usuario no encontrado',
                    message: 'No se encontró el usuario especificado'
                });
            }

            res.json({
                message: `Usuario ${activo ? 'activado' : 'desactivado'} exitosamente`
            });

            console.log(`✅ Usuario ${activo ? 'activado' : 'desactivado'}: ${id} por ${req.user.email}`);

        } catch (error) {
            console.error('❌ Error al cambiar estado de usuario:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al cambiar estado del usuario'
            });
        }
    }
);

// @route   PUT /api/admin/usuarios/:id/password
// @desc    Cambiar contraseña de cualquier usuario
// @access  Private - Admin
router.put('/usuarios/:id/password', 
    validateUUIDParam('id'),
    authenticateToken, 
    authorize('admin'),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { newPassword } = req.body;

            if (!newPassword || newPassword.length < 8) {
                return res.status(400).json({
                    error: 'Contraseña inválida',
                    message: 'La nueva contraseña debe tener al menos 8 caracteres'
                });
            }

            const updated = await UserModel.updatePassword(id, newPassword);

            if (!updated) {
                return res.status(404).json({
                    error: 'Usuario no encontrado',
                    message: 'No se encontró el usuario especificado'
                });
            }

            res.json({
                message: 'Contraseña actualizada exitosamente'
            });

            console.log(`✅ Contraseña cambiada para usuario: ${id} por admin ${req.user.email}`);

        } catch (error) {
            console.error('❌ Error al cambiar contraseña de usuario:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al cambiar contraseña del usuario'
            });
        }
    }
);

// @route   PUT /api/admin/usuarios/:id/numero-control
// @desc    Actualizar numero de control de un alumno
// @access  Private - Admin
router.put('/usuarios/:id/numero-control',
    validateUUIDParam('id'),
    authenticateToken,
    authorize('admin'),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { numero_control } = req.body;

            if (!numero_control || typeof numero_control !== 'string') {
                return res.status(400).json({
                    error: 'Numero de control invalido',
                    message: 'Debes proporcionar un numero de control valido'
                });
            }

            const numeroNormalizado = numero_control.trim();
            if (numeroNormalizado.length < 6 || numeroNormalizado.length > 50 || !/^[a-zA-Z0-9]+$/.test(numeroNormalizado)) {
                return res.status(400).json({
                    error: 'Numero de control invalido',
                    message: 'El numero de control debe tener entre 6 y 50 caracteres y solo letras o numeros'
                });
            }

            const userResult = await query(
                `SELECT u.id, u.tipo_usuario, pa.id as perfil_id
                 FROM usuarios u
                 LEFT JOIN perfiles_alumno pa ON u.id = pa.usuario_id
                 WHERE u.id = $1`,
                [id]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Usuario no encontrado',
                    message: 'No se encontro el usuario especificado'
                });
            }

            const userRow = userResult.rows[0];
            if (userRow.tipo_usuario !== 'alumno') {
                return res.status(400).json({
                    error: 'Operacion no permitida',
                    message: 'Solo se puede actualizar el numero de control de alumnos'
                });
            }

            if (!userRow.perfil_id) {
                return res.status(404).json({
                    error: 'Perfil no encontrado',
                    message: 'No se encontro el perfil del alumno'
                });
            }

            const existingControl = await query(
                'SELECT id FROM perfiles_alumno WHERE numero_control = $1 AND usuario_id != $2',
                [numeroNormalizado, id]
            );

            if (existingControl.rows.length > 0) {
                return res.status(409).json({
                    error: 'Numero de control en uso',
                    message: 'Ya existe otro alumno con ese numero de control'
                });
            }

            const updateResult = await query(
                `UPDATE perfiles_alumno
                 SET numero_control = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE usuario_id = $2
                 RETURNING id, usuario_id, numero_control`,
                [numeroNormalizado, id]
            );

            res.json({
                message: 'Numero de control actualizado exitosamente',
                data: updateResult.rows[0]
            });

            console.log(`✅ Numero de control actualizado: ${id} por admin ${req.user.email}`);

        } catch (error) {
            console.error('❌ Error al actualizar numero de control:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al actualizar el numero de control'
            });
        }
    }
);

// @route   DELETE /api/admin/usuarios/:id
// @desc    Eliminar un usuario del sistema
// @access  Private - Admin
router.delete('/usuarios/:id', 
    validateUUIDParam('id'),
    authenticateToken, 
    authorize('admin'),
    async (req, res) => {
        try {
            const { id } = req.params;

            // No permitir eliminar el propio usuario admin
            if (id === req.user.id) {
                return res.status(400).json({
                    error: 'Operación no permitida',
                    message: 'No puedes eliminar tu propia cuenta'
                });
            }

            // Verificar si el usuario es instructor y tiene talleres asignados
            const talleresAsignados = await query(
                `SELECT COUNT(*) as count 
                 FROM talleres t
                 INNER JOIN perfiles_instructor pi ON t.instructor_id = pi.id
                 WHERE pi.usuario_id = $1 AND t.activo = true`,
                [id]
            );

            if (parseInt(talleresAsignados.rows[0].count) > 0) {
                return res.status(400).json({
                    error: 'Operación no permitida',
                    message: 'El instructor tiene talleres activos asignados. Primero debes reasignar o desactivar los talleres.'
                });
            }

            // Verificar si el usuario es alumno y tiene inscripciones activas
            const inscripcionesActivas = await query(
                `SELECT COUNT(*) as count 
                 FROM inscripciones i
                 INNER JOIN perfiles_alumno pa ON i.alumno_id = pa.id
                 WHERE pa.usuario_id = $1 AND i.estado = 'activo'`,
                [id]
            );

            if (parseInt(inscripcionesActivas.rows[0].count) > 0) {
                return res.status(400).json({
                    error: 'Operación no permitida',
                    message: 'El alumno tiene inscripciones activas. Primero debes cancelar las inscripciones.'
                });
            }

            // Eliminar usuario (CASCADE eliminará perfiles relacionados)
            const deleted = await UserModel.deleteUser(id);

            if (!deleted) {
                return res.status(404).json({
                    error: 'Usuario no encontrado',
                    message: 'No se encontró el usuario especificado'
                });
            }

            res.json({
                message: 'Usuario eliminado exitosamente'
            });

            console.log(`✅ Usuario eliminado: ${id} por admin ${req.user.email}`);

        } catch (error) {
            console.error('❌ Error al eliminar usuario:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al eliminar usuario'
            });
        }
    }
);

// @route   GET /api/admin/reportes/inscripciones
// @desc    Obtener reporte de inscripciones por taller
// @access  Private - Admin
router.get('/reportes/inscripciones', 
    authenticateToken, 
    authorize('admin'),
    async (req, res) => {
        try {
            const reporte = await InscripcionModel.getReportePorTaller();

            res.json({
                message: 'Reporte de inscripciones obtenido exitosamente',
                data: reporte
            });

        } catch (error) {
            console.error('❌ Error al obtener reporte de inscripciones:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener reporte de inscripciones'
            });
        }
    }
);

// @route   GET /api/admin/reportes/actividad
// @desc    Obtener reporte de actividad del sistema
// @access  Private - Admin
router.get('/reportes/actividad', 
    authenticateToken, 
    authorize('admin'),
    async (req, res) => {
        try {
            const { dias = 30 } = req.query;

            const actividad = await query(
                `SELECT 
                    DATE(fecha) as fecha,
                    COUNT(*) FILTER (WHERE tipo = 'inscripcion') as inscripciones,
                    COUNT(*) FILTER (WHERE tipo = 'aviso') as avisos,
                    COUNT(*) FILTER (WHERE tipo = 'evento') as eventos,
                    COUNT(*) as total_actividad
                 FROM (
                     SELECT i.fecha_inscripcion::date as fecha, 'inscripcion' as tipo
                     FROM inscripciones i
                     WHERE i.fecha_inscripcion >= CURRENT_DATE - INTERVAL '${parseInt(dias)} days'
                     
                     UNION ALL
                     
                     SELECT a.fecha_publicacion::date as fecha, 'aviso' as tipo
                     FROM avisos a
                     WHERE a.fecha_publicacion >= CURRENT_DATE - INTERVAL '${parseInt(dias)} days'
                     
                     UNION ALL
                     
                     SELECT f.created_at::date as fecha, 'evento' as tipo
                     FROM fechas_importantes f
                     WHERE f.created_at >= CURRENT_DATE - INTERVAL '${parseInt(dias)} days'
                 ) actividad
                 GROUP BY DATE(fecha)
                 ORDER BY fecha DESC`
            );

            res.json({
                message: 'Reporte de actividad obtenido exitosamente',
                data: actividad.rows,
                periodo_dias: parseInt(dias)
            });

        } catch (error) {
            console.error('❌ Error al obtener reporte de actividad:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener reporte de actividad'
            });
        }
    }
);

// @route   POST /api/admin/usuarios/instructor
// @desc    Crear nuevo usuario instructor
// @access  Private - Admin
router.post('/usuarios/instructor', 
    authenticateToken, 
    authorize('admin'),
    sanitizeRequest,
    async (req, res) => {
        try {
            const {
                email,
                password,
                nombre,
                apellido_paterno,
                apellido_materno,
                especialidad
            } = req.body;

            // Validaciones básicas
            if (!email || !password || !nombre || !apellido_paterno) {
                return res.status(400).json({
                    error: 'Campos requeridos',
                    message: 'Email, contraseña, nombre y apellido paterno son obligatorios'
                });
            }

            const { user, profile } = await UserModel.createUserWithProfile({
                email,
                password,
                tipo_usuario: 'instructor',
                nombre,
                apellido_paterno,
                apellido_materno,
                especialidad
            });

            res.status(201).json({
                message: 'Instructor creado exitosamente',
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        tipo_usuario: user.tipo_usuario
                    },
                    profile
                }
            });

            console.log(`✅ Instructor creado: ${email} por admin ${req.user.email}`);

        } catch (error) {
            console.error('❌ Error al crear instructor:', error);
            
            if (error.message.includes('email')) {
                return res.status(409).json({
                    error: 'Email ya registrado',
                    message: 'Ya existe un usuario con este email'
                });
            }

            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al crear instructor'
            });
        }
    }
);

// @route   GET /api/admin/sistema/info
// @desc    Obtener información del sistema
// @access  Private - Admin
router.get('/sistema/info', 
    authenticateToken, 
    authorize('admin'),
    async (req, res) => {
        try {
            // Información básica del sistema
            const info = {
                version: '1.0.0',
                node_version: process.version,
                uptime: process.uptime(),
                memoria: {
                    usado: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                    total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
                },
                ambiente: process.env.NODE_ENV,
                timestamp: new Date().toISOString()
            };

            res.json({
                message: 'Información del sistema obtenida exitosamente',
                data: info
            });

        } catch (error) {
            console.error('❌ Error al obtener info del sistema:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener información del sistema'
            });
        }
    }
);

// ==================== GESTIÓN DE TALLERES ====================

// @route   GET /api/admin/instructores
// @desc    Obtener lista de perfiles de instructores (para asignar a talleres)
// @access  Private - Admin
router.get('/instructores',
    authenticateToken,
    authorize('admin'),
    async (req, res) => {
        try {
            const result = await query(
                `SELECT 
                    pi.id as perfil_id,
                    pi.usuario_id,
                    pi.nombre,
                    pi.apellido_paterno,
                    pi.apellido_materno,
                    pi.especialidad,
                    u.email,
                    u.activo
                 FROM perfiles_instructor pi
                 INNER JOIN usuarios u ON pi.usuario_id = u.id
                 WHERE u.activo = true
                 ORDER BY pi.nombre, pi.apellido_paterno ASC`
            );

            res.json({
                message: 'Instructores obtenidos exitosamente',
                data: result.rows
            });

        } catch (error) {
            console.error('❌ Error al obtener instructores:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener instructores'
            });
        }
    }
);

// @route   PUT /api/admin/instructores/:usuarioId
// @desc    Actualizar perfil de instructor
// @access  Private - Admin
router.put('/instructores/:usuarioId',
    authenticateToken,
    authorize('admin'),
    async (req, res) => {
        try {
            const { usuarioId } = req.params;
            const { nombre, apellido_paterno, apellido_materno, especialidad } = req.body;

            // Validar que el instructor existe
            const instructorCheck = await query(
                `SELECT pi.id, pi.usuario_id 
                 FROM perfiles_instructor pi
                 INNER JOIN usuarios u ON pi.usuario_id = u.id
                 WHERE pi.usuario_id = $1`,
                [usuarioId]
            );

            if (instructorCheck.rows.length === 0) {
                return res.status(404).json({
                    error: 'Instructor no encontrado',
                    message: 'No se encontró el perfil de instructor'
                });
            }

            // Validar campos requeridos
            if (!nombre || !apellido_paterno || !apellido_materno) {
                return res.status(400).json({
                    error: 'Datos incompletos',
                    message: 'Nombre, apellido paterno y apellido materno son requeridos'
                });
            }

            // Actualizar perfil de instructor
            const result = await query(
                `UPDATE perfiles_instructor 
                 SET nombre = $1, 
                     apellido_paterno = $2, 
                     apellido_materno = $3, 
                     especialidad = $4
                 WHERE usuario_id = $5
                 RETURNING id, usuario_id, nombre, apellido_paterno, apellido_materno, especialidad`,
                [nombre.trim(), apellido_paterno.trim(), apellido_materno.trim(), especialidad?.trim() || null, usuarioId]
            );

            console.log('✅ Perfil de instructor actualizado:', result.rows[0]);

            res.json({
                message: 'Perfil de instructor actualizado exitosamente',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('❌ Error al actualizar perfil de instructor:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al actualizar perfil de instructor'
            });
        }
    }
);

// @route   GET /api/admin/talleres
// @desc    Obtener todos los talleres con información del instructor
// @access  Private - Admin
router.get('/talleres',
    authenticateToken,
    authorize('admin'),
    async (req, res) => {
        try {
            const result = await query(
                `SELECT 
                    t.id, t.nombre, t.descripcion, t.categoria, t.cupo_maximo, 
                    t.horario, t.lugar, t.activo, t.created_at,
                    t.instructor_id,
                    pi.nombre || ' ' || pi.apellido_paterno as instructor_nombre,
                    COUNT(i.id) as inscritos
                 FROM talleres t
                  LEFT JOIN perfiles_instructor pi ON t.instructor_id = pi.id
                 LEFT JOIN inscripciones i ON t.id = i.taller_id AND i.estado = 'activa'
                 GROUP BY t.id, pi.nombre, pi.apellido_paterno
                 ORDER BY t.nombre ASC`
            );

            res.json({
                message: 'Talleres obtenidos exitosamente',
                data: result.rows
            });

        } catch (error) {
            console.error('❌ Error al obtener talleres:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener talleres'
            });
        }
    }
);

// @route   GET /api/admin/talleres/:id
// @desc    Obtener un taller específico
// @access  Private - Admin
router.get('/talleres/:id',
    validateUUIDParam('id'),
    authenticateToken,
    authorize('admin'),
    async (req, res) => {
        try {
            const { id } = req.params;
            
            const result = await query(
                `SELECT 
                    t.id, t.nombre, t.descripcion, t.categoria, t.cupo_maximo, 
                    t.horario, t.lugar, t.activo, t.instructor_id, t.created_at,
                    pi.nombre || ' ' || pi.apellido_paterno as instructor_nombre
                 FROM talleres t
                 LEFT JOIN perfiles_instructor pi ON t.instructor_id = pi.id
                 WHERE t.id = $1`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: 'Taller no encontrado',
                    message: 'No se encontró el taller especificado'
                });
            }

            res.json({
                message: 'Taller obtenido exitosamente',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('❌ Error al obtener taller:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener el taller'
            });
        }
    }
);

// @route   POST /api/admin/talleres
// @desc    Crear un nuevo taller
// @access  Private - Admin
router.post('/talleres',
    authenticateToken,
    authorize('admin'),
    async (req, res) => {
        try {
            const {
                nombre,
                descripcion,
                categoria,
                instructor_id,
                cupo_maximo,
                horario,
                lugar
            } = req.body;

            // Validaciones básicas
            if (!nombre || !categoria || !cupo_maximo) {
                return res.status(400).json({
                    error: 'Datos incompletos',
                    message: 'Nombre, categoría y cupo máximo son requeridos'
                });
            }

            const result = await query(
                `INSERT INTO talleres (nombre, descripcion, categoria, instructor_id, cupo_maximo, horario, lugar)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING *`,
                [nombre, descripcion || null, categoria, instructor_id || null, cupo_maximo, horario || null, lugar || null]
            );

            res.status(201).json({
                message: 'Taller creado exitosamente',
                data: result.rows[0]
            });

            console.log(`✅ Taller creado: ${nombre} por admin ${req.user.email}`);

        } catch (error) {
            console.error('❌ Error al crear taller:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al crear el taller'
            });
        }
    }
);

// @route   PUT /api/admin/talleres/:id
// @desc    Actualizar un taller
// @access  Private - Admin
router.put('/talleres/:id',
    validateUUIDParam('id'),
    authenticateToken,
    authorize('admin'),
    async (req, res) => {
        try {
            const { id } = req.params;
            const {
                nombre,
                descripcion,
                categoria,
                instructor_id,
                cupo_maximo,
                horario,
                lugar,
                activo
            } = req.body;

            // Construir query dinámico solo con campos proporcionados
            const updates = [];
            const values = [];
            let paramCount = 1;

            if (nombre !== undefined) {
                updates.push(`nombre = $${paramCount}`);
                values.push(nombre);
                paramCount++;
            }
            if (descripcion !== undefined) {
                updates.push(`descripcion = $${paramCount}`);
                values.push(descripcion);
                paramCount++;
            }
            if (categoria !== undefined) {
                updates.push(`categoria = $${paramCount}`);
                values.push(categoria);
                paramCount++;
            }
            if (instructor_id !== undefined) {
                updates.push(`instructor_id = $${paramCount}`);
                values.push(instructor_id);
                paramCount++;
            }
            if (cupo_maximo !== undefined) {
                updates.push(`cupo_maximo = $${paramCount}`);
                values.push(cupo_maximo);
                paramCount++;
            }
            if (horario !== undefined) {
                updates.push(`horario = $${paramCount}`);
                values.push(horario);
                paramCount++;
            }
            if (lugar !== undefined) {
                updates.push(`lugar = $${paramCount}`);
                values.push(lugar);
                paramCount++;
            }
            if (activo !== undefined) {
                updates.push(`activo = $${paramCount}`);
                values.push(activo);
                paramCount++;
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    error: 'Sin cambios',
                    message: 'No se proporcionaron campos para actualizar'
                });
            }

            values.push(id);
            const result = await query(
                `UPDATE talleres SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
                values
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: 'Taller no encontrado',
                    message: 'No se encontró el taller especificado'
                });
            }

            res.json({
                message: 'Taller actualizado exitosamente',
                data: result.rows[0]
            });

            console.log(`✅ Taller actualizado: ${id} por admin ${req.user.email}`);

        } catch (error) {
            console.error('❌ Error al actualizar taller:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al actualizar el taller'
            });
        }
    }
);

// @route   PUT /api/admin/talleres/:id/status
// @desc    Cambiar estado de un taller (activar/desactivar)
// @access  Private - Admin
router.put('/talleres/:id/status',
    validateUUIDParam('id'),
    authenticateToken,
    authorize('admin'),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { activo } = req.body;

            if (activo === undefined) {
                return res.status(400).json({
                    error: 'Datos incompletos',
                    message: 'El campo activo es requerido'
                });
            }

            const result = await query(
                'UPDATE talleres SET activo = $1 WHERE id = $2 RETURNING *',
                [activo, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: 'Taller no encontrado',
                    message: 'No se encontró el taller especificado'
                });
            }

            res.json({
                message: `Taller ${activo ? 'activado' : 'desactivado'} exitosamente`,
                data: result.rows[0]
            });

            console.log(`✅ Taller ${activo ? 'activado' : 'desactivado'}: ${id} por admin ${req.user.email}`);

        } catch (error) {
            console.error('❌ Error al cambiar estado del taller:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al cambiar el estado del taller'
            });
        }
    }
);

// @route   DELETE /api/admin/talleres/:id
// @desc    Eliminar un taller (soft delete - desactivar)
// @access  Private - Admin
router.delete('/talleres/:id',
    validateUUIDParam('id'),
    authenticateToken,
    authorize('admin'),
    async (req, res) => {
        try {
            const { id } = req.params;

            // Verificar si hay inscripciones activas
            const inscripcionesActivas = await query(
                'SELECT COUNT(*) as total FROM inscripciones WHERE taller_id = $1 AND estado = $2',
                [id, 'activa']
            );

            if (parseInt(inscripcionesActivas.rows[0].total) > 0) {
                return res.status(400).json({
                    error: 'Taller con inscripciones',
                    message: 'No se puede eliminar un taller con inscripciones activas. Desactívalo en su lugar.'
                });
            }

            // Eliminar taller
            const result = await query(
                'DELETE FROM talleres WHERE id = $1 RETURNING *',
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: 'Taller no encontrado',
                    message: 'No se encontró el taller especificado'
                });
            }

            res.json({
                message: 'Taller eliminado exitosamente',
                data: result.rows[0]
            });

            console.log(`✅ Taller eliminado: ${id} por admin ${req.user.email}`);

        } catch (error) {
            console.error('❌ Error al eliminar taller:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al eliminar el taller'
            });
        }
    }
);

// @route   POST /api/admin/asistencias/registrar
// @desc    Registrar asistencia por numero de control
// @access  Private - Admin
router.post('/asistencias/registrar',
    authenticateToken,
    authorize('admin'),
    async (req, res) => {
        try {
            const { numero_control, taller_id, fecha_sesion } = req.body;

            if (!numero_control || !taller_id) {
                return res.status(400).json({
                    error: 'Datos incompletos',
                    message: 'numero_control y taller_id son obligatorios'
                });
            }

            const fecha = fecha_sesion || new Date().toISOString().slice(0, 10);

            const alumnoResult = await query(
                `SELECT id, nombre, apellido_paterno, apellido_materno, numero_control, grupo, semestre
                 FROM perfiles_alumno
                 WHERE numero_control = $1`,
                [numero_control]
            );

            if (alumnoResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Alumno no encontrado',
                    message: 'No existe un alumno con ese numero de control'
                });
            }

            const alumno = alumnoResult.rows[0];

            const inscripcion = await query(
                `SELECT id FROM inscripciones
                 WHERE alumno_id = $1 AND taller_id = $2 AND estado = 'activa'`,
                [alumno.id, taller_id]
            );

            if (inscripcion.rows.length === 0) {
                return res.status(400).json({
                    error: 'Alumno no inscrito',
                    message: 'El alumno no esta inscrito en este taller'
                });
            }

            const insertResult = await query(
                `INSERT INTO asistencias (alumno_id, taller_id, fecha_sesion, registrado_por)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (alumno_id, taller_id, fecha_sesion) DO NOTHING
                 RETURNING id, fecha_sesion, created_at`,
                [alumno.id, taller_id, fecha, req.user.id]
            );

            if (insertResult.rows.length === 0) {
                return res.status(409).json({
                    error: 'Asistencia duplicada',
                    message: 'La asistencia ya fue registrada para esta sesión'
                });
            }

            res.json({
                message: 'Asistencia registrada exitosamente',
                data: {
                    asistencia: insertResult.rows[0],
                    alumno
                }
            });

        } catch (error) {
            console.error('❌ Error al registrar asistencia:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al registrar la asistencia'
            });
        }
    }
);

// @route   GET /api/admin/asistencias
// @desc    Listar asistencias por taller y sesión
// @access  Private - Admin
router.get('/asistencias',
    authenticateToken,
    authorize('admin'),
    async (req, res) => {
        try {
            const { taller_id, fecha_sesion } = req.query;

            if (!taller_id) {
                return res.status(400).json({
                    error: 'Parametro requerido',
                    message: 'taller_id es obligatorio'
                });
            }

            const fecha = fecha_sesion || new Date().toISOString().slice(0, 10);

            const result = await query(
                `SELECT
                    a.id,
                    a.fecha_sesion,
                    a.created_at,
                    pa.numero_control,
                    pa.nombre,
                    pa.apellido_paterno,
                    pa.apellido_materno,
                    pa.grupo,
                    pa.semestre,
                    t.nombre as taller_nombre
                 FROM asistencias a
                 INNER JOIN perfiles_alumno pa ON a.alumno_id = pa.id
                 INNER JOIN talleres t ON a.taller_id = t.id
                 WHERE a.taller_id = $1 AND a.fecha_sesion = $2
                 ORDER BY a.created_at DESC`,
                [taller_id, fecha]
            );

            res.json({
                message: 'Asistencias obtenidas exitosamente',
                data: result.rows
            });

        } catch (error) {
            console.error('❌ Error al obtener asistencias:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener las asistencias'
            });
        }
    }
);

export default router;