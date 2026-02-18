import UserModel from '../models/User.js';
import { generateToken } from '../middlewares/auth.js';
import { query } from '../database/config-db.js';

/**
 * Controlador de autenticación
 * 
 * Fundamentos:
 * - Maneja login, registro y renovación de tokens
 * - Validaciones de seguridad y rate limiting
 * - Logs de actividad para auditoría
 * - Respuestas consistentes y seguras
 */

class AuthController {
    /**
     * Iniciar sesión
     */
    static async login(req, res) {
        try {
            const { email, password } = req.body;

            // Buscar usuario
            const user = await UserModel.findByEmail(email);
            
            if (!user) {
                return res.status(401).json({
                    error: 'Credenciales inválidas',
                    message: 'Email o contraseña incorrectos'
                });
            }

            // Verificar si el usuario está activo
            if (!user.activo) {
                return res.status(401).json({
                    error: 'Cuenta desactivada',
                    message: 'Tu cuenta ha sido desactivada. Contacta al administrador'
                });
            }

            // Verificar contraseña
            const isValidPassword = await UserModel.verifyPassword(password, user.password_hash);
            
            if (!isValidPassword) {
                return res.status(401).json({
                    error: 'Credenciales inválidas',
                    message: 'Email o contraseña incorrectos'
                });
            }

            // Generar token JWT
            const token = generateToken({
                userId: user.id,
                email: user.email,
                tipo_usuario: user.tipo_usuario
            });

            // Respuesta exitosa (sin incluir password_hash)
            res.json({
                message: 'Inicio de sesión exitoso',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    tipo_usuario: user.tipo_usuario,
                    fecha_registro: user.fecha_registro
                }
            });

            // Log de actividad
            console.log(`✅ Login exitoso: ${email} (${user.tipo_usuario}) - IP: ${req.ip}`);

        } catch (error) {
            console.error('❌ Error en login:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al procesar el inicio de sesión'
            });
        }
    }

    /**
     * Registrar nuevo usuario (solo alumnos pueden auto-registrarse)
     */
    static async register(req, res) {
        try {
            const { email, password, numero_control } = req.body;

            // Verificar que el email no esté en uso
            const existingUser = await UserModel.findByEmail(email);
            if (existingUser) {
                return res.status(409).json({
                    error: 'Email ya registrado',
                    message: 'Ya existe una cuenta con este email'
                });
            }

            // Verificar que el número de control no esté en uso
            const existingControl = await query(
                'SELECT id FROM perfiles_alumno WHERE numero_control = $1',
                [numero_control]
            );

            if (existingControl.rows.length > 0) {
                return res.status(409).json({
                    error: 'Número de control ya registrado',
                    message: 'Ya existe una cuenta con este número de control'
                });
            }

            // Crear usuario con perfil básico temporal
            const { user, profile } = await UserModel.createUserWithProfile({
                email,
                password,
                tipo_usuario: 'alumno',
                // Crear perfil temporal que se completará después
                nombre: 'Pendiente',
                apellido_paterno: 'de completar',
                numero_control
            });

            // Generar token JWT
            const token = generateToken({
                userId: user.id,
                email: user.email,
                tipo_usuario: user.tipo_usuario
            });

            // Respuesta exitosa
            res.status(201).json({
                message: 'Registro exitoso. Completa tu perfil desde el dashboard.',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    tipo_usuario: user.tipo_usuario,
                    fecha_registro: user.fecha_registro,
                    perfilCompleto: false // Indicar que necesita completar perfil
                },
                profile: {
                    id: profile.id,
                    perfilCompleto: false,
                    mensaje: 'Completa tu perfil desde el dashboard para acceder a todas las funciones'
                }
            });

            // Log de actividad
            console.log(`✅ Registro exitoso: ${email} - ${numero_control} - IP: ${req.ip}`);

        } catch (error) {
            console.error('❌ Error en registro:', error);

            // Manejo de errores específicos
            if (error.message.includes('email')) {
                return res.status(409).json({
                    error: 'Email ya registrado',
                    message: 'Ya existe una cuenta con este email'
                });
            }

            if (error.message.includes('numero_control')) {
                return res.status(409).json({
                    error: 'Número de control ya registrado',
                    message: 'Ya existe una cuenta con este número de control'
                });
            }

            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al procesar el registro'
            });
        }
    }

    /**
     * Verificar token válido y obtener información del usuario
     */
    static async verifyToken(req, res) {
        try {
            // El middleware de autenticación ya verificó el token
            // y agregó la información del usuario a req.user
            const user = await UserModel.findById(req.user.id);

            if (!user) {
                return res.status(401).json({
                    error: 'Usuario no encontrado',
                    message: 'El usuario asociado al token no existe'
                });
            }

            res.json({
                message: 'Token válido',
                user: {
                    id: user.id,
                    email: user.email,
                    tipo_usuario: user.tipo_usuario,
                    activo: user.activo,
                    fecha_registro: user.fecha_registro
                }
            });

        } catch (error) {
            console.error('❌ Error en verificación de token:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al verificar el token'
            });
        }
    }

    /**
     * Renovar token JWT
     */
    static async refreshToken(req, res) {
        try {
            // El middleware de autenticación ya verificó el token actual
            const user = await UserModel.findById(req.user.id);

            if (!user || !user.activo) {
                return res.status(401).json({
                    error: 'Usuario inválido',
                    message: 'No se puede renovar el token'
                });
            }

            // Generar nuevo token
            const newToken = generateToken({
                userId: user.id,
                email: user.email,
                tipo_usuario: user.tipo_usuario
            });

            res.json({
                message: 'Token renovado exitosamente',
                token: newToken,
                user: {
                    id: user.id,
                    email: user.email,
                    tipo_usuario: user.tipo_usuario,
                    activo: user.activo
                }
            });

        } catch (error) {
            console.error('❌ Error en renovación de token:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al renovar el token'
            });
        }
    }

    /**
     * Cambiar contraseña
     */
    static async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            const userId = req.user.id;

            // Buscar usuario con contraseña actual
            const user = await UserModel.findByEmail(req.user.email);
            
            if (!user) {
                return res.status(404).json({
                    error: 'Usuario no encontrado',
                    message: 'No se pudo encontrar la cuenta del usuario'
                });
            }

            // Verificar contraseña actual
            const isValidPassword = await UserModel.verifyPassword(currentPassword, user.password_hash);
            
            if (!isValidPassword) {
                return res.status(401).json({
                    error: 'Contraseña incorrecta',
                    message: 'La contraseña actual no es correcta'
                });
            }

            // Actualizar contraseña
            const updated = await UserModel.updatePassword(userId, newPassword);

            if (!updated) {
                return res.status(500).json({
                    error: 'Error al actualizar',
                    message: 'No se pudo actualizar la contraseña'
                });
            }

            res.json({
                message: 'Contraseña actualizada exitosamente'
            });

            // Log de actividad
            console.log(`✅ Cambio de contraseña: ${user.email} - IP: ${req.ip}`);

        } catch (error) {
            console.error('❌ Error en cambio de contraseña:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al cambiar la contraseña'
            });
        }
    }

    /**
     * Cerrar sesión (logout)
     * Nota: Con JWT stateless, el logout es principalmente del lado del cliente
     */
    static async logout(req, res) {
        try {
            // En una implementación con JWT stateless, el logout es manejado por el cliente
            // eliminando el token. Aquí solo registramos la actividad.
            
            res.json({
                message: 'Sesión cerrada exitosamente',
                note: 'Por favor, elimina el token del almacenamiento local'
            });

            // Log de actividad
            console.log(`✅ Logout: ${req.user.email} - IP: ${req.ip}`);

        } catch (error) {
            console.error('❌ Error en logout:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al cerrar sesión'
            });
        }
    }

    /**
     * Obtener información del perfil del usuario autenticado
     */
    static async getProfile(req, res) {
        try {
            const userId = req.user.id;
            const tipoUsuario = req.user.tipo_usuario;

            // Buscar usuario con perfil por ID para evitar ambigüedad del email
            const userWithProfile = await UserModel.findUserWithProfileById(userId);

            if (!userWithProfile) {
                return res.status(404).json({
                    error: 'Perfil no encontrado',
                    message: 'No se encontró información del perfil'
                });
            }

            // Formatear respuesta según el tipo de usuario
            let profileData = {
                id: userWithProfile.id,
                email: userWithProfile.email,
                tipo_usuario: userWithProfile.tipo_usuario,
                activo: userWithProfile.activo,
                fecha_registro: userWithProfile.fecha_registro
            };

            if (tipoUsuario === 'alumno') {
                profileData.perfil = {
                    nombre: userWithProfile.alumno_nombre,
                    apellido_paterno: userWithProfile.alumno_apellido_paterno,
                    apellido_materno: userWithProfile.alumno_apellido_materno,
                    numero_control: userWithProfile.numero_control,
                    grupo: userWithProfile.grupo,
                    semestre: userWithProfile.semestre,
                    telefono: userWithProfile.alumno_telefono,
                    fecha_nacimiento: userWithProfile.fecha_nacimiento
                };
            } else if (tipoUsuario === 'instructor') {
                profileData.perfil = {
                    nombre: userWithProfile.instructor_nombre,
                    apellido_paterno: userWithProfile.instructor_apellido_paterno,
                    apellido_materno: userWithProfile.instructor_apellido_materno,
                    especialidad: userWithProfile.especialidad,
                    telefono: userWithProfile.instructor_telefono,
                    descripcion: userWithProfile.instructor_descripcion,
                    contacto_emergencia: userWithProfile.instructor_contacto_emergencia,
                    telefono_emergencia: userWithProfile.instructor_telefono_emergencia,
                    direccion: userWithProfile.instructor_direccion
                };
            }

            res.json({
                message: 'Perfil obtenido exitosamente',
                data: profileData
            });

        } catch (error) {
            console.error('❌ Error al obtener perfil:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al obtener información del perfil'
            });
        }
    }

    /**
     * Completar perfil de alumno después del registro básico
     */
    static async completeProfile(req, res) {
        try {
            const userId = req.user.id; // Corregido: era req.user.userId
            const {
                nombre,
                apellidos, // Acepta apellidos completos del frontend
                numero_control,
                grupo,
                semestre,
                telefono,
                fecha_nacimiento
            } = req.body;

            // Evitar cambios de numero de control por alumnos
            const currentProfile = await query(
                'SELECT numero_control FROM perfiles_alumno WHERE usuario_id = $1',
                [userId]
            );

            if (currentProfile.rows.length > 0) {
                const currentNumero = currentProfile.rows[0].numero_control;
                if (currentNumero && currentNumero !== numero_control) {
                    return res.status(403).json({
                        error: 'Operacion no permitida',
                        message: 'Solo un administrador puede cambiar el numero de control'
                    });
                }
            }

            // Si viene "apellidos" como un solo campo, lo dividimos
            let apellido_paterno = apellidos || '';
            let apellido_materno = '';
            
            if (apellidos && apellidos.includes(' ')) {
                const apellidosArray = apellidos.trim().split(' ');
                apellido_paterno = apellidosArray[0];
                apellido_materno = apellidosArray.slice(1).join(' ');
            }

            // Verificar que el número de control no esté en uso por otro usuario
            const existingProfile = await query(
                'SELECT id FROM perfiles_alumno WHERE numero_control = $1 AND usuario_id != $2',
                [numero_control, userId]
            );

            if (existingProfile.rows.length > 0) {
                return res.status(409).json({
                    error: 'Número de control en uso',
                    message: 'Ya existe otro estudiante con este número de control'
                });
            }

            // Actualizar perfil del alumno
            const result = await query(
                `UPDATE perfiles_alumno 
                 SET nombre = $1, apellido_paterno = $2, apellido_materno = $3, 
                     numero_control = $4, grupo = $5, semestre = $6, telefono = $7, 
                     fecha_nacimiento = $8, updated_at = CURRENT_TIMESTAMP
                 WHERE usuario_id = $9
                 RETURNING *`,
                [
                    nombre,
                    apellido_paterno,
                    apellido_materno || null,
                    numero_control,
                    grupo || null,
                    semestre || null,
                    telefono || null,
                    fecha_nacimiento || null,
                    userId
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: 'Perfil no encontrado',
                    message: 'No se encontró el perfil de alumno'
                });
            }

            const profile = result.rows[0];

            res.json({
                message: 'Perfil completado exitosamente',
                profile: {
                    id: profile.id,
                    nombre: profile.nombre,
                    apellidos: `${profile.apellido_paterno} ${profile.apellido_materno || ''}`.trim(),
                    numero_control: profile.numero_control,
                    grupo: profile.grupo,
                    semestre: profile.semestre,
                    telefono: profile.telefono,
                    fecha_nacimiento: profile.fecha_nacimiento,
                    perfilCompleto: true
                }
            });

            console.log(`✅ Perfil completado para usuario: ${req.user.email}`);

        } catch (error) {
            console.error('❌ Error al completar perfil:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al completar el perfil'
            });
        }
    }

    /**
     * Actualizar perfil del usuario autenticado (instructor o alumno)
     */
    static async updateProfile(req, res) {
        try {
            const userId = req.user.id;
            const tipoUsuario = req.user.tipo_usuario;
            const { 
                nombre, 
                apellido_paterno, 
                apellido_materno, 
                especialidad,
                telefono,
                descripcion,
                contacto_emergencia,
                telefono_emergencia,
                direccion
            } = req.body;

            // Validar campos requeridos
            if (!nombre || !apellido_paterno) {
                return res.status(400).json({
                    error: 'Datos incompletos',
                    message: 'Nombre y apellido paterno son requeridos'
                });
            }

            let result;

            if (tipoUsuario === 'instructor') {
                // Actualizar perfil de instructor
                result = await query(
                    `UPDATE perfiles_instructor 
                     SET nombre = $1, 
                         apellido_paterno = $2, 
                         apellido_materno = $3, 
                         especialidad = $4,
                         telefono = $5,
                         descripcion = $6,
                         contacto_emergencia = $7,
                         telefono_emergencia = $8,
                         direccion = $9
                     WHERE usuario_id = $10
                     RETURNING id, nombre, apellido_paterno, apellido_materno, especialidad, telefono, descripcion`,
                    [
                        nombre.trim(), 
                        apellido_paterno.trim(), 
                        apellido_materno?.trim() || null, 
                        especialidad?.trim() || null,
                        telefono?.trim() || null,
                        descripcion?.trim() || null,
                        contacto_emergencia?.trim() || null,
                        telefono_emergencia?.trim() || null,
                        direccion?.trim() || null,
                        userId
                    ]
                );
            } else if (tipoUsuario === 'alumno') {
                // Actualizar perfil de alumno
                result = await query(
                    `UPDATE perfiles_alumno 
                     SET nombre = $1, 
                         apellido_paterno = $2, 
                         apellido_materno = $3,
                         contacto_emergencia = $4,
                         telefono_emergencia = $5,
                         direccion = $6
                     WHERE usuario_id = $7
                     RETURNING id, nombre, apellido_paterno, apellido_materno`,
                    [
                        nombre.trim(), 
                        apellido_paterno.trim(), 
                        apellido_materno?.trim() || null,
                        contacto_emergencia?.trim() || null,
                        telefono_emergencia?.trim() || null,
                        direccion?.trim() || null,
                        userId
                    ]
                );
            } else {
                return res.status(403).json({
                    error: 'Operación no permitida',
                    message: 'Los administradores no pueden actualizar su perfil desde aquí'
                });
            }

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: 'Perfil no encontrado',
                    message: 'No se encontró el perfil del usuario'
                });
            }

            res.json({
                message: 'Perfil actualizado exitosamente',
                data: result.rows[0]
            });

            console.log(`✅ Perfil actualizado para usuario: ${req.user.email}`);

        } catch (error) {
            console.error('❌ Error al actualizar perfil:', error);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: 'Error al actualizar el perfil'
            });
        }
    }
}

export default AuthController;