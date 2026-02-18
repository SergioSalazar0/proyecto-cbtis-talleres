import { query, transaction } from '../database/config-db.js';
import bcrypt from 'bcryptjs';

/**
 * Modelo para manejar usuarios
 * 
 * Fundamentos:
 * - Encapsula toda la lógica de acceso a datos de usuarios
 * - Maneja hashing de contraseñas de forma segura
 * - Incluye métodos para diferentes tipos de búsqueda
 * - Transacciones para operaciones complejas
 */

class UserModel {
    /**
     * Crear un nuevo usuario
     * @param {Object} userData - Datos del usuario
     * @returns {Promise<Object>} Usuario creado
     */
    static async createUser({ email, password, tipo_usuario = 'alumno' }) {
        try {
            // Hash de la contraseña
            const saltRounds = 12;
            const password_hash = await bcrypt.hash(password, saltRounds);

            const result = await query(
                `INSERT INTO usuarios (email, password_hash, tipo_usuario)
                 VALUES ($1, $2, $3)
                 RETURNING id, email, tipo_usuario, activo, fecha_registro`,
                [email, password_hash, tipo_usuario]
            );

            return result.rows[0];
        } catch (error) {
            if (error.code === '23505') { // Unique violation
                throw new Error('Ya existe un usuario con este email');
            }
            throw error;
        }
    }

    /**
     * Buscar usuario por email
     * @param {string} email - Email del usuario
     * @returns {Promise<Object|null>} Usuario encontrado o null
     */
    static async findByEmail(email) {
        const result = await query(
            'SELECT id, email, password_hash, tipo_usuario, activo, fecha_registro FROM usuarios WHERE email = $1',
            [email]
        );

        return result.rows[0] || null;
    }

    /**
     * Buscar usuario por ID
     * @param {string} id - ID del usuario
     * @returns {Promise<Object|null>} Usuario encontrado o null
     */
    static async findById(id) {
        const result = await query(
            'SELECT id, email, tipo_usuario, activo, fecha_registro, fecha_actualizacion FROM usuarios WHERE id = $1',
            [id]
        );

        return result.rows[0] || null;
    }

