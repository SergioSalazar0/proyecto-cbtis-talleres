import { query, transaction } from '../database/config-db.js';

/**
 * Modelo para manejar fechas importantes del calendario
 * 
 * Fundamentos:
 * - Gestiona eventos importantes de cada taller
 * - Soporte para diferentes tipos de eventos
 * - Filtrado por fechas y talleres
 * - Vista de calendario mensual/semanal
 */

class CalendarioModel {
    /**
     * Crear una nueva fecha importante
     * @param {Object} fechaData - Datos de la fecha importante
     * @returns {Promise<Object>} Fecha importante creada
     */
    static async create(fechaData) {
        const {
            taller_id,
            instructor_id,
            titulo,
            descripcion = null,
            fecha_evento,
            tipo_evento = 'evento'
        } = fechaData;

        const result = await query(
            `INSERT INTO fechas_importantes (taller_id, instructor_id, titulo, descripcion, fecha_evento, tipo_evento)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [taller_id, instructor_id, titulo, descripcion, fecha_evento, tipo_evento]
        );

        return result.rows[0];
    }

    /**
     * Obtener fechas importantes de un taller
     * @param {string} tallerId - ID del taller
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Array>} Lista de fechas importantes
     */
    static async findByTaller(tallerId, { 
        fechaInicio = null, 
        fechaFin = null, 
        tipoEvento = null,
        limit = 50, 
        offset = 0 
    } = {}) {
        let whereConditions = ['f.taller_id = $1', 'f.activo = true'];
        let params = [tallerId];
        let paramCount = 1;

        if (fechaInicio) {
            paramCount++;
            whereConditions.push(`f.fecha_evento >= $${paramCount}`);
            params.push(fechaInicio);
        }

        if (fechaFin) {
            paramCount++;
            whereConditions.push(`f.fecha_evento <= $${paramCount}`);
            params.push(fechaFin);
        }

        if (tipoEvento) {
            paramCount++;
            whereConditions.push(`f.tipo_evento = $${paramCount}`);
            params.push(tipoEvento);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        paramCount++;
        params.push(limit);
        paramCount++;
        params.push(offset);

        const result = await query(
            `SELECT 
                f.id, f.titulo, f.descripcion, f.fecha_evento, f.tipo_evento,
                f.activo, f.created_at,
                pi.nombre || ' ' || pi.apellido_paterno as instructor_nombre,
                t.nombre as taller_nombre,
                t.categoria as taller_categoria
             FROM fechas_importantes f
             INNER JOIN perfiles_instructor pi ON f.instructor_id = pi.id
             INNER JOIN talleres t ON f.taller_id = t.id
             ${whereClause}
             ORDER BY f.fecha_evento ASC
             LIMIT $${paramCount-1} OFFSET $${paramCount}`,
            params
        );

        return result.rows;
    }

    /**
     * Obtener fechas importantes por instructor
     * @param {string} instructorId - ID del perfil de instructor
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Array>} Lista de fechas importantes
     */
    static async findByInstructor(instructorId, { 
        fechaInicio = null, 
        fechaFin = null,
        activo = true,
        limit = 50, 
        offset = 0 
    } = {}) {
        let whereConditions = ['f.instructor_id = $1'];
        let params = [instructorId];
        let paramCount = 1;

        if (fechaInicio) {
            paramCount++;
            whereConditions.push(`f.fecha_evento >= $${paramCount}`);
            params.push(fechaInicio);
        }

        if (fechaFin) {
            paramCount++;
            whereConditions.push(`f.fecha_evento <= $${paramCount}`);
            params.push(fechaFin);
        }

        if (activo !== null) {
            paramCount++;
            whereConditions.push(`f.activo = $${paramCount}`);
            params.push(activo);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        paramCount++;
        params.push(limit);
        paramCount++;
        params.push(offset);

        const result = await query(
            `SELECT 
                f.id, f.titulo, f.descripcion, f.fecha_evento, f.tipo_evento,
                f.activo, f.created_at,
                t.nombre as taller_nombre,
                t.categoria as taller_categoria,
                t.id as taller_id
             FROM fechas_importantes f
             INNER JOIN talleres t ON f.taller_id = t.id
             ${whereClause}
             ORDER BY f.fecha_evento ASC
             LIMIT $${paramCount-1} OFFSET $${paramCount}`,
            params
        );

        return result.rows;
    }

    /**
     * Buscar fecha importante por ID
     * @param {string} id - ID de la fecha importante
     * @returns {Promise<Object|null>} Fecha importante encontrada o null
     */
    static async findById(id) {
        const result = await query(
            `SELECT 
                f.id, f.taller_id, f.instructor_id, f.titulo, f.descripcion,
                f.fecha_evento, f.tipo_evento, f.activo, f.created_at,
                pi.nombre || ' ' || pi.apellido_paterno as instructor_nombre,
                t.nombre as taller_nombre,
                t.categoria as taller_categoria
             FROM fechas_importantes f
             INNER JOIN perfiles_instructor pi ON f.instructor_id = pi.id
             INNER JOIN talleres t ON f.taller_id = t.id
             WHERE f.id = $1`,
            [id]
        );

        return result.rows[0] || null;
    }

    /**
     * Actualizar una fecha importante
     * @param {string} id - ID de la fecha importante
     * @param {Object} updateData - Datos a actualizar
     * @returns {Promise<Object|null>} Fecha importante actualizada o null
     */
    static async update(id, updateData) {
        const allowedFields = ['titulo', 'descripcion', 'fecha_evento', 'tipo_evento', 'activo'];
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
            `UPDATE fechas_importantes 
             SET ${updateFields.join(', ')}
             WHERE id = $${paramCount}
             RETURNING *`,
            params
        );

        return result.rows[0] || null;
    }

    /**
     * Eliminar una fecha importante (soft delete)
     * @param {string} id - ID de la fecha importante
     * @returns {Promise<boolean>} True si se eliminó
     */
    static async delete(id) {
        const result = await query(
            'UPDATE fechas_importantes SET activo = false WHERE id = $1',
            [id]
        );

        return result.rowCount > 0;
    }

    /**
     * Obtener calendario mensual para un taller
     * @param {string} tallerId - ID del taller
     * @param {number} year - Año
     * @param {number} month - Mes (1-12)
     * @returns {Promise<Array>} Eventos del mes
     */
    static async getCalendarioMensual(tallerId, year, month) {
        const fechaInicio = new Date(year, month - 1, 1);
        const fechaFin = new Date(year, month, 0, 23, 59, 59, 999);

        const result = await query(
            `SELECT 
                f.id, f.titulo, f.descripcion, f.fecha_evento, f.tipo_evento,
                EXTRACT(DAY FROM f.fecha_evento) as dia,
                EXTRACT(DOW FROM f.fecha_evento) as dia_semana,
                pi.nombre || ' ' || pi.apellido_paterno as instructor_nombre
             FROM fechas_importantes f
             INNER JOIN perfiles_instructor pi ON f.instructor_id = pi.id
             WHERE f.taller_id = $1 
             AND f.activo = true
             AND f.fecha_evento >= $2
             AND f.fecha_evento <= $3
             ORDER BY f.fecha_evento ASC`,
            [tallerId, fechaInicio.toISOString(), fechaFin.toISOString()]
        );

        return result.rows;
    }

    /**
     * Obtener eventos próximos para un alumno
     * @param {string} alumnoId - ID del perfil de alumno
     * @param {number} dias - Días hacia adelante a buscar (default: 30)
     * @returns {Promise<Array>} Eventos próximos
     */
    static async getEventosProximosParaAlumno(alumnoId, dias = 30) {
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() + dias);

        const result = await query(
            `SELECT DISTINCT
                f.id, f.titulo, f.descripcion, f.fecha_evento, f.tipo_evento,
                t.nombre as taller_nombre,
                t.categoria as taller_categoria,
                pi.nombre || ' ' || pi.apellido_paterno as instructor_nombre,
                EXTRACT(DAYS FROM (f.fecha_evento - CURRENT_TIMESTAMP)) as dias_restantes
             FROM fechas_importantes f
             INNER JOIN inscripciones i ON f.taller_id = i.taller_id
             INNER JOIN talleres t ON f.taller_id = t.id
             INNER JOIN perfiles_instructor pi ON f.instructor_id = pi.id
             WHERE i.alumno_id = $1 
             AND i.estado = 'activa'
             AND f.activo = true
             AND f.fecha_evento >= CURRENT_TIMESTAMP
             AND f.fecha_evento <= $2
             ORDER BY f.fecha_evento ASC`,
            [alumnoId, fechaLimite.toISOString()]
        );

        return result.rows;
    }

    /**
     * Obtener eventos de hoy
     * @param {string} tallerId - ID del taller (opcional)
     * @returns {Promise<Array>} Eventos de hoy
     */
    static async getEventosDeHoy(tallerId = null) {
        const hoy = new Date();
        const inicioDelDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
        const finDelDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999);

        let whereConditions = [
            'f.activo = true',
            'f.fecha_evento >= $1',
            'f.fecha_evento <= $2'
        ];
        let params = [inicioDelDia.toISOString(), finDelDia.toISOString()];
        let paramCount = 2;

        if (tallerId) {
            paramCount++;
            whereConditions.push(`f.taller_id = $${paramCount}`);
            params.push(tallerId);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        const result = await query(
            `SELECT 
                f.id, f.titulo, f.descripcion, f.fecha_evento, f.tipo_evento,
                t.nombre as taller_nombre,
                t.categoria as taller_categoria,
                pi.nombre || ' ' || pi.apellido_paterno as instructor_nombre
             FROM fechas_importantes f
             INNER JOIN talleres t ON f.taller_id = t.id
             INNER JOIN perfiles_instructor pi ON f.instructor_id = pi.id
             ${whereClause}
             ORDER BY f.fecha_evento ASC`,
            params
        );

        return result.rows;
    }

    /**
     * Obtener eventos por tipo
     * @param {string} tipoEvento - Tipo de evento
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Array>} Eventos del tipo
     */
    static async getEventosPorTipo(tipoEvento, {
        tallerId = null,
        fechaInicio = null,
        fechaFin = null,
        limit = 20,
        offset = 0
    } = {}) {
        let whereConditions = ['f.tipo_evento = $1', 'f.activo = true'];
        let params = [tipoEvento];
        let paramCount = 1;

        if (tallerId) {
            paramCount++;
            whereConditions.push(`f.taller_id = $${paramCount}`);
            params.push(tallerId);
        }

        if (fechaInicio) {
            paramCount++;
            whereConditions.push(`f.fecha_evento >= $${paramCount}`);
            params.push(fechaInicio);
        }

        if (fechaFin) {
            paramCount++;
            whereConditions.push(`f.fecha_evento <= $${paramCount}`);
            params.push(fechaFin);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        paramCount++;
        params.push(limit);
        paramCount++;
        params.push(offset);

        const result = await query(
            `SELECT 
                f.id, f.titulo, f.descripcion, f.fecha_evento, f.tipo_evento,
                t.nombre as taller_nombre,
                t.categoria as taller_categoria,
                pi.nombre || ' ' || pi.apellido_paterno as instructor_nombre
             FROM fechas_importantes f
             INNER JOIN talleres t ON f.taller_id = t.id
             INNER JOIN perfiles_instructor pi ON f.instructor_id = pi.id
             ${whereClause}
             ORDER BY f.fecha_evento ASC
             LIMIT $${paramCount-1} OFFSET $${paramCount}`,
            params
        );

        return result.rows;
    }

    /**
     * Obtener estadísticas de eventos
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
                COUNT(*) as total_eventos,
                COUNT(*) FILTER (WHERE activo = true) as eventos_activos,
                COUNT(*) FILTER (WHERE activo = false) as eventos_inactivos,
                COUNT(*) FILTER (WHERE fecha_evento >= CURRENT_TIMESTAMP) as eventos_futuros,
                COUNT(*) FILTER (WHERE fecha_evento < CURRENT_TIMESTAMP) as eventos_pasados,
                COUNT(*) FILTER (WHERE tipo_evento = 'examen') as examenes,
                COUNT(*) FILTER (WHERE tipo_evento = 'entrega') as entregas,
                COUNT(*) FILTER (WHERE tipo_evento = 'competencia') as competencias,
                COUNT(*) FILTER (WHERE tipo_evento = 'presentacion') as presentaciones,
                COUNT(*) FILTER (WHERE tipo_evento = 'reunion') as reuniones,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as eventos_ultima_semana,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as eventos_ultimo_mes
             FROM fechas_importantes
             ${whereCondition}`,
            params
        );

        return result.rows[0];
    }

