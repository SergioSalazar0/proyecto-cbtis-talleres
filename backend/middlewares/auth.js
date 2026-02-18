import jwt from 'jsonwebtoken';
import { query } from '../database/config-db.js';

/**
 * Middleware de autenticación JWT
 * 
 * Fundamentos:
 * - Verifica que el token JWT sea válido
 * - Extrae información del usuario del token
 * - Permite el paso solo a usuarios autenticados
 * - Maneja diferentes formatos de autorización
 */
export const authenticateToken = async (req, res, next) => {
    try {
        // Obtener token del header Authorization
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.startsWith('Bearer ') 
            ? authHeader.substring(7) 
            : authHeader;

        if (!token) {
            return res.status(401).json({
                error: 'Token de acceso requerido',
                message: 'Debes proporcionar un token de autorización válido'
            });
        }

        // Verificar y decodificar el token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Verificar que el usuario sigue existiendo y activo
        const userResult = await query(
            'SELECT id, email, tipo_usuario, activo FROM usuarios WHERE id = $1',
            [decoded.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                error: 'Usuario no encontrado',
                message: 'El usuario asociado al token no existe'
            });
        }

        const user = userResult.rows[0];

        if (!user.activo) {
            return res.status(401).json({
                error: 'Usuario inactivo',
                message: 'Tu cuenta ha sido desactivada. Contacta al administrador'
            });
        }

        // Agregar información del usuario al request
        req.user = {
            id: user.id,
            email: user.email,
            tipo_usuario: user.tipo_usuario,
            activo: user.activo
        };

        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Token inválido',
                message: 'El token proporcionado no es válido'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expirado',
                message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente'
            });
        }

        console.error('Error en autenticación:', error);
        return res.status(500).json({
            error: 'Error interno',
            message: 'Error al verificar la autenticación'
        });
    }
};

/**
 * Middleware de autorización por tipo de usuario
 * @param {...string} allowedTypes - Tipos de usuario permitidos
 * @returns {Function} Middleware function
 * 
 * Uso: authorize('admin', 'instructor')
 */
export const authorize = (...allowedTypes) => {
    return (req, res, next) => {
        try {
            // Este middleware debe usarse después de authenticateToken
            if (!req.user) {
                return res.status(401).json({
                    error: 'Usuario no autenticado',
                    message: 'Debes estar autenticado para acceder a este recurso'
                });
            }

            // Verificar si el tipo de usuario está permitido
            if (!allowedTypes.includes(req.user.tipo_usuario)) {
                return res.status(403).json({
                    error: 'Acceso denegado',
                    message: `No tienes permisos para acceder a este recurso. Tipo requerido: ${allowedTypes.join(' o ')}`,
                    userType: req.user.tipo_usuario
                });
            }

            next();

        } catch (error) {
            console.error('Error en autorización:', error);
            return res.status(500).json({
                error: 'Error interno',
                message: 'Error al verificar los permisos'
            });
        }
    };
};

/**
 * Middleware para verificar que el usuario puede acceder a sus propios datos
 * o que es un administrador
 * @param {string} userIdParam - Nombre del parámetro que contiene el userId
 * @returns {Function} Middleware function
 */
export const authorizeOwnerOrAdmin = (userIdParam = 'userId') => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    error: 'Usuario no autenticado',
                    message: 'Debes estar autenticado para acceder a este recurso'
                });
            }

            const targetUserId = req.params[userIdParam] || req.body[userIdParam];
            
            // Permitir acceso si es admin
            if (req.user.tipo_usuario === 'admin') {
                return next();
            }

            // Permitir acceso si es el mismo usuario
            if (req.user.id === targetUserId) {
                return next();
            }

            return res.status(403).json({
                error: 'Acceso denegado',
                message: 'Solo puedes acceder a tu propia información'
            });

        } catch (error) {
            console.error('Error en autorización de propietario:', error);
            return res.status(500).json({
                error: 'Error interno',
                message: 'Error al verificar los permisos de propietario'
            });
        }
    };
};

/**
 * Middleware para verificar que un instructor puede acceder solo a su taller
 * @param {string} tallerIdParam - Nombre del parámetro que contiene el tallerId
 * @returns {Function} Middleware function
 */
