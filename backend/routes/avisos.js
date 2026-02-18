import express from 'express';
import AvisoController from '../controllers/avisoController.js';
import { 
    authenticateToken, 
    authorize, 
    authorizeInstructorTaller,
    authorizeAlumnoAccess
} from '../middlewares/auth.js';
import { 
    validateAviso,
    validateUUIDParam,
    validateSearchQuery,
    sanitizeRequest
} from '../middlewares/validation.js';

const router = express.Router();

/**
 * Rutas de avisos
 * 
 * Fundamentos:
 * - Avisos de instructores hacia alumnos de sus talleres
 * - Control de acceso por instructor y taller
 * - Endpoints específicos para alumnos e instructores
 * - Validación de contenido y fechas
 */

// @route   GET /api/avisos/importantes
// @desc    Obtener avisos importantes activos
// @access  Public (para mostrar avisos importantes generales)
router.get('/importantes', AvisoController.getAvisosImportantes);

// @route   GET /api/avisos/mis-avisos
// @desc    Obtener avisos del instructor autenticado
// @access  Private - Instructor
router.get('/mis-avisos', 
    authenticateToken, 
    authorize('instructor'), 
    validateSearchQuery,
    AvisoController.getMisAvisos
);

// @route   GET /api/avisos/alumno
// @desc    Obtener avisos para el alumno autenticado
// @access  Private - Alumno
router.get('/alumno', 
    authenticateToken, 
    authorizeAlumnoAccess,
    AvisoController.getAvisosParaAlumno
);

// @route   GET /api/avisos/proximos-expirar
// @desc    Obtener avisos próximos a expirar
// @access  Private - Instructor, Admin
router.get('/proximos-expirar', 
    authenticateToken, 
    authorize('instructor', 'admin'),
    AvisoController.getProximosAExpirar
);

// @route   GET /api/avisos/estadisticas
// @desc    Obtener estadísticas de avisos
// @access  Private - Instructor, Admin
router.get('/estadisticas', 
    authenticateToken, 
    authorize('instructor', 'admin'),
    AvisoController.getEstadisticas
);

// @route   GET /api/avisos/search
// @desc    Buscar avisos por término
// @access  Private
router.get('/search', 
    authenticateToken,
    validateSearchQuery,
    AvisoController.searchAvisos
);

// @route   GET /api/avisos/taller/:tallerId
// @desc    Obtener avisos de un taller específico
// @access  Private - Admin, Instructor del taller, Alumnos inscritos
router.get('/taller/:tallerId', 
    validateUUIDParam('tallerId'),
    authenticateToken,
    validateSearchQuery,
    AvisoController.getAvisosByTaller
);

// @route   GET /api/avisos/:id
// @desc    Obtener aviso por ID
// @access  Private - Admin, Instructor propietario, Alumnos del taller
router.get('/:id', 
    validateUUIDParam('id'),
    authenticateToken,
    AvisoController.getAvisoById
);

// @route   POST /api/avisos
// @desc    Crear nuevo aviso
// @access  Private - Instructor
router.post('/', 
    authenticateToken, 
    authorize('instructor'),
    validateAviso,
    sanitizeRequest,
    AvisoController.createAviso
);

// @route   PUT /api/avisos/:id
// @desc    Actualizar aviso
// @access  Private - Instructor propietario, Admin
router.put('/:id', 
    validateUUIDParam('id'),
    authenticateToken, 
    authorize('instructor', 'admin'),
    validateAviso,
    sanitizeRequest,
    AvisoController.updateAviso
);

// @route   DELETE /api/avisos/:id
// @desc    Eliminar aviso (soft delete)
// @access  Private - Instructor propietario, Admin
router.delete('/:id', 
    validateUUIDParam('id'),
    authenticateToken, 
    authorize('instructor', 'admin'),
    AvisoController.deleteAviso
);

export default router;