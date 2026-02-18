import { query, transaction } from '../database/config-db.js';

/**
 * Modelo para manejar inscripciones
 * 
 * Fundamentos:
 * - Gestiona las inscripciones de alumnos a talleres
 * - Controla los cupos disponibles
 * - Maneja estados de inscripción
 * - Validaciones de reglas de negocio
 */

class InscripcionModel {
    /**
     * Crear una nueva inscripción
     * @param {Object} inscripcionData - Datos de la inscripción
     * @returns {Promise<Object>} Inscripción creada
     */
    static async create(inscripcionData) {
        const {
            alumno_id,
            taller_id,
            comentarios = null
        } = inscripcionData;

        return await transaction(async (client) => {
            // Verificar que el alumno no esté ya inscrito en otro taller
            const existingInscripcion = await client.query(
                'SELECT id, taller_id FROM inscripciones WHERE alumno_id = $1 AND estado = \'activa\'',
                [alumno_id]
            );

            if (existingInscripcion.rows.length > 0) {
                throw new Error('El alumno ya está inscrito en otro taller');
            }

            // Verificar cupo disponible
            const cupoResult = await client.query(
                'SELECT verificar_cupo_disponible($1) as cupos_disponibles',
                [taller_id]
            );

            const cuposDisponibles = cupoResult.rows[0]?.cupos_disponibles;

            if (cuposDisponibles === -1) {
                throw new Error('El taller no existe o está inactivo');
            }

            if (cuposDisponibles <= 0) {
                throw new Error('No hay cupos disponibles en este taller');
            }

            // Crear la inscripción
            const result = await client.query(
                `INSERT INTO inscripciones (alumno_id, taller_id, comentarios)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [alumno_id, taller_id, comentarios]
            );

            return result.rows[0];
        });
    }

    /**
     * Buscar inscripción por ID
     * @param {string} id - ID de la inscripción
     * @returns {Promise<Object|null>} Inscripción encontrada o null
     */
    static async findById(id) {
        const result = await query(
            `SELECT 
                i.id, i.alumno_id, i.taller_id, i.estado, i.fecha_inscripcion,
                i.fecha_actualizacion, i.comentarios,
                pa.nombre as alumno_nombre,
                pa.apellido_paterno as alumno_apellido_paterno,
                pa.apellido_materno as alumno_apellido_materno,
                pa.numero_control,
                t.nombre as taller_nombre,
                t.categoria as taller_categoria
             FROM inscripciones i
             INNER JOIN perfiles_alumno pa ON i.alumno_id = pa.id
             INNER JOIN talleres t ON i.taller_id = t.id
             WHERE i.id = $1`,
            [id]
        );

        return result.rows[0] || null;
    }

    /**
     * Obtener inscripciones de un alumno
     * @param {string} alumnoId - ID del perfil de alumno
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Array>} Lista de inscripciones
     */
    static async findByAlumno(alumnoId, { estado = null, limit = 10, offset = 0 } = {}) {
        let whereConditions = ['i.alumno_id = $1'];
        let params = [alumnoId];
        let paramCount = 1;

        if (estado) {
            paramCount++;
            whereConditions.push(`i.estado = $${paramCount}`);
            params.push(estado);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        paramCount++;
        params.push(limit);
        paramCount++;
        params.push(offset);

        const result = await query(
            `SELECT 
                i.id, i.taller_id, i.estado, i.fecha_inscripcion,
                i.fecha_actualizacion, i.comentarios,
                t.nombre as taller_nombre,
                t.descripcion as taller_descripcion,
                t.categoria as taller_categoria,
                t.horario as taller_horario,
                t.lugar as taller_lugar,
                COALESCE(pi.nombre || ' ' || pi.apellido_paterno, 'Sin asignar') as instructor_nombre
             FROM inscripciones i
             INNER JOIN talleres t ON i.taller_id = t.id
             LEFT JOIN perfiles_instructor pi ON t.instructor_id = pi.id
             ${whereClause}
             ORDER BY i.fecha_inscripcion DESC
             LIMIT $${paramCount-1} OFFSET $${paramCount}`,
            params
        );

        return result.rows;
    }

    /**
     * Obtener inscripciones de un taller
     * @param {string} tallerId - ID del taller
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Array>} Lista de inscripciones
     */
    static async findByTaller(tallerId, { estado = 'activa', search = null, limit = 50, offset = 0 } = {}) {
        let whereConditions = ['i.taller_id = $1'];
        let params = [tallerId];
        let paramCount = 1;

        if (estado) {
            paramCount++;
            whereConditions.push(`i.estado = $${paramCount}`);
            params.push(estado);
        }

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
                i.id, i.alumno_id, i.estado, i.fecha_inscripcion,
                i.fecha_actualizacion, i.comentarios,
                pa.nombre as alumno_nombre,
                pa.apellido_paterno as alumno_apellido_paterno,
                pa.apellido_materno as alumno_apellido_materno,
                pa.numero_control, pa.grupo, pa.semestre, pa.telefono,
                u.email as alumno_email
             FROM inscripciones i
             INNER JOIN perfiles_alumno pa ON i.alumno_id = pa.id
             INNER JOIN usuarios u ON pa.usuario_id = u.id
             ${whereClause}
             ORDER BY pa.apellido_paterno, pa.apellido_materno, pa.nombre
             LIMIT $${paramCount-1} OFFSET $${paramCount}`,
            params
        );

        return result.rows;
    }

    /**
     * Actualizar estado de inscripción
     * @param {string} id - ID de la inscripción
     * @param {string} nuevoEstado - Nuevo estado
     * @param {string} comentarios - Comentarios adicionales
     * @returns {Promise<Object|null>} Inscripción actualizada o null
     */
    static async updateEstado(id, nuevoEstado, comentarios = null) {
        const result = await query(
            `UPDATE inscripciones 
             SET estado = $1, comentarios = COALESCE($2, comentarios), fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [nuevoEstado, comentarios, id]
        );

        return result.rows[0] || null;
    }

    /**
     * Cancelar inscripción
     * @param {string} id - ID de la inscripción
     * @param {string} motivo - Motivo de cancelación
     * @returns {Promise<boolean>} True si se canceló
     */
    static async cancelar(id, motivo = null) {
        const comentario = motivo ? `Cancelada: ${motivo}` : 'Cancelada por el usuario';
        
        const result = await query(
            `UPDATE inscripciones 
             SET estado = 'cancelada', 
                 comentarios = CASE 
                     WHEN comentarios IS NULL THEN $1
                     ELSE comentarios || ' | ' || $1
                 END,
                 fecha_actualizacion = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [comentario, id]
        );

        return result.rowCount > 0;
    }

    /**
     * Verificar si un alumno puede inscribirse a un taller
     * @param {string} alumnoId - ID del alumno
     * @param {string} tallerId - ID del taller
     * @returns {Promise<Object>} Resultado de la verificación
     */
    static async verificarPuedeInscribirse(alumnoId, tallerId) {
        // Verificar inscripción activa existente
        const inscripcionExistente = await query(
            'SELECT id, taller_id FROM inscripciones WHERE alumno_id = $1 AND estado = \'activa\'',
            [alumnoId]
        );

        if (inscripcionExistente.rows.length > 0) {
            return {
                puede: false,
                razon: 'Ya tienes una inscripción activa en otro taller',
                inscripcion_existente: inscripcionExistente.rows[0]
            };
        }

        // Verificar cupo disponible
        const cupoResult = await query(
            'SELECT verificar_cupo_disponible($1) as cupos_disponibles',
            [tallerId]
        );

        const cuposDisponibles = cupoResult.rows[0]?.cupos_disponibles;

        if (cuposDisponibles === -1) {
            return {
                puede: false,
                razon: 'El taller no existe o está inactivo'
            };
        }

        if (cuposDisponibles <= 0) {
            return {
                puede: false,
                razon: 'No hay cupos disponibles en este taller',
                cupos_disponibles: 0
            };
        }

        return {
            puede: true,
            razon: 'Puede inscribirse',
            cupos_disponibles: cuposDisponibles
        };
    }

    /**
     * Obtener inscripción activa de un alumno
     * @param {string} alumnoId - ID del alumno
     * @returns {Promise<Object|null>} Inscripción activa o null
     */
    static async getInscripcionActiva(alumnoId) {
        const result = await query(
            `SELECT 
                i.id, i.taller_id, i.estado, i.fecha_inscripcion, i.comentarios,
                t.nombre as taller_nombre,
                t.descripcion as taller_descripcion,
                t.categoria as taller_categoria,
                t.horario as taller_horario,
                t.lugar as taller_lugar,
                COALESCE(pi.nombre || ' ' || pi.apellido_paterno, 'Sin asignar') as instructor_nombre,
                pi.telefono as instructor_telefono,
                pi.especialidad as instructor_especialidad
             FROM inscripciones i
             INNER JOIN talleres t ON i.taller_id = t.id
             LEFT JOIN perfiles_instructor pi ON t.instructor_id = pi.id
             WHERE i.alumno_id = $1 AND i.estado = 'activa'`,
            [alumnoId]
        );

        return result.rows[0] || null;
    }

    /**
     * Obtener estadísticas de inscripciones
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Object>} Estadísticas
     */
    static async getStats({ tallerId = null, instructorId = null } = {}) {
        let whereConditions = [];
        let params = [];
        let paramCount = 0;

        if (tallerId) {
            paramCount++;
            whereConditions.push(`i.taller_id = $${paramCount}`);
            params.push(tallerId);
        }

        if (instructorId) {
            paramCount++;
            whereConditions.push(`t.instructor_id = $${paramCount}`);
            params.push(instructorId);
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        const joinClause = instructorId 
            ? 'INNER JOIN talleres t ON i.taller_id = t.id'
            : 'LEFT JOIN talleres t ON i.taller_id = t.id';

        const result = await query(
            `SELECT 
                COUNT(*) as total_inscripciones,
                COUNT(*) FILTER (WHERE i.estado = 'activa') as inscripciones_activas,
                COUNT(*) FILTER (WHERE i.estado = 'inactiva') as inscripciones_inactivas,
                COUNT(*) FILTER (WHERE i.estado = 'cancelada') as inscripciones_canceladas,
                COUNT(*) FILTER (WHERE i.fecha_inscripcion >= CURRENT_DATE - INTERVAL '7 days') as inscripciones_ultima_semana,
                COUNT(*) FILTER (WHERE i.fecha_inscripcion >= CURRENT_DATE - INTERVAL '30 days') as inscripciones_ultimo_mes,
                COUNT(DISTINCT i.alumno_id) as alumnos_unicos
             FROM inscripciones i
             ${joinClause}
             ${whereClause}`,
            params
        );

        return result.rows[0];
    }

    /**
     * Obtener reporte de inscripciones por taller
     * @returns {Promise<Array>} Reporte por taller
     */
    static async getReportePorTaller() {
        const result = await query(
            `SELECT 
                t.id as taller_id,
                t.nombre as taller_nombre,
                t.categoria as taller_categoria,
                t.cupo_maximo,
                COUNT(i.id) FILTER (WHERE i.estado = 'activa') as inscritos_actuales,
                COUNT(i.id) FILTER (WHERE i.estado = 'cancelada') as cancelaciones,
                (t.cupo_maximo - COUNT(i.id) FILTER (WHERE i.estado = 'activa')) as cupos_disponibles,
                ROUND(
                    (COUNT(i.id) FILTER (WHERE i.estado = 'activa') * 100.0 / t.cupo_maximo), 2
                ) as porcentaje_ocupacion,
                COALESCE(pi.nombre || ' ' || pi.apellido_paterno, 'Sin asignar') as instructor_nombre
             FROM talleres t
             LEFT JOIN inscripciones i ON t.id = i.taller_id
             LEFT JOIN perfiles_instructor pi ON t.instructor_id = pi.id
             WHERE t.activo = true
             GROUP BY t.id, t.nombre, t.categoria, t.cupo_maximo, pi.nombre, pi.apellido_paterno
             ORDER BY t.categoria, porcentaje_ocupacion DESC`
        );

        return result.rows;
    }

    /**
     * Obtener historial de inscripciones de un alumno
     * @param {string} alumnoId - ID del alumno
     * @returns {Promise<Array>} Historial de inscripciones
     */
    static async getHistorialAlumno(alumnoId) {
        const result = await query(
            `SELECT 
                i.id, i.estado, i.fecha_inscripcion, i.fecha_actualizacion, i.comentarios,
                t.nombre as taller_nombre,
                t.categoria as taller_categoria,
                COALESCE(pi.nombre || ' ' || pi.apellido_paterno, 'Sin asignar') as instructor_nombre
             FROM inscripciones i
             INNER JOIN talleres t ON i.taller_id = t.id
             LEFT JOIN perfiles_instructor pi ON t.instructor_id = pi.id
             WHERE i.alumno_id = $1
             ORDER BY i.fecha_inscripcion DESC`,
            [alumnoId]
        );

        return result.rows;
    }

    /**
     * Buscar inscripciones por término de búsqueda
     * @param {string} searchTerm - Término de búsqueda
     * @param {Object} options - Opciones de búsqueda
     * @returns {Promise<Array>} Inscripciones encontradas
     */
    static async search(searchTerm, {
        tallerId = null,
        estado = null,
        limit = 20,
        offset = 0
    } = {}) {
        let whereConditions = [
            `(pa.nombre ILIKE $1 OR 
              pa.apellido_paterno ILIKE $1 OR
              pa.apellido_materno ILIKE $1 OR
              pa.numero_control ILIKE $1 OR
              t.nombre ILIKE $1)`
        ];
        let params = [`%${searchTerm}%`];
        let paramCount = 1;

        if (tallerId) {
            paramCount++;
            whereConditions.push(`i.taller_id = $${paramCount}`);
            params.push(tallerId);
        }

        if (estado) {
            paramCount++;
            whereConditions.push(`i.estado = $${paramCount}`);
            params.push(estado);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        paramCount++;
        params.push(limit);
        paramCount++;
        params.push(offset);

        const result = await query(
            `SELECT 
                i.id, i.alumno_id, i.taller_id, i.estado, 
                i.fecha_inscripcion, i.comentarios,
                pa.nombre as alumno_nombre,
                pa.apellido_paterno as alumno_apellido_paterno,
                pa.apellido_materno as alumno_apellido_materno,
                pa.numero_control,
                t.nombre as taller_nombre,
                t.categoria as taller_categoria
             FROM inscripciones i
             INNER JOIN perfiles_alumno pa ON i.alumno_id = pa.id
             INNER JOIN talleres t ON i.taller_id = t.id
             ${whereClause}
             ORDER BY i.fecha_inscripcion DESC
             LIMIT $${paramCount-1} OFFSET $${paramCount}`,
            params
        );

        return result.rows;
    }
}

export default InscripcionModel;