export const authorizeInstructorTaller = (tallerIdParam = 'tallerId') => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    error: 'Usuario no autenticado',
                    message: 'Debes estar autenticado para acceder a este recurso'
                });
            }

            // Permitir acceso si es admin
            if (req.user.tipo_usuario === 'admin') {
                return next();
            }

            // Verificar que es instructor
            if (req.user.tipo_usuario !== 'instructor') {
                return res.status(403).json({
                    error: 'Acceso denegado',
                    message: 'Solo los instructores pueden acceder a esta funcionalidad'
                });
            }

            const tallerId = req.params[tallerIdParam] || req.body[tallerIdParam];

            if (!tallerId) {
                return res.status(400).json({
                    error: 'Parámetro requerido',
                    message: 'Se requiere el ID del taller'
                });
            }

            // Verificar que el instructor está asignado a este taller
            const tallerResult = await query(
                `SELECT t.id, t.nombre, pi.usuario_id
                 FROM talleres t
                 INNER JOIN perfiles_instructor pi ON t.instructor_id = pi.id
                 WHERE t.id = $1 AND pi.usuario_id = $2`,
                [tallerId, req.user.id]
            );

            if (tallerResult.rows.length === 0) {
                return res.status(403).json({
                    error: 'Acceso denegado',
                    message: 'No tienes permisos para acceder a este taller'
                });
            }

            // Agregar información del taller al request
            req.taller = tallerResult.rows[0];
            next();

        } catch (error) {
            console.error('Error en autorización de instructor:', error);
            return res.status(500).json({
                error: 'Error interno',
                message: 'Error al verificar los permisos del instructor'
            });
        }
    };
};

/**
 * Middleware para verificar que un alumno puede acceder solo a su información
 * o a talleres en los que está inscrito
 */
export const authorizeAlumnoAccess = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                error: 'Usuario no autenticado',
                message: 'Debes estar autenticado para acceder a este recurso'
            });
        }

        // Permitir acceso si es admin o instructor
        if (['admin', 'instructor'].includes(req.user.tipo_usuario)) {
            return next();
        }

        // Verificar que es alumno
        if (req.user.tipo_usuario !== 'alumno') {
            return res.status(403).json({
                error: 'Acceso denegado',
                message: 'Solo los alumnos pueden acceder a esta funcionalidad'
            });
        }

        // Obtener el perfil del alumno
        const alumnoResult = await query(
            'SELECT id FROM perfiles_alumno WHERE usuario_id = $1',
            [req.user.id]
        );

        if (alumnoResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Perfil no encontrado',
                message: 'No se encontró el perfil de alumno'
            });
        }

        // Agregar información del alumno al request
        req.alumno = { id: alumnoResult.rows[0].id };
        next();

    } catch (error) {
        console.error('Error en autorización de alumno:', error);
        return res.status(500).json({
            error: 'Error interno',
            message: 'Error al verificar los permisos del alumno'
        });
    }
};

/**
 * Middleware opcional para autenticación
 * Permite el acceso sin token, pero si hay token lo valida
 */
export const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.startsWith('Bearer ') 
            ? authHeader.substring(7) 
            : authHeader;

        if (!token) {
            // No hay token, continuar sin autenticación
            return next();
        }

        // Hay token, validarlo
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const userResult = await query(
            'SELECT id, email, tipo_usuario, activo FROM usuarios WHERE id = $1',
            [decoded.userId]
        );

        if (userResult.rows.length > 0 && userResult.rows[0].activo) {
            const user = userResult.rows[0];
            req.user = {
                id: user.id,
                email: user.email,
                tipo_usuario: user.tipo_usuario,
                activo: user.activo
            };
        }

        next();

    } catch (error) {
        // En caso de error con el token, continuar sin autenticación
        // pero loggear el error
        console.warn('Error en autenticación opcional:', error.message);
        next();
    }
};

/**
 * Middleware para generar y firmar JWT tokens
 * @param {Object} payload - Datos a incluir en el token
 * @param {string} expiresIn - Tiempo de expiración
 * @returns {string} JWT token
 */
export const generateToken = (payload, expiresIn = process.env.JWT_EXPIRES_IN || '24h') => {
    try {
        return jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn,
            issuer: 'talleres-cbtis258',
            subject: payload.userId,
            audience: 'talleres-cbtis258-users'
        });
    } catch (error) {
        console.error('Error al generar token:', error);
        throw new Error('Error al generar token de autenticación');
    }
};