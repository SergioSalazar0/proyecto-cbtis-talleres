import { body, param, query as expressQuery, validationResult } from 'express-validator';

/**
 * Middleware para manejar errores de validación
 * 
 * Fundamentos:
 * - Centraliza el manejo de errores de validación
 * - Proporciona mensajes de error claros y estructurados
 * - Evita código repetitivo en controladores
 */
export const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map(error => ({
            field: error.path || error.param,
            message: error.msg,
            value: error.value,
            location: error.location
        }));

        return res.status(400).json({
            error: 'Error de validación',
            message: 'Los datos proporcionados no son válidos',
            details: formattedErrors
        });
    }
    
    next();
};

/**
 * Validaciones para autenticación
 */
export const validateLogin = [
    body('email')
        .isEmail()
        .withMessage('Debe ser un email válido')
        .normalizeEmail()
        .trim(),
    
    body('password')
        .isLength({ min: 6 })
        .withMessage('La contraseña debe tener al menos 6 caracteres')
        .trim(),
    
    handleValidationErrors
];

export const validateRegister = [
    body('email')
        .isEmail()
        .withMessage('Debe ser un email válido')
        .normalizeEmail()
        .trim(),
    
    body('password')
        .isLength({ min: 6 })
        .withMessage('La contraseña debe tener al menos 6 caracteres')
        .trim(),

    body('numero_control')
        .isLength({ min: 6, max: 50 })
        .withMessage('El número de control debe tener entre 6 y 50 caracteres')
        .matches(/^[a-zA-Z0-9]+$/)
        .withMessage('El número de control solo puede contener letras y números')
        .trim(),
    
    handleValidationErrors
];

export const validateCompleteProfile = [
    body('nombre')
        .isLength({ min: 2, max: 100 })
        .withMessage('El nombre debe tener entre 2 y 100 caracteres')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
        .withMessage('El nombre solo puede contener letras y espacios')
        .trim(),
    
    // Acepta "apellidos" como un solo campo (frontend lo divide en el backend)
    body('apellidos')
        .isLength({ min: 2, max: 200 })
        .withMessage('Los apellidos deben tener entre 2 y 200 caracteres')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
        .withMessage('Los apellidos solo pueden contener letras y espacios')
        .trim(),
    
    body('numero_control')
        .isLength({ min: 6, max: 50 })
        .withMessage('El número de control debe tener entre 6 y 50 caracteres')
        .matches(/^[a-zA-Z0-9]+$/)
        .withMessage('El número de control solo puede contener letras y números')
        .trim(),
    
    body('grupo')
        .optional()
        .isLength({ min: 1, max: 50 })
        .withMessage('El grupo debe tener entre 1 y 50 caracteres')
        .matches(/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]+$/)
        .withMessage('El grupo solo puede contener letras, números y espacios')
        .trim(),
    
    body('semestre')
        .optional()
        .isLength({ min: 1, max: 10 })
        .withMessage('El semestre debe tener entre 1 y 10 caracteres')
        .trim(),
    
    body('telefono')
        .optional({ nullable: true, checkFalsy: true })
        .matches(/^[\d\s\-\+\(\)]{10,20}$/)
        .withMessage('El teléfono debe ser un número válido de 10-20 dígitos')
        .trim(),
    
    body('fecha_nacimiento')
        .optional({ nullable: true, checkFalsy: true })
        .isISO8601()
        .withMessage('La fecha de nacimiento debe ser una fecha válida (YYYY-MM-DD)')
        .custom((value) => {
            if (value && value.trim() !== '') {
                const date = new Date(value);
                const now = new Date();
                const age = Math.floor((now - date) / (365.25 * 24 * 60 * 60 * 1000));
                
                if (age < 14 || age > 25) {
                    throw new Error('La edad debe estar entre 14 y 25 años');
                }
            }
            return true;
        }),
    
    handleValidationErrors
];

/**
 * Validaciones para perfil de alumno
 */
