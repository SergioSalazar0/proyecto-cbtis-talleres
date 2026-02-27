import express from 'express';
import TallerController from '../controllers/tallerController.js';
import { 
    authenticateToken, 
    authorize, 
    authorizeInstructorTaller,
    authorizeAlumnoAccess
} from '../middlewares/auth.js';
import { query } from '../database/config-db.js';
import { 
    validateUUIDParam,
    validateSearchQuery,
    sanitizeRequest
} from '../middlewares/validation.js';

const router = express.Router();
let cacheCompatSesionAsistencia = {
    checked: false,
    enabled: false
};

async function soportaSesionAsistenciaEnAsistencias() {
    if (cacheCompatSesionAsistencia.checked) {
        return cacheCompatSesionAsistencia.enabled;
    }

    try {
        const result = await query(
            `SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'asistencias'
               AND column_name = 'sesion_asistencia_id'
             LIMIT 1`
        );

        cacheCompatSesionAsistencia = {
            checked: true,
            enabled: result.rows.length > 0
        };
    } catch (_) {
        cacheCompatSesionAsistencia = {
            checked: true,
            enabled: false
        };
    }

    return cacheCompatSesionAsistencia.enabled;
}

function extraerNumeroControl(valorEntrada) {
    if (!valorEntrada) return '';

    const valor = String(valorEntrada).trim();

    const matchFormatoSistema = valor.match(/^CBTIS258\|(.+)$/i);
    if (matchFormatoSistema?.[1]) {
        return matchFormatoSistema[1].trim();
    }

    if (valor.startsWith('{') && valor.endsWith('}')) {
        try {
            const payload = JSON.parse(valor);
            if (payload?.numero_control) {
                return String(payload.numero_control).trim();
            }
        } catch (_) {
            // Ignorar errores de parseo y seguir con otras reglas
        }
    }

    const matchParametro = valor.match(/numero_control=([^&\s]+)/i);
    if (matchParametro?.[1]) {
        return decodeURIComponent(matchParametro[1]).trim();
    }

    if (valor.toUpperCase().startsWith('NC:')) {
        return valor.substring(3).trim();
    }

    return valor;
}

function mapSesionAsistencia(row) {
    return {
        id: row.id,
        fecha_sesion: row.fecha_sesion,
        registrados: Number(row.total_registrados || 0),
        estado: row.estado === 'activa' ? 'Activa' : 'Cerrada',
        created_at: row.created_at,
        updated_at: row.updated_at,
        closed_at: row.closed_at
    };
}

/**
 * Rutas de talleres
 * 
 * Fundamentos:
 * - Endpoints públicos para consultar talleres
 * - Endpoints protegidos según tipo de usuario
 * - Validación de parámetros UUID
 * - Control de acceso granular por taller
 */

// @route   GET /api/talleres
// @desc    Obtener todos los talleres (público para ver talleres disponibles)
// @access  Public
router.get('/', validateSearchQuery, TallerController.getTalleres);

// @route   GET /api/talleres/categoria/:categoria
// @desc    Obtener talleres por categoría
// @access  Public
router.get('/categoria/:categoria', TallerController.getTalleresByCategoria);

// @route   GET /api/talleres/disponibles
// @desc    Obtener talleres disponibles para inscripción (alumno)
// @access  Private - Alumno
router.get('/disponibles', 
    authenticateToken, 
    authorizeAlumnoAccess, 
    TallerController.getTalleresDisponibles
);

// @route   GET /api/talleres/mis-inscripciones
// @desc    Obtener inscripciones del alumno autenticado
// @access  Private - Alumno
router.get('/mis-inscripciones', 
    authenticateToken, 
    authorizeAlumnoAccess,
    TallerController.getMisInscripciones
);

// @route   GET /api/talleres/mis-talleres
// @desc    Obtener talleres del instructor autenticado
// @access  Private - Instructor
router.get('/mis-talleres', 
    authenticateToken, 
    authorize('instructor'), 
    TallerController.getMisTalleres
);

// @route   GET /api/talleres/estadisticas
// @desc    Obtener estadísticas de talleres
// @access  Private - Admin/Instructor
router.get('/estadisticas', 
    authenticateToken, 
    authorize('admin', 'instructor'), 
    TallerController.getEstadisticas
);

// @route   GET /api/talleres/:id
// @desc    Obtener taller por ID
// @access  Public
router.get('/:id', 
    validateUUIDParam('id'), 
    TallerController.getTallerById
);

// @route   POST /api/talleres
// @desc    Crear nuevo taller
// @access  Private - Admin
router.post('/', 
    authenticateToken, 
    authorize('admin'), 
    sanitizeRequest,
    TallerController.createTaller
);

