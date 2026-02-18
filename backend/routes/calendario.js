import express from 'express';
import CalendarioController from '../controllers/calendarioController.js';
import { 
    authenticateToken, 
    authorize, 
    authorizeInstructorTaller,
    authorizeAlumnoAccess
} from '../middlewares/auth.js';
import { 
    validateFechaImportante,
    validateUUIDParam,
    validateSearchQuery,
    sanitizeRequest
} from '../middlewares/validation.js';

const router = express.Router();

/**
 * Rutas de calendario
 * 
 * Fundamentos:
 * - Gestión de fechas importantes y eventos
 * - Vistas de calendario mensual y por rangos
 * - Control de acceso por instructor y taller
 * - Eventos próximos para alumnos
 */

// @route   GET /api/calendario/eventos-hoy
// @desc    Obtener eventos de hoy
// @access  Public (eventos públicos) / Private (eventos específicos)
router.get('/eventos-hoy', CalendarioController.getEventosHoy);

// @route   GET /api/calendario/mis-fechas
// @desc    Obtener fechas importantes del instructor autenticado
// @access  Private - Instructor
router.get('/mis-fechas', 
    authenticateToken, 
    authorize('instructor'),
    validateSearchQuery,
    CalendarioController.getMisFechas
);

// @route   GET /api/calendario/eventos-proximos
// @desc    Obtener eventos próximos para el alumno autenticado
// @access  Private - Alumno
router.get('/eventos-proximos', 
    authenticateToken, 
    authorizeAlumnoAccess,
    CalendarioController.getEventosProximosAlumno
);

// @route   GET /api/calendario/mensual
// @desc    Obtener calendario mensual de un taller
// @access  Private - Admin, Instructor del taller, Alumnos inscritos
router.get('/mensual', 
    authenticateToken,
    CalendarioController.getCalendarioMensual
);

// @route   GET /api/calendario/rango
// @desc    Obtener eventos en un rango de fechas
// @access  Private
router.get('/rango', 
    authenticateToken,
    CalendarioController.getCalendarioRango
);

// @route   GET /api/calendario/estadisticas
// @desc    Obtener estadísticas de eventos
// @access  Private - Instructor, Admin
router.get('/estadisticas', 
    authenticateToken, 
    authorize('instructor', 'admin'),
    CalendarioController.getEstadisticas
);

// @route   GET /api/calendario/search
// @desc    Buscar eventos por término
// @access  Private
router.get('/search', 
    authenticateToken,
    validateSearchQuery,
    CalendarioController.searchEventos
);

// @route   GET /api/calendario/tipo/:tipo
// @desc    Obtener eventos por tipo
// @access  Private
router.get('/tipo/:tipo', 
    authenticateToken,
    validateSearchQuery,
    CalendarioController.getEventosPorTipo
);

// @route   GET /api/calendario/taller/:tallerId
// @desc    Obtener fechas importantes de un taller
// @access  Private - Admin, Instructor del taller, Alumnos inscritos
router.get('/taller/:tallerId', 
    validateUUIDParam('tallerId'),
    authenticateToken,
    validateSearchQuery,
    CalendarioController.getFechasByTaller
);

// @route   GET /api/calendario/:id
// @desc    Obtener fecha importante por ID
// @access  Private - Admin, Instructor propietario, Alumnos del taller
router.get('/:id', 
    validateUUIDParam('id'),
    authenticateToken,
    CalendarioController.getFechaById
);

// @route   POST /api/calendario
// @desc    Crear nueva fecha importante
// @access  Private - Instructor
router.post('/', 
    authenticateToken, 
    authorize('instructor'),
    validateFechaImportante,
    sanitizeRequest,
    CalendarioController.createFecha
);

// @route   PUT /api/calendario/:id
// @desc    Actualizar fecha importante
// @access  Private - Instructor propietario, Admin
router.put('/:id', 
    validateUUIDParam('id'),
    authenticateToken, 
    authorize('instructor', 'admin'),
    validateFechaImportante,
    sanitizeRequest,
    CalendarioController.updateFecha
);

// @route   DELETE /api/calendario/:id
// @desc    Eliminar fecha importante (soft delete)
// @access  Private - Instructor propietario, Admin
router.delete('/:id', 
    validateUUIDParam('id'),
    authenticateToken, 
    authorize('instructor', 'admin'),
    CalendarioController.deleteFecha
);

export default router;