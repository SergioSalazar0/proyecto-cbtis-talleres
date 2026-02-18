import express from 'express';
import AuthController from '../controllers/authController.js';
import { 
    validateLogin, 
    validateRegister, 
    validateCompleteProfile, 
    validatePasswordChange 
} from '../middlewares/validation.js';
import { authenticateToken, authorize } from '../middlewares/auth.js';

const router = express.Router();

/**
 * Rutas de autenticación
 * 
 * Fundamentos:
 * - Endpoints públicos para login/register
 * - Endpoints protegidos para operaciones autenticadas
 * - Validación específica para cada endpoint
 * - Rate limiting aplicado en server.js
 */

// @route   POST /api/auth/login
// @desc    Iniciar sesión
// @access  Public
router.post('/login', validateLogin, AuthController.login);

// @route   POST /api/auth/register
// @desc    Registrar nuevo alumno
// @access  Public
router.post('/register', validateRegister, AuthController.register);

// @route   GET /api/auth/verify
// @desc    Verificar token válido
// @access  Private
router.get('/verify', authenticateToken, AuthController.verifyToken);

// @route   POST /api/auth/refresh
// @desc    Renovar token JWT
// @access  Private
router.post('/refresh', authenticateToken, AuthController.refreshToken);

// @route   PUT /api/auth/change-password
// @desc    Cambiar contraseña
// @access  Private
router.put('/change-password', 
    authenticateToken, 
    validatePasswordChange, 
    AuthController.changePassword
);

// @route   POST /api/auth/logout
// @desc    Cerrar sesión
// @access  Private
router.post('/logout', authenticateToken, AuthController.logout);

// @route   GET /api/auth/profile
// @desc    Obtener perfil del usuario autenticado
// @access  Private
router.get('/profile', authenticateToken, AuthController.getProfile);

// @route   PUT /api/auth/profile
// @desc    Actualizar perfil del usuario autenticado
// @access  Private
router.put('/profile', authenticateToken, AuthController.updateProfile);

// @route   PUT /api/auth/complete-profile
// @desc    Completar perfil de alumno después del registro básico
// @access  Private - Solo alumnos
router.put('/complete-profile', 
    authenticateToken, 
    authorize('alumno'), 
    validateCompleteProfile, 
    AuthController.completeProfile
);

export default router;