    /**
     * Buscar eventos por texto
     * @param {string} searchTerm - Término de búsqueda
     * @param {Object} options - Opciones de búsqueda
     * @returns {Promise<Array>} Eventos encontrados
     */
    static async search(searchTerm, {
        tallerId = null,
        instructorId = null,
        tipoEvento = null,
        limit = 20,
        offset = 0
    } = {}) {
        let whereConditions = [
            'f.activo = true',
            '(f.titulo ILIKE $1 OR f.descripcion ILIKE $1)'
        ];
        let params = [`%${searchTerm}%`];
        let paramCount = 1;

        if (tallerId) {
            paramCount++;
            whereConditions.push(`f.taller_id = $${paramCount}`);
            params.push(tallerId);
        }

        if (instructorId) {
            paramCount++;
            whereConditions.push(`f.instructor_id = $${paramCount}`);
            params.push(instructorId);
        }

        if (tipoEvento) {
            paramCount++;
            whereConditions.push(`f.tipo_evento = $${paramCount}`);
            params.push(tipoEvento);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        paramCount++;
        params.push(limit);
        paramCount++;
        params.push(offset);

        const result = await query(
            `SELECT 
                f.id, f.titulo, f.descripcion, f.fecha_evento, f.tipo_evento,
                t.nombre as taller_nombre,
                t.categoria as taller_categoria,
                pi.nombre || ' ' || pi.apellido_paterno as instructor_nombre
             FROM fechas_importantes f
             INNER JOIN talleres t ON f.taller_id = t.id
             INNER JOIN perfiles_instructor pi ON f.instructor_id = pi.id
             ${whereClause}
             ORDER BY f.fecha_evento ASC
             LIMIT $${paramCount-1} OFFSET $${paramCount}`,
            params
        );

        return result.rows;
    }

    /**
     * Obtener vista de calendario para un rango de fechas
     * @param {string} fechaInicio - Fecha de inicio
     * @param {string} fechaFin - Fecha de fin
     * @param {string} tallerId - ID del taller (opcional)
     * @returns {Promise<Array>} Eventos en el rango
     */
    static async getCalendarioRango(fechaInicio, fechaFin, tallerId = null) {
        let whereConditions = [
            'f.activo = true',
            'f.fecha_evento >= $1',
            'f.fecha_evento <= $2'
        ];
        let params = [fechaInicio, fechaFin];
        let paramCount = 2;

        if (tallerId) {
            paramCount++;
            whereConditions.push(`f.taller_id = $${paramCount}`);
            params.push(tallerId);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        const result = await query(
            `SELECT 
                f.id, f.titulo, f.descripcion, f.fecha_evento, f.tipo_evento,
                DATE(f.fecha_evento) as fecha_dia,
                EXTRACT(HOUR FROM f.fecha_evento) as hora,
                EXTRACT(MINUTE FROM f.fecha_evento) as minuto,
                t.nombre as taller_nombre,
                t.categoria as taller_categoria,
                t.id as taller_id,
                pi.nombre || ' ' || pi.apellido_paterno as instructor_nombre
             FROM fechas_importantes f
             INNER JOIN talleres t ON f.taller_id = t.id
             INNER JOIN perfiles_instructor pi ON f.instructor_id = pi.id
             ${whereClause}
             ORDER BY f.fecha_evento ASC`,
            params
        );

        // Agrupar eventos por día
        const eventosPorDia = {};
        result.rows.forEach(evento => {
            const fecha = evento.fecha_dia;
            if (!eventosPorDia[fecha]) {
                eventosPorDia[fecha] = [];
            }
            eventosPorDia[fecha].push(evento);
        });

        return eventosPorDia;
    }
}

export default CalendarioModel;