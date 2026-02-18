import { query, transaction } from '../database/config-db.js';

/**
 * Modelo para manejar talleres
 * 
 * Fundamentos:
 * - Gestiona toda la lógica relacionada con talleres
 * - Incluye verificación de cupos disponibles
 * - Maneja relaciones con instructores
 * - Proporciona estadísticas y reportes
 */

class TallerModel {
    /**
     * Obtener todos los talleres con información del instructor
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Array>} Lista de talleres
     */
    static async findAll({ categoria = null, activo = true, search = null, limit = 50, offset = 0 }) {
        let whereConditions = [];
        let params = [];
        let paramCount = 0;

        if (categoria) {
            paramCount++;
            whereConditions.push(`t.categoria = $${paramCount}`);
            params.push(categoria);
        }

        if (activo !== null) {
            paramCount++;
            whereConditions.push(`t.activo = $${paramCount}`);
            params.push(activo);
        }

        if (search) {
            paramCount++;
            whereConditions.push(`(
                t.nombre ILIKE $${paramCount} OR 
                t.descripcion ILIKE $${paramCount}
            )`);
            params.push(`%${search}%`);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        paramCount++;
        params.push(limit);
        paramCount++;
        params.push(offset);

        const result = await query(
            `SELECT 
                t.id, t.nombre, t.descripcion, t.categoria, t.cupo_maximo,
                t.horario, t.lugar, t.activo, t.created_at, t.updated_at,
                COALESCE(pi.nombre || ' ' || pi.apellido_paterno || ' ' || COALESCE(pi.apellido_materno, ''), 'Sin asignar') as instructor_nombre,
                pi.telefono as instructor_telefono,
                pi.especialidad as instructor_especialidad,
                pi.id as instructor_perfil_id,
                u.email as instructor_email,
                (SELECT COUNT(*) FROM inscripciones i WHERE i.taller_id = t.id AND i.estado = 'activa') as inscritos_actuales,
                (t.cupo_maximo - (SELECT COUNT(*) FROM inscripciones i WHERE i.taller_id = t.id AND i.estado = 'activa')) as cupos_disponibles
             FROM talleres t
             LEFT JOIN perfiles_instructor pi ON t.instructor_id = pi.id
             LEFT JOIN usuarios u ON pi.usuario_id = u.id
             ${whereClause}
             ORDER BY t.categoria, t.nombre
             LIMIT $${paramCount-1} OFFSET $${paramCount}`,
            params
        );

        return result.rows;
    }

    /**
     * Buscar taller por ID con información completa
     * @param {string} id - ID del taller
     * @returns {Promise<Object|null>} Taller encontrado o null
     */
    static async findById(id) {
        const result = await query(
            `SELECT 
                t.id, t.nombre, t.descripcion, t.categoria, t.cupo_maximo,
                t.horario, t.lugar, t.activo, t.created_at, t.updated_at,
                COALESCE(pi.nombre || ' ' || pi.apellido_paterno || ' ' || COALESCE(pi.apellido_materno, ''), 'Sin asignar') as instructor_nombre,
                pi.telefono as instructor_telefono,
                pi.especialidad as instructor_especialidad,
                pi.experiencia as instructor_experiencia,
                pi.id as instructor_perfil_id,
                u.id as instructor_usuario_id,
                u.email as instructor_email,
                (SELECT COUNT(*) FROM inscripciones i WHERE i.taller_id = t.id AND i.estado = 'activa') as inscritos_actuales,
                (t.cupo_maximo - (SELECT COUNT(*) FROM inscripciones i WHERE i.taller_id = t.id AND i.estado = 'activa')) as cupos_disponibles
             FROM talleres t
             LEFT JOIN perfiles_instructor pi ON t.instructor_id = pi.id
             LEFT JOIN usuarios u ON pi.usuario_id = u.id
             WHERE t.id = $1`,
            [id]
        );

        return result.rows[0] || null;
    }

    /**
     * Crear un nuevo taller
     * @param {Object} tallerData - Datos del taller
     * @returns {Promise<Object>} Taller creado
     */
    static async create(tallerData) {
        const {
            nombre,
            descripcion,
            categoria,
            instructor_id,
            cupo_maximo = 25,
            horario,
            lugar
        } = tallerData;

        const result = await query(
            `INSERT INTO talleres (nombre, descripcion, categoria, instructor_id, cupo_maximo, horario, lugar)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [nombre, descripcion, categoria, instructor_id, cupo_maximo, horario, lugar]
        );

        return result.rows[0];
    }

    /**
     * Actualizar un taller
     * @param {string} id - ID del taller
     * @param {Object} updateData - Datos a actualizar
     * @returns {Promise<Object|null>} Taller actualizado o null
     */
    static async update(id, updateData) {
        const allowedFields = ['nombre', 'descripcion', 'categoria', 'instructor_id', 'cupo_maximo', 'horario', 'lugar', 'activo'];
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
            `UPDATE talleres 
             SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${paramCount}
             RETURNING *`,
            params
        );

        return result.rows[0] || null;
    }

    /**
     * Eliminar un taller (soft delete)
     * @param {string} id - ID del taller
     * @returns {Promise<boolean>} True si se eliminó
     */
    static async delete(id) {
        const result = await query(
            'UPDATE talleres SET activo = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [id]
        );

        return result.rowCount > 0;
    }

    /**
     * Verificar cupo disponible en un taller
     * @param {string} tallerId - ID del taller
     * @returns {Promise<number>} Cupos disponibles (-1 si no existe)
     */
    static async verificarCupoDisponible(tallerId) {
        const result = await query(
            'SELECT verificar_cupo_disponible($1) as cupos_disponibles',
            [tallerId]
        );

        return result.rows[0]?.cupos_disponibles || -1;
    }

    /**
     * Obtener talleres por categoría
     * @param {string} categoria - Categoría del taller
     * @returns {Promise<Array>} Talleres de la categoría
     */
    static async findByCategoria(categoria) {
        const result = await query(
            `SELECT 
                t.id, t.nombre, t.descripcion, t.categoria, t.cupo_maximo,
                t.horario, t.lugar, t.activo,
                COALESCE(pi.nombre || ' ' || pi.apellido_paterno, 'Sin asignar') as instructor_nombre,
                (SELECT COUNT(*) FROM inscripciones i WHERE i.taller_id = t.id AND i.estado = 'activa') as inscritos_actuales,
                (t.cupo_maximo - (SELECT COUNT(*) FROM inscripciones i WHERE i.taller_id = t.id AND i.estado = 'activa')) as cupos_disponibles
             FROM talleres t
             LEFT JOIN perfiles_instructor pi ON t.instructor_id = pi.id
             WHERE t.categoria = $1 AND t.activo = true
             ORDER BY t.nombre`,
            [categoria]
        );

        return result.rows;
    }

    /**
     * Obtener talleres de un instructor
     * @param {string} instructorId - ID del perfil de instructor
     * @returns {Promise<Array>} Talleres del instructor
     */
    static async findByInstructor(instructorId) {
        const result = await query(
            `SELECT 
                t.id, t.nombre, t.descripcion, t.categoria, t.cupo_maximo,
                t.horario, t.lugar, t.activo, t.created_at, t.updated_at,
                (SELECT COUNT(*) FROM inscripciones i WHERE i.taller_id = t.id AND i.estado = 'activa') as inscritos_actuales,
                (t.cupo_maximo - (SELECT COUNT(*) FROM inscripciones i WHERE i.taller_id = t.id AND i.estado = 'activa')) as cupos_disponibles
             FROM talleres t
             WHERE t.instructor_id = $1
             ORDER BY t.nombre`,
            [instructorId]
        );

        return result.rows;
    }

    /**
     * Obtener alumnos inscritos en un taller
     * @param {string} tallerId - ID del taller
     * @param {Object} options - Opciones de búsqueda
     * @returns {Promise<Array>} Alumnos inscritos
     */
    static async getAlumnosInscritos(tallerId, { search = null, limit = 50, offset = 0 } = {}) {
        let whereConditions = ['i.taller_id = $1', 'i.estado = \'activa\''];
        let params = [tallerId];
        let paramCount = 1;

        if (search) {
            paramCount++;
            whereConditions.push(`(
                pa.nombre ILIKE $${paramCount} OR 
                pa.apellido_paterno ILIKE $${paramCount} OR
                pa.apellido_materno ILIKE $${paramCount} OR
                pa.numero_control ILIKE $${paramCount}
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
                pa.id as perfil_id,
                pa.nombre, pa.apellido_paterno, pa.apellido_materno,
                pa.numero_control, pa.grupo, pa.semestre, pa.telefono,
                u.email,
                i.fecha_inscripcion, i.comentarios,
                ie.contacto_emergencia_nombre, ie.contacto_emergencia_telefono,
                ie.contacto_emergencia_relacion, ie.tipo_sangre,
                ie.alergias, ie.medicamentos, ie.condiciones_medicas
             FROM inscripciones i
             INNER JOIN perfiles_alumno pa ON i.alumno_id = pa.id
             INNER JOIN usuarios u ON pa.usuario_id = u.id
             LEFT JOIN informacion_emergencia ie ON pa.id = ie.alumno_id
             ${whereClause}
             ORDER BY pa.apellido_paterno, pa.apellido_materno, pa.nombre
             LIMIT $${paramCount-1} OFFSET $${paramCount}`,
            params
        );

        return result.rows;
    }

    /**
     * Obtener estadísticas de talleres
     * @returns {Promise<Object>} Estadísticas
     */
    static async getStats() {
        const result = await query(
            `SELECT 
                COUNT(*) as total_talleres,
                COUNT(*) FILTER (WHERE activo = true) as talleres_activos,
                COUNT(*) FILTER (WHERE activo = false) as talleres_inactivos,
                COUNT(*) FILTER (WHERE categoria = 'culturales') as talleres_culturales,
                COUNT(*) FILTER (WHERE categoria = 'deportes') as talleres_deportes,
                COUNT(*) FILTER (WHERE categoria = 'civicos') as talleres_civicos,
                SUM(cupo_maximo) as total_cupos,
                (SELECT COUNT(*) FROM inscripciones WHERE estado = 'activa') as total_inscritos,
                ROUND(AVG(cupo_maximo), 2) as promedio_cupo_por_taller
             FROM talleres`
        );

        const statsData = result.rows[0];

        // Obtener estadísticas por categoría
        const categoryStatsResult = await query(
            `SELECT 
                categoria,
                COUNT(*) as total_talleres,
                SUM(cupo_maximo) as total_cupos,
                (SELECT COUNT(*) 
                 FROM inscripciones i 
                 INNER JOIN talleres t2 ON i.taller_id = t2.id 
                 WHERE t2.categoria = t.categoria AND i.estado = 'activa') as total_inscritos
             FROM talleres t
             WHERE activo = true
             GROUP BY categoria
             ORDER BY categoria`
        );

        return {
            ...statsData,
            por_categoria: categoryStatsResult.rows
        };
    }

    /**
     * Obtener talleres con cupos disponibles
     * @returns {Promise<Array>} Talleres con cupos
     */
    static async getTalleresConCupos() {
        const result = await query(
            `SELECT 
                t.id, t.nombre, t.categoria, t.cupo_maximo,
                (SELECT COUNT(*) FROM inscripciones i WHERE i.taller_id = t.id AND i.estado = 'activa') as inscritos_actuales,
                (t.cupo_maximo - (SELECT COUNT(*) FROM inscripciones i WHERE i.taller_id = t.id AND i.estado = 'activa')) as cupos_disponibles
             FROM talleres t
             WHERE t.activo = true
             HAVING (t.cupo_maximo - (SELECT COUNT(*) FROM inscripciones i WHERE i.taller_id = t.id AND i.estado = 'activa')) > 0
             ORDER BY categoria, nombre`
        );

        return result.rows;
    }

    /**
     * Asignar instructor a un taller
     * @param {string} tallerId - ID del taller
     * @param {string} instructorId - ID del perfil de instructor
     * @returns {Promise<boolean>} True si se asignó
     */
    static async asignarInstructor(tallerId, instructorId) {
        const result = await query(
            'UPDATE talleres SET instructor_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [instructorId, tallerId]
        );

        return result.rowCount > 0;
    }

    /**
     * Remover instructor de un taller
     * @param {string} tallerId - ID del taller
     * @returns {Promise<boolean>} True si se removió
     */
    static async removerInstructor(tallerId) {
        const result = await query(
            'UPDATE talleres SET instructor_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [tallerId]
        );

        return result.rowCount > 0;
    }

    /**
     * Buscar talleres disponibles para un alumno (que no esté inscrito)
     * @param {string} alumnoId - ID del perfil de alumno
     * @returns {Promise<Array>} Talleres disponibles
     */
    static async getTalleresDisponiblesParaAlumno(alumnoId) {
        const result = await query(
            `SELECT 
                t.id, t.nombre, t.descripcion, t.categoria, t.cupo_maximo,
                t.horario, t.lugar,
                COALESCE(pi.nombre || ' ' || pi.apellido_paterno, 'Sin asignar') as instructor_nombre,
                (SELECT COUNT(*) FROM inscripciones i WHERE i.taller_id = t.id AND i.estado = 'activa') as inscritos_actuales,
                (t.cupo_maximo - (SELECT COUNT(*) FROM inscripciones i WHERE i.taller_id = t.id AND i.estado = 'activa')) as cupos_disponibles
             FROM talleres t
             LEFT JOIN perfiles_instructor pi ON t.instructor_id = pi.id
             WHERE t.activo = true
             AND NOT EXISTS (
                 SELECT 1 FROM inscripciones i 
                 WHERE i.taller_id = t.id 
                 AND i.alumno_id = $1 
                 AND i.estado = 'activa'
             )
             AND (t.cupo_maximo - (SELECT COUNT(*) FROM inscripciones i WHERE i.taller_id = t.id AND i.estado = 'activa')) > 0
             ORDER BY t.categoria, t.nombre`,
            [alumnoId]
        );

        return result.rows;
    }
}

export default TallerModel;