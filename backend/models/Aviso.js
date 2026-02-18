import { query, transaction } from '../database/config-db.js';

/**
 * Modelo para manejar avisos
 * 
 * Fundamentos:
 * - Gestiona avisos de instructores hacia alumnos
 * - Soporte para avisos importantes y fechas de expiración
 * - Filtrado por taller y estado
 * - Historial de avisos
 */

class AvisoModel {
    /**
     * Crear un nuevo aviso
     * @param {Object} avisoData - Datos del aviso
     * @returns {Promise<Object>} Aviso creado
     */
    static async create(avisoData) {
        const {
            taller_id,
            instructor_id,
            titulo,
            contenido,
            importante = false,
            fecha_expiracion = null
        } = avisoData;

        const result = await query(
            `INSERT INTO avisos (taller_id, instructor_id, titulo, contenido, importante, fecha_expiracion)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [taller_id, instructor_id, titulo, contenido, importante, fecha_expiracion]
        );

        return result.rows[0];
    }

    /**
     * Obtener avisos de un taller
     * @param {string} tallerId - ID del taller
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Array>} Lista de avisos
     */
    static async findByTaller(tallerId, { includeExpired = false, limit = 20, offset = 0 } = {}) {
        let whereConditions = ['a.taller_id = $1', 'a.activo = true'];
        let params = [tallerId];
        let paramCount = 1;

        if (!includeExpired) {
            whereConditions.push('(a.fecha_expiracion IS NULL OR a.fecha_expiracion > CURRENT_TIMESTAMP)');
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        paramCount++;
        params.push(limit);
        paramCount++;
        params.push(offset);

        const result = await query(
            `SELECT 
                a.id, a.titulo, a.contenido, a.importante, a.activo,
                a.fecha_publicacion, a.fecha_expiracion, a.created_at,
                pi.nombre || ' ' || pi.apellido_paterno as instructor_nombre,
                t.nombre as taller_nombre
             FROM avisos a
             INNER JOIN perfiles_instructor pi ON a.instructor_id = pi.id
             INNER JOIN talleres t ON a.taller_id = t.id
             ${whereClause}
             ORDER BY a.importante DESC, a.fecha_publicacion DESC
             LIMIT $${paramCount-1} OFFSET $${paramCount}`,
            params
        );

        return result.rows;
    }

    /**
     * Obtener avisos por instructor
     * @param {string} instructorId - ID del perfil de instructor
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Array>} Lista de avisos
     */
    static async findByInstructor(instructorId, { activo = null, limit = 20, offset = 0 } = {}) {
        let whereConditions = ['a.instructor_id = $1'];
        let params = [instructorId];
        let paramCount = 1;

        if (activo !== null) {
            paramCount++;
            whereConditions.push(`a.activo = $${paramCount}`);
            params.push(activo);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        paramCount++;
        params.push(limit);
        paramCount++;
        params.push(offset);

        const result = await query(
            `SELECT 
                a.id, a.titulo, a.contenido, a.importante, a.activo,
                a.fecha_publicacion, a.fecha_expiracion, a.created_at,
                t.nombre as taller_nombre,
                t.categoria as taller_categoria
             FROM avisos a
             INNER JOIN talleres t ON a.taller_id = t.id
             ${whereClause}
             ORDER BY a.fecha_publicacion DESC
             LIMIT $${paramCount-1} OFFSET $${paramCount}`,
            params
        );

        return result.rows;
    }

    /**
     * Buscar aviso por ID
     * @param {string} id - ID del aviso
     * @returns {Promise<Object|null>} Aviso encontrado o null
     */
    static async findById(id) {
        const result = await query(
            `SELECT 
                a.id, a.taller_id, a.instructor_id, a.titulo, a.contenido,
                a.importante, a.activo, a.fecha_publicacion, a.fecha_expiracion,
                a.created_at,
                pi.nombre || ' ' || pi.apellido_paterno as instructor_nombre,
                t.nombre as taller_nombre,
                t.categoria as taller_categoria
             FROM avisos a
             INNER JOIN perfiles_instructor pi ON a.instructor_id = pi.id
             INNER JOIN talleres t ON a.taller_id = t.id
             WHERE a.id = $1`,
            [id]
        );

        return result.rows[0] || null;
    }

    /**
     * Actualizar un aviso
     * @param {string} id - ID del aviso
     * @param {Object} updateData - Datos a actualizar
     * @returns {Promise<Object|null>} Aviso actualizado o null
     */
    static async update(id, updateData) {
        const allowedFields = ['titulo', 'contenido', 'importante', 'fecha_expiracion', 'activo'];
        const updateFields = [];
        const params = [];
        let paramCount = 0;

        // Construir query dinámicamente
        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key)) {
                paramCount++;
                updateFields.push(`${key} = $${paramCount}`);
                params.push(value);
            }
        }

        if (updateFields.length === 0) {
            throw new Error('No hay campos válidos para actualizar');
        }

        paramCount++;
        params.push(id);

        const result = await query(
            `UPDATE avisos 
             SET ${updateFields.join(', ')}
             WHERE id = $${paramCount}
             RETURNING *`,
            params
        );

        return result.rows[0] || null;
    }

    /**
     * Eliminar un aviso (soft delete)
     * @param {string} id - ID del aviso
     * @returns {Promise<boolean>} True si se eliminó
     */
    static async delete(id) {
        const result = await query(
            'UPDATE avisos SET activo = false WHERE id = $1',
            [id]
        );

        return result.rowCount > 0;
    }

    /**
     * Obtener avisos importantes activos
     * @param {string} tallerId - ID del taller (opcional)
     * @returns {Promise<Array>} Avisos importantes
     */
    static async getImportantes(tallerId = null) {
        let whereConditions = [
            'a.importante = true',
            'a.activo = true',
            '(a.fecha_expiracion IS NULL OR a.fecha_expiracion > CURRENT_TIMESTAMP)'
        ];
        let params = [];
        let paramCount = 0;

        if (tallerId) {
            paramCount++;
            whereConditions.push(`a.taller_id = $${paramCount}`);
            params.push(tallerId);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        const result = await query(
            `SELECT 
                a.id, a.titulo, a.contenido, a.fecha_publicacion,
                a.fecha_expiracion,
                pi.nombre || ' ' || pi.apellido_paterno as instructor_nombre,
                t.nombre as taller_nombre,
                t.categoria as taller_categoria
             FROM avisos a
             INNER JOIN perfiles_instructor pi ON a.instructor_id = pi.id
             INNER JOIN talleres t ON a.taller_id = t.id
             ${whereClause}
             ORDER BY a.fecha_publicacion DESC`,
            params
        );

        return result.rows;
    }

    /**
     * Obtener avisos para un alumno (basado en su inscripción)
     * @param {string} alumnoId - ID del perfil de alumno
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Array>} Avisos del alumno
     */
    static async getAvisosParaAlumno(alumnoId, { limit = 10, offset = 0 } = {}) {
        const result = await query(
            `SELECT DISTINCT
                a.id, a.titulo, a.contenido, a.importante, 
                a.fecha_publicacion, a.fecha_expiracion,
                pi.nombre || ' ' || pi.apellido_paterno as instructor_nombre,
                t.nombre as taller_nombre,
                t.categoria as taller_categoria
             FROM avisos a
             INNER JOIN inscripciones i ON a.taller_id = i.taller_id
             INNER JOIN perfiles_instructor pi ON a.instructor_id = pi.id
             INNER JOIN talleres t ON a.taller_id = t.id
             WHERE i.alumno_id = $1 
             AND i.estado = 'activa'
             AND a.activo = true
             AND (a.fecha_expiracion IS NULL OR a.fecha_expiracion > CURRENT_TIMESTAMP)
             ORDER BY a.importante DESC, a.fecha_publicacion DESC
             LIMIT $2 OFFSET $3`,
            [alumnoId, limit, offset]
        );

        return result.rows;
    }

    /**
     * Marcar avisos como leídos (funcionalidad futura)
     * @param {string} avisoId - ID del aviso
     * @param {string} alumnoId - ID del alumno
     * @returns {Promise<boolean>} True si se marcó
     */
    static async marcarComoLeido(avisoId, alumnoId) {
        // Esta funcionalidad requeriría una tabla adicional para tracking de lectura
        // Por ahora solo retornamos true
        return true;
    }

    /**
     * Obtener estadísticas de avisos
     * @param {string} instructorId - ID del instructor (opcional)
     * @returns {Promise<Object>} Estadísticas
     */
    static async getStats(instructorId = null) {
        let whereCondition = '';
        let params = [];

        if (instructorId) {
            whereCondition = 'WHERE instructor_id = $1';
            params.push(instructorId);
        }

        const result = await query(
            `SELECT 
                COUNT(*) as total_avisos,
                COUNT(*) FILTER (WHERE activo = true) as avisos_activos,
                COUNT(*) FILTER (WHERE activo = false) as avisos_inactivos,
                COUNT(*) FILTER (WHERE importante = true AND activo = true) as avisos_importantes,
                COUNT(*) FILTER (WHERE fecha_expiracion IS NOT NULL AND fecha_expiracion < CURRENT_TIMESTAMP) as avisos_expirados,
                COUNT(*) FILTER (WHERE fecha_publicacion >= CURRENT_DATE - INTERVAL '7 days') as avisos_ultima_semana,
                COUNT(*) FILTER (WHERE fecha_publicacion >= CURRENT_DATE - INTERVAL '30 days') as avisos_ultimo_mes
             FROM avisos
             ${whereCondition}`,
            params
        );

        return result.rows[0];
    }

    /**
     * Obtener avisos próximos a expirar
     * @param {number} days - Días de anticipación (default: 3)
     * @param {string} instructorId - ID del instructor (opcional)
     * @returns {Promise<Array>} Avisos próximos a expirar
     */
    static async getProximosAExpirar(days = 3, instructorId = null) {
        let whereConditions = [
            'a.activo = true',
            'a.fecha_expiracion IS NOT NULL',
            `a.fecha_expiracion BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '${days} days'`
        ];
        let params = [];
        let paramCount = 0;

        if (instructorId) {
            paramCount++;
            whereConditions.push(`a.instructor_id = $${paramCount}`);
            params.push(instructorId);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        const result = await query(
            `SELECT 
                a.id, a.titulo, a.contenido, a.importante,
                a.fecha_publicacion, a.fecha_expiracion,
                pi.nombre || ' ' || pi.apellido_paterno as instructor_nombre,
                t.nombre as taller_nombre,
                EXTRACT(DAYS FROM (a.fecha_expiracion - CURRENT_TIMESTAMP)) as dias_restantes
             FROM avisos a
             INNER JOIN perfiles_instructor pi ON a.instructor_id = pi.id
             INNER JOIN talleres t ON a.taller_id = t.id
             ${whereClause}
             ORDER BY a.fecha_expiracion ASC`,
            params
        );

        return result.rows;
    }

    /**
     * Buscar avisos por texto
     * @param {string} searchTerm - Término de búsqueda
     * @param {Object} options - Opciones de búsqueda
     * @returns {Promise<Array>} Avisos encontrados
     */
    static async search(searchTerm, { tallerId = null, instructorId = null, limit = 20, offset = 0 } = {}) {
        let whereConditions = [
            'a.activo = true',
            '(a.titulo ILIKE $1 OR a.contenido ILIKE $1)'
        ];
        let params = [`%${searchTerm}%`];
        let paramCount = 1;

        if (tallerId) {
            paramCount++;
            whereConditions.push(`a.taller_id = $${paramCount}`);
            params.push(tallerId);
        }

        if (instructorId) {
            paramCount++;
            whereConditions.push(`a.instructor_id = $${paramCount}`);
            params.push(instructorId);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        paramCount++;
        params.push(limit);
        paramCount++;
        params.push(offset);

        const result = await query(
            `SELECT 
                a.id, a.titulo, a.contenido, a.importante,
                a.fecha_publicacion, a.fecha_expiracion,
                pi.nombre || ' ' || pi.apellido_paterno as instructor_nombre,
                t.nombre as taller_nombre,
                t.categoria as taller_categoria
             FROM avisos a
             INNER JOIN perfiles_instructor pi ON a.instructor_id = pi.id
             INNER JOIN talleres t ON a.taller_id = t.id
             ${whereClause}
             ORDER BY a.importante DESC, a.fecha_publicacion DESC
             LIMIT $${paramCount-1} OFFSET $${paramCount}`,
            params
        );

        return result.rows;
    }
}

export default AvisoModel;