// @route   PUT /api/talleres/:id
// @desc    Actualizar taller
// @access  Private - Admin o Instructor asignado
router.put('/:id', 
    validateUUIDParam('id'),
    authenticateToken, 
    authorize('admin', 'instructor'), 
    sanitizeRequest,
    TallerController.updateTaller
);

// @route   DELETE /api/talleres/:id
// @desc    Eliminar taller
// @access  Private - Admin
router.delete('/:id', 
    validateUUIDParam('id'),
    authenticateToken, 
    authorize('admin'), 
    TallerController.deleteTaller
);

// @route   GET /api/talleres/:id/alumnos
// @desc    Obtener alumnos inscritos en un taller
// @access  Private - Admin, Instructor del taller
router.get('/:id/alumnos', 
    validateUUIDParam('id'),
    authenticateToken, 
    authorize('admin', 'instructor'),
    validateSearchQuery,
    TallerController.getAlumnosInscritos
);

// @route   GET /api/talleres/:id/asistencias
// @desc    Obtener asistencias por taller y fecha
// @access  Private - Admin, Instructor del taller
router.get('/:id/asistencias',
    validateUUIDParam('id'),
    authenticateToken,
    authorizeInstructorTaller('id'),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { fecha_sesion, sesion_asistencia_id } = req.query;
            const fecha = fecha_sesion || new Date().toISOString().slice(0, 10);
            const usaSesionAsistencia = await soportaSesionAsistenciaEnAsistencias();

            let sql = `SELECT
                    a.id,
                    a.fecha_sesion,
                    a.created_at,`;

            if (usaSesionAsistencia) {
                sql += `
                    a.sesion_asistencia_id,`;
            } else {
                sql += `
                    NULL::uuid as sesion_asistencia_id,`;
            }

            sql += `
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
                 WHERE a.taller_id = $1 AND a.fecha_sesion = $2`;

            const params = [id, fecha];

            if (sesion_asistencia_id && usaSesionAsistencia) {
                sql += ' AND a.sesion_asistencia_id = $3';
                params.push(sesion_asistencia_id);
            }

            sql += ' ORDER BY pa.apellido_paterno, pa.apellido_materno, pa.nombre';

            const result = await query(
                sql,
                params
            );

            res.json({
                message: 'Asistencias obtenidas exitosamente',
                data: result.rows
            });

        } catch (error) {
            console.error('❌ Error al obtener asistencias del taller:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener las asistencias'
            });
        }
    }
);

// @route   POST /api/talleres/:id/asistencias
// @desc    Registrar asistencia por numero de control en un taller
// @access  Private - Admin, Instructor del taller
router.post('/:id/asistencias',
    validateUUIDParam('id'),
    authenticateToken,
    authorizeInstructorTaller('id'),
    sanitizeRequest,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { numero_control, fecha_sesion, sesion_asistencia_id } = req.body;
            const numeroControlNormalizado = extraerNumeroControl(numero_control);

            if (!numeroControlNormalizado) {
                return res.status(400).json({
                    error: 'Datos incompletos',
                    message: 'numero_control es obligatorio'
                });
            }

            const fecha = fecha_sesion || new Date().toISOString().slice(0, 10);
            const usaSesionAsistencia = await soportaSesionAsistenciaEnAsistencias();

            if (sesion_asistencia_id && usaSesionAsistencia) {
                const sesionValida = await query(
                    `SELECT id FROM sesiones_asistencia
                     WHERE id = $1 AND taller_id = $2 AND fecha_sesion = $3`,
                    [sesion_asistencia_id, id, fecha]
                );

                if (sesionValida.rows.length === 0) {
                    return res.status(400).json({
                        error: 'Sesión inválida',
                        message: 'La sesión de asistencia no corresponde al taller o fecha seleccionados'
                    });
                }
            }

            const alumnoResult = await query(
                `SELECT id, nombre, apellido_paterno, apellido_materno, numero_control, grupo, semestre
                 FROM perfiles_alumno
                 WHERE numero_control = $1`,
                [numeroControlNormalizado]
            );

            if (alumnoResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Alumno no encontrado',
                    message: 'No existe un alumno con ese número de control'
                });
            }

            const alumno = alumnoResult.rows[0];

            const inscripcion = await query(
                `SELECT id FROM inscripciones
                 WHERE alumno_id = $1 AND taller_id = $2 AND estado = 'activa'`,
                [alumno.id, id]
            );

            if (inscripcion.rows.length === 0) {
                return res.status(400).json({
                    error: 'Alumno no inscrito',
                    message: 'El alumno no está inscrito en este taller'
                });
            }

            let insertResult;

            if (sesion_asistencia_id && usaSesionAsistencia) {
                insertResult = await query(
                    `INSERT INTO asistencias (alumno_id, taller_id, fecha_sesion, registrado_por, sesion_asistencia_id)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (alumno_id, taller_id, fecha_sesion, sesion_asistencia_id)
                     WHERE sesion_asistencia_id IS NOT NULL DO NOTHING
                     RETURNING id, fecha_sesion, created_at`,
                    [alumno.id, id, fecha, req.user.id, sesion_asistencia_id]
                );
            } else {
                insertResult = await query(
                    `INSERT INTO asistencias (alumno_id, taller_id, fecha_sesion, registrado_por)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (alumno_id, taller_id, fecha_sesion) DO NOTHING
                     RETURNING id, fecha_sesion, created_at`,
                    [alumno.id, id, fecha, req.user.id]
                );
            }

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
            console.error('❌ Error al registrar asistencia en taller:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al registrar la asistencia'
            });
        }
    }
);