    /**
     * Verificar contraseña
     * @param {string} plainPassword - Contraseña en texto plano
     * @param {string} hashedPassword - Contraseña hasheada
     * @returns {Promise<boolean>} True si coincide
     */
    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    /**
     * Actualizar contraseña de usuario
     * @param {string} userId - ID del usuario
     * @param {string} newPassword - Nueva contraseña
     * @returns {Promise<boolean>} True si se actualizó
     */
    static async updatePassword(userId, newPassword) {
        try {
            const saltRounds = 12;
            const password_hash = await bcrypt.hash(newPassword, saltRounds);

            const result = await query(
                'UPDATE usuarios SET password_hash = $1 WHERE id = $2',
                [password_hash, userId]
            );

            return result.rowCount > 0;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Activar/desactivar usuario
     * @param {string} userId - ID del usuario
     * @param {boolean} activo - Estado activo
     * @returns {Promise<boolean>} True si se actualizó
     */
    static async updateStatus(userId, activo) {
        const result = await query(
            'UPDATE usuarios SET activo = $1 WHERE id = $2',
            [activo, userId]
        );

        return result.rowCount > 0;
    }

    /**
     * Obtener todos los usuarios con paginación
     * @param {Object} options - Opciones de búsqueda
     * @returns {Promise<Object>} Usuarios y metadata
     */
    static async findAll({ limit = 20, offset = 0, tipo_usuario = null, activo = null, search = null }) {
        let whereConditions = [];
        let params = [];
        let paramCount = 0;

        if (tipo_usuario) {
            paramCount++;
            whereConditions.push(`tipo_usuario = $${paramCount}`);
            params.push(tipo_usuario);
        }

        if (activo !== null) {
            paramCount++;
            whereConditions.push(`activo = $${paramCount}`);
            params.push(activo);
        }

        if (search) {
            paramCount++;
            whereConditions.push(`email ILIKE $${paramCount}`);
            params.push(`%${search}%`);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Query para obtener usuarios
        paramCount++;
        params.push(limit);
        paramCount++;
        params.push(offset);

        const usersResult = await query(
            `SELECT id, email, tipo_usuario, activo, fecha_registro, fecha_actualizacion
             FROM usuarios 
             ${whereClause}
             ORDER BY fecha_registro DESC
             LIMIT $${paramCount-1} OFFSET $${paramCount}`,
            params
        );

        // Query para obtener total
        const countResult = await query(
            `SELECT COUNT(*) as total FROM usuarios ${whereClause}`,
            params.slice(0, paramCount-2) // Remover limit y offset
        );

        return {
            users: usersResult.rows,
            total: parseInt(countResult.rows[0].total),
            limit,
            offset,
            hasMore: (offset + limit) < parseInt(countResult.rows[0].total)
        };
    }

    /**
     * Eliminar usuario (soft delete)
     * @param {string} userId - ID del usuario
     * @returns {Promise<boolean>} True si se eliminó
     */
    static async deleteUser(userId) {
        const result = await query(
            'UPDATE usuarios SET activo = false WHERE id = $1',
            [userId]
        );

        return result.rowCount > 0;
    }

    /**
     * Obtener estadísticas de usuarios
     * @returns {Promise<Object>} Estadísticas
     */
    static async getStats() {
        const result = await query(
            `SELECT 
                COUNT(*) as total_usuarios,
                COUNT(*) FILTER (WHERE tipo_usuario = 'alumno') as total_alumnos,
                COUNT(*) FILTER (WHERE tipo_usuario = 'instructor') as total_instructores,
                COUNT(*) FILTER (WHERE tipo_usuario = 'admin') as total_admins,
                COUNT(*) FILTER (WHERE activo = true) as usuarios_activos,
                COUNT(*) FILTER (WHERE activo = false) as usuarios_inactivos,
                COUNT(*) FILTER (WHERE fecha_registro >= CURRENT_DATE - INTERVAL '30 days') as nuevos_ultimo_mes
             FROM usuarios`
        );

        return result.rows[0];
    }

    /**
     * Verificar si el email ya existe
     * @param {string} email - Email a verificar
     * @param {string} excludeUserId - ID de usuario a excluir (para updates)
     * @returns {Promise<boolean>} True si existe
     */
    static async emailExists(email, excludeUserId = null) {
        let query_text = 'SELECT id FROM usuarios WHERE email = $1';
        let params = [email];

        if (excludeUserId) {
            query_text += ' AND id != $2';
            params.push(excludeUserId);
        }

        const result = await query(query_text, params);
        return result.rows.length > 0;
    }

    /**
     * Crear usuario con perfil en transacción
     * @param {Object} userData - Datos del usuario y perfil
     * @returns {Promise<Object>} Usuario y perfil creados
     */
    static async createUserWithProfile(userData) {
        return await transaction(async (client) => {
            // Crear usuario
            const saltRounds = 12;
            const password_hash = await bcrypt.hash(userData.password, saltRounds);

            const userResult = await client.query(
                `INSERT INTO usuarios (email, password_hash, tipo_usuario)
                 VALUES ($1, $2, $3)
                 RETURNING id, email, tipo_usuario, activo, fecha_registro`,
                [userData.email, password_hash, userData.tipo_usuario || 'alumno']
            );

            const user = userResult.rows[0];

            // Crear perfil según el tipo de usuario
            let profile = null;

            if (user.tipo_usuario === 'alumno') {
                const profileResult = await client.query(
                    `INSERT INTO perfiles_alumno (
                        usuario_id, nombre, apellido_paterno, apellido_materno, 
                        numero_control, grupo, telefono, fecha_nacimiento
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING *`,
                    [
                        user.id,
                        userData.nombre,
                        userData.apellido_paterno,
                        userData.apellido_materno || null,
                        userData.numero_control,
                        userData.grupo || null,
                        userData.telefono || null,
                        userData.fecha_nacimiento || null
                    ]
                );
                profile = profileResult.rows[0];
            } else if (user.tipo_usuario === 'instructor') {
                const profileResult = await client.query(
                    `INSERT INTO perfiles_instructor (
                        usuario_id, nombre, apellido_paterno, apellido_materno, especialidad
                    ) VALUES ($1, $2, $3, $4, $5)
                    RETURNING *`,
                    [
                        user.id,
                        userData.nombre,
                        userData.apellido_paterno,
                        userData.apellido_materno || null,
                        userData.especialidad || null
                    ]
                );
                profile = profileResult.rows[0];
            }

            return { user, profile };
        });
    }

    /**
     * Buscar usuarios con sus perfiles
     * @param {Object} options - Opciones de búsqueda
     * @returns {Promise<Array>} Usuarios con perfiles
     */
    static async findUsersWithProfiles({ tipo_usuario = null, search = null, limit = 20, offset = 0 }) {
        let whereConditions = ['u.activo = true'];
        let params = [];
        let paramCount = 0;

        if (tipo_usuario) {
            paramCount++;
            whereConditions.push(`u.tipo_usuario = $${paramCount}`);
            params.push(tipo_usuario);
        }

        if (search) {
            paramCount++;
            whereConditions.push(`(
                u.email ILIKE $${paramCount} OR 
                pa.nombre ILIKE $${paramCount} OR 
                pa.apellido_paterno ILIKE $${paramCount} OR
                pi.nombre ILIKE $${paramCount} OR 
                pi.apellido_paterno ILIKE $${paramCount}
            )`);
            params.push(`%${search}%`);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        paramCount++;
        params.push(limit);
        paramCount++;
        params.push(offset);

        const result = await query(
            `SELECT 
                u.id, u.email, u.tipo_usuario, u.activo, u.fecha_registro,
                pa.nombre as alumno_nombre, pa.apellido_paterno as alumno_apellido_paterno,
                pa.apellido_materno as alumno_apellido_materno, pa.numero_control,
                pa.grupo, pa.semestre, pa.telefono as alumno_telefono, pa.fecha_nacimiento,
                pi.nombre as instructor_nombre, pi.apellido_paterno as instructor_apellido_paterno,
                pi.apellido_materno as instructor_apellido_materno, pi.especialidad,
                pi.telefono as instructor_telefono,
                pi.experiencia as instructor_descripcion,
                NULL as instructor_contacto_emergencia,
                NULL as instructor_telefono_emergencia,
                NULL as instructor_direccion
             FROM usuarios u
             LEFT JOIN perfiles_alumno pa ON u.id = pa.usuario_id
             LEFT JOIN perfiles_instructor pi ON u.id = pi.usuario_id
             ${whereClause}
             ORDER BY u.fecha_registro DESC
             LIMIT $${paramCount-1} OFFSET $${paramCount}`,
            params
        );

        return result.rows;
    }

    /**
     * Obtener un usuario con su perfil por ID
     * @param {string} userId - ID del usuario
     * @returns {Promise<Object|null>} Usuario con perfil o null
     */
    static async findUserWithProfileById(userId) {
        const result = await query(
            `SELECT 
                u.id, u.email, u.tipo_usuario, u.activo, u.fecha_registro,
                pa.nombre as alumno_nombre, pa.apellido_paterno as alumno_apellido_paterno,
                pa.apellido_materno as alumno_apellido_materno, pa.numero_control,
                pa.grupo, pa.semestre, pa.telefono as alumno_telefono, pa.fecha_nacimiento,
                pi.nombre as instructor_nombre, pi.apellido_paterno as instructor_apellido_paterno,
                pi.apellido_materno as instructor_apellido_materno, pi.especialidad,
                pi.telefono as instructor_telefono,
                pi.experiencia as instructor_descripcion,
                NULL as instructor_contacto_emergencia,
                NULL as instructor_telefono_emergencia,
                NULL as instructor_direccion
             FROM usuarios u
             LEFT JOIN perfiles_alumno pa ON u.id = pa.usuario_id
             LEFT JOIN perfiles_instructor pi ON u.id = pi.usuario_id
             WHERE u.id = $1 AND u.activo = true
             LIMIT 1`,
            [userId]
        );

        return result.rows[0] || null;
    }
}

export default UserModel;