export const validateAlumnoProfile = [
    body('nombre')
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage('El nombre debe tener entre 2 y 100 caracteres')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
        .withMessage('El nombre solo puede contener letras y espacios')
        .trim(),
    
    body('apellido_paterno')
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage('El apellido paterno debe tener entre 2 y 100 caracteres')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
        .withMessage('El apellido paterno solo puede contener letras y espacios')
        .trim(),
    
    body('apellido_materno')
        .optional()
        .isLength({ max: 100 })
        .withMessage('El apellido materno no puede exceder 100 caracteres')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]*$/)
        .withMessage('El apellido materno solo puede contener letras y espacios')
        .trim(),
    
    body('fecha_nacimiento')
        .optional()
        .isISO8601()
        .withMessage('La fecha de nacimiento debe ser una fecha válida (YYYY-MM-DD)')
        .custom((value) => {
            const date = new Date(value);
            const now = new Date();
            const age = Math.floor((now - date) / (365.25 * 24 * 60 * 60 * 1000));
            
            if (age < 14 || age > 25) {
                throw new Error('La edad debe estar entre 14 y 25 años');
            }
            return true;
        }),
    
    body('telefono')
        .optional()
        .matches(/^[\d\s\-\+\(\)]{10,20}$/)
        .withMessage('El teléfono debe ser un número válido de 10-20 dígitos')
        .trim(),
    
    body('grupo')
        .optional()
        .isLength({ max: 20 })
        .withMessage('El grupo no puede exceder 20 caracteres')
        .matches(/^[a-zA-Z0-9\-\s]*$/)
        .withMessage('El grupo solo puede contener letras, números, guiones y espacios')
        .trim(),
    
    body('semestre')
        .optional()
        .isIn(['1', '2', '3', '4', '5', '6'])
        .withMessage('El semestre debe ser un número del 1 al 6'),
    
    body('direccion')
        .optional()
        .isLength({ max: 500 })
        .withMessage('La dirección no puede exceder 500 caracteres')
        .trim(),
    
    handleValidationErrors
];

/**
 * Validaciones para información de emergencia
 */
export const validateEmergencyInfo = [
    body('contacto_emergencia_nombre')
        .isLength({ min: 2, max: 150 })
        .withMessage('El nombre del contacto debe tener entre 2 y 150 caracteres')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
        .withMessage('El nombre del contacto solo puede contener letras y espacios')
        .trim(),
    
    body('contacto_emergencia_telefono')
        .matches(/^[\d\s\-\+\(\)]{10,20}$/)
        .withMessage('El teléfono de emergencia debe ser un número válido de 10-20 dígitos')
        .trim(),
    
    body('contacto_emergencia_relacion')
        .isLength({ min: 2, max: 50 })
        .withMessage('La relación debe tener entre 2 y 50 caracteres')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
        .withMessage('La relación solo puede contener letras y espacios')
        .trim(),
    
    body('tipo_sangre')
        .optional()
        .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
        .withMessage('El tipo de sangre debe ser válido (A+, A-, B+, B-, AB+, AB-, O+, O-)'),
    
    body('alergias')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Las alergias no pueden exceder 1000 caracteres')
        .trim(),
    
    body('medicamentos')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Los medicamentos no pueden exceder 1000 caracteres')
        .trim(),
    
    body('condiciones_medicas')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Las condiciones médicas no pueden exceder 1000 caracteres')
        .trim(),
    
    body('seguro_medico')
        .optional()
        .isLength({ max: 100 })
        .withMessage('El seguro médico no puede exceder 100 caracteres')
        .trim(),
    
    body('numero_seguro')
        .optional()
        .isLength({ max: 50 })
        .withMessage('El número de seguro no puede exceder 50 caracteres')
        .matches(/^[a-zA-Z0-9\-]*$/)
        .withMessage('El número de seguro solo puede contener letras, números y guiones')
        .trim(),
    
    handleValidationErrors
];

/**
 * Validaciones para avisos
 */
export const validateAviso = [
    body('taller_id')
        .isUUID()
        .withMessage('El ID del taller debe ser un UUID válido'),

    body('titulo')
        .isLength({ min: 5, max: 200 })
        .withMessage('El título debe tener entre 5 y 200 caracteres')
        .trim(),
    
    body('contenido')
        .isLength({ min: 10, max: 2000 })
        .withMessage('El contenido debe tener entre 10 y 2000 caracteres')
        .trim(),
    
    body('importante')
        .optional()
        .isBoolean()
        .withMessage('El campo importante debe ser verdadero o falso'),
    
    body('fecha_expiracion')
        .optional({ nullable: true, checkFalsy: true })
        .isISO8601()
        .withMessage('La fecha de expiración debe ser una fecha válida (YYYY-MM-DD)')
        .custom((value) => {
            if (new Date(value) <= new Date()) {
                throw new Error('La fecha de expiración debe ser posterior a la fecha actual');
            }
            return true;
        }),
    
    handleValidationErrors
];