// @route   GET /api/talleres/:id/sesiones-asistencia
// @desc    Obtener historial de sesiones de asistencia por taller
// @access  Private - Admin, Instructor del taller
router.get('/:id/sesiones-asistencia',
    validateUUIDParam('id'),
    authenticateToken,
    authorizeInstructorTaller('id'),
    async (req, res) => {
        try {
            const { id } = req.params;

            const result = await query(
                `SELECT id, fecha_sesion, estado, total_registrados, created_at, updated_at, closed_at
                 FROM sesiones_asistencia
                 WHERE taller_id = $1
                 ORDER BY created_at DESC`,
                [id]
            );

            res.json({
                message: 'Sesiones de asistencia obtenidas exitosamente',
                data: result.rows.map(mapSesionAsistencia)
            });
        } catch (error) {
            console.error('❌ Error al obtener sesiones de asistencia:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener historial de sesiones'
            });
        }
    }
);

// @route   POST /api/talleres/:id/sesiones-asistencia
// @desc    Crear nueva sesión de asistencia
// @access  Private - Admin, Instructor del taller
router.post('/:id/sesiones-asistencia',
    validateUUIDParam('id'),
    authenticateToken,
    authorizeInstructorTaller('id'),
    sanitizeRequest,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { fecha_sesion } = req.body;
            const fecha = fecha_sesion || new Date().toISOString().slice(0, 10);

            const sesionExistente = await query(
                `SELECT id, fecha_sesion, estado, total_registrados, created_at, updated_at, closed_at
                 FROM sesiones_asistencia
                 WHERE taller_id = $1 AND fecha_sesion = $2
                 ORDER BY created_at ASC
                 LIMIT 1`,
                [id, fecha]
            );

            if (sesionExistente.rows.length > 0) {
                const actual = sesionExistente.rows[0];

                if (actual.estado !== 'activa') {
                    const reabierta = await query(
                        `UPDATE sesiones_asistencia
                         SET estado = 'activa',
                             updated_at = CURRENT_TIMESTAMP
                         WHERE id = $1
                         RETURNING id, fecha_sesion, estado, total_registrados, created_at, updated_at, closed_at`,
                        [actual.id]
                    );

                    return res.status(200).json({
                        message: 'Ya existía una sesión para esta fecha y fue reabierta',
                        data: mapSesionAsistencia(reabierta.rows[0])
                    });
                }

                return res.status(200).json({
                    message: 'Ya existe una sesión activa para esta fecha',
                    data: mapSesionAsistencia(actual)
                });
            }

            const insertResult = await query(
                `INSERT INTO sesiones_asistencia (taller_id, instructor_usuario_id, fecha_sesion, estado, total_registrados)
                 VALUES ($1, $2, $3, 'activa', 0)
                 RETURNING id, fecha_sesion, estado, total_registrados, created_at, updated_at, closed_at`,
                [id, req.user.id, fecha]
            );

            res.status(201).json({
                message: 'Sesión de asistencia creada exitosamente',
                data: mapSesionAsistencia(insertResult.rows[0])
            });
        } catch (error) {
            console.error('❌ Error al crear sesión de asistencia:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al crear sesión de asistencia'
            });
        }
    }
);

// @route   PUT /api/talleres/:id/sesiones-asistencia/:sesionId
// @desc    Actualizar sesión de asistencia (estado y/o total)
// @access  Private - Admin, Instructor del taller
router.put('/:id/sesiones-asistencia/:sesionId',
    validateUUIDParam('id'),
    validateUUIDParam('sesionId'),
    authenticateToken,
    authorizeInstructorTaller('id'),
    sanitizeRequest,
    async (req, res) => {
        try {
            const { id, sesionId } = req.params;
            const { estado, total_registrados } = req.body;

            if (!estado && total_registrados === undefined) {
                return res.status(400).json({
                    error: 'Datos incompletos',
                    message: 'Debes enviar estado o total_registrados'
                });
            }

            const estadoNormalizado = estado ? String(estado).toLowerCase() : null;
            if (estadoNormalizado && !['activa', 'cerrada'].includes(estadoNormalizado)) {
                return res.status(400).json({
                    error: 'Estado inválido',
                    message: 'estado debe ser activa o cerrada'
                });
            }

            const totalNormalizado = total_registrados === undefined
                ? null
                : Math.max(0, parseInt(total_registrados, 10) || 0);

            const result = await query(
                `UPDATE sesiones_asistencia
                 SET estado = COALESCE($1, estado),
                     total_registrados = COALESCE($2, total_registrados),
                     closed_at = CASE
                         WHEN COALESCE($1, estado) = 'cerrada' THEN COALESCE(closed_at, CURRENT_TIMESTAMP)
                         ELSE closed_at
                     END,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3 AND taller_id = $4
                 RETURNING id, fecha_sesion, estado, total_registrados, created_at, updated_at, closed_at`,
                [estadoNormalizado, totalNormalizado, sesionId, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: 'Sesión no encontrada',
                    message: 'No existe la sesión de asistencia especificada'
                });
            }

            res.json({
                message: 'Sesión de asistencia actualizada exitosamente',
                data: mapSesionAsistencia(result.rows[0])
            });
        } catch (error) {
            console.error('❌ Error al actualizar sesión de asistencia:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al actualizar sesión de asistencia'
            });
        }
    }
);

// @route   DELETE /api/talleres/:id/sesiones-asistencia/:sesionId
// @desc    Eliminar sesión de asistencia
// @access  Private - Admin, Instructor del taller
router.delete('/:id/sesiones-asistencia/:sesionId',
    validateUUIDParam('id'),
    validateUUIDParam('sesionId'),
    authenticateToken,
    authorizeInstructorTaller('id'),
    async (req, res) => {
        try {
            const { id, sesionId } = req.params;

            const usaSesionAsistencia = await soportaSesionAsistenciaEnAsistencias();

            const sesionResult = await query(
                `SELECT id, fecha_sesion, estado, total_registrados, created_at, updated_at, closed_at
                 FROM sesiones_asistencia
                 WHERE id = $1 AND taller_id = $2`,
                [sesionId, id]
            );

            if (sesionResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Sesión no encontrada',
                    message: 'No existe la sesión de asistencia especificada'
                });
            }

            const sesion = sesionResult.rows[0];

            if (usaSesionAsistencia) {
                await query(
                    `DELETE FROM asistencias
                     WHERE sesion_asistencia_id = $1`,
                    [sesionId]
                );
            } else {
                await query(
                    `DELETE FROM asistencias
                     WHERE taller_id = $1 AND fecha_sesion = $2`,
                    [id, sesion.fecha_sesion]
                );
            }

            const result = await query(
                `DELETE FROM sesiones_asistencia
                 WHERE id = $1 AND taller_id = $2
                 RETURNING id, fecha_sesion, estado, total_registrados, created_at, updated_at, closed_at`,
                [sesionId, id]
            );

            res.json({
                message: 'Sesión y asistencias de ese día eliminadas exitosamente',
                data: mapSesionAsistencia(result.rows[0])
            });
        } catch (error) {
            console.error('❌ Error al eliminar sesión de asistencia:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al eliminar sesión de asistencia'
            });
        }
    }
);

// @route   POST /api/talleres/:id/sesiones-asistencia/:sesionId/incrementar
// @desc    Incrementar contador de registrados en una sesión activa
// @access  Private - Admin, Instructor del taller
router.post('/:id/sesiones-asistencia/:sesionId/incrementar',
    validateUUIDParam('id'),
    validateUUIDParam('sesionId'),
    authenticateToken,
    authorizeInstructorTaller('id'),
    async (req, res) => {
        try {
            const { id, sesionId } = req.params;

            const result = await query(
                `UPDATE sesiones_asistencia
                 SET total_registrados = total_registrados + 1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND taller_id = $2 AND estado = 'activa'
                 RETURNING id, fecha_sesion, estado, total_registrados, created_at, updated_at, closed_at`,
                [sesionId, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: 'Sesión no activa',
                    message: 'La sesión no existe o ya está cerrada'
                });
            }

            res.json({
                message: 'Contador de sesión incrementado exitosamente',
                data: mapSesionAsistencia(result.rows[0])
            });
        } catch (error) {
            console.error('❌ Error al incrementar sesión de asistencia:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al incrementar contador de sesión'
            });
        }
    }
);

// @route   POST /api/talleres/:id/inscripcion
// @desc    Inscribirse a un taller
// @access  Private - Alumno
router.post('/:id/inscripcion', 
    validateUUIDParam('id'),
    authenticateToken, 
    authorizeAlumnoAccess,
    sanitizeRequest,
    TallerController.inscribirseATaller
);

// @route   GET /api/talleres/:id/cupo
// @desc    Verificar cupo disponible de un taller
// @access  Public
router.get('/:id/cupo', 
    validateUUIDParam('id'),
    TallerController.verificarCupo
);

export default router;