/**
 * Validaciones para fechas importantes
 */
export const validateFechaImportante = [
    body('titulo')
        .isLength({ min: 5, max: 200 })
        .withMessage('El título debe tener entre 5 y 200 caracteres')
        .trim(),
    
    body('descripcion')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('La descripción no puede exceder 1000 caracteres')
        .trim(),
    
    body('fecha_evento')
        .isISO8601()
        .withMessage('La fecha del evento debe ser una fecha válida (YYYY-MM-DD)')
        .custom((value) => {
            if (new Date(value) <= new Date()) {
                throw new Error('La fecha del evento debe ser posterior a la fecha actual');
            }
            return true;
        }),
    
    body('tipo_evento')
        .optional()
        .isIn(['evento', 'examen', 'entrega', 'competencia', 'presentacion', 'reunion'])
        .withMessage('El tipo de evento debe ser: evento, examen, entrega, competencia, presentacion o reunion'),
    
    handleValidationErrors
];

/**
 * Validaciones para inscripciones
 */
export const validateInscripcion = [
    body('taller_id')
        .isUUID()
        .withMessage('El ID del taller debe ser un UUID válido'),
    
    body('comentarios')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Los comentarios no pueden exceder 500 caracteres')
        .trim(),
    
    handleValidationErrors
];

/**
 * Validaciones para parámetros UUID
 */
export const validateUUIDParam = (paramName = 'id') => [
    param(paramName)
        .isUUID()
        .withMessage(`El parámetro ${paramName} debe ser un UUID válido`),
    
    handleValidationErrors
];

/**
 * Validaciones para queries de búsqueda
 */
export const validateSearchQuery = [
    expressQuery('search')
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage('El término de búsqueda debe tener entre 2 y 100 caracteres')
        .trim(),
    
    expressQuery('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('El límite debe ser un número entre 1 y 100'),
    
    expressQuery('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('El offset debe ser un número mayor o igual a 0'),
    
    expressQuery('sort')
        .optional()
        .isIn(['nombre', 'fecha', 'categoria', 'created_at'])
        .withMessage('El campo de ordenamiento debe ser: nombre, fecha, categoria o created_at'),
    
    expressQuery('order')
        .optional()
        .isIn(['ASC', 'DESC', 'asc', 'desc'])
        .withMessage('El orden debe ser ASC o DESC'),
    
    handleValidationErrors
];

/**
 * Validación personalizada para verificar edad mínima
 */
export const validateAge = (minAge = 14) => {
    return body('fecha_nacimiento')
        .custom((value) => {
            const birthDate = new Date(value);
            const today = new Date();
            const age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
            
            if (age < minAge) {
                throw new Error(`Debes tener al menos ${minAge} años`);
            }
            return true;
        });
};

/**
 * Validación para cambio de contraseña
 */
export const validatePasswordChange = [
    body('currentPassword')
        .isLength({ min: 1 })
        .withMessage('La contraseña actual es requerida'),
    
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('La nueva contraseña debe tener al menos 8 caracteres')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('La nueva contraseña debe contener al menos una mayúscula, una minúscula y un número'),
    
    body('confirmNewPassword')
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('La confirmación de contraseña no coincide');
            }
            return true;
        }),
    
    handleValidationErrors
];

/**
 * Sanitización de strings para prevenir XSS
 */
export const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    
    return str
        .replace(/[<>]/g, '') // Remover < y >
        .replace(/javascript:/gi, '') // Remover javascript:
        .replace(/on\w+=/gi, '') // Remover event handlers
        .trim();
};

/**
 * Middleware personalizado para sanitizar todos los strings del request
 */
export const sanitizeRequest = (req, res, next) => {
    const sanitizeObject = (obj) => {
        for (let key in obj) {
            if (typeof obj[key] === 'string') {
                obj[key] = sanitizeString(obj[key]);
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitizeObject(obj[key]);
            }
        }
    };
    
    if (req.body) sanitizeObject(req.body);
    if (req.query) sanitizeObject(req.query);
    if (req.params) sanitizeObject(req.params);
    
    next();
};