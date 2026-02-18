import pool from '../database/config-db.js';

class InformacionEmergencia {
    // Obtener información de emergencia de un alumno
    static async findByAlumnoId(alumnoId) {
        try {
            const query = `
                SELECT 
                    ie.id,
                    ie.alumno_id,
                    ie.contacto_emergencia_nombre,
                    ie.contacto_emergencia_telefono,
                    ie.contacto_emergencia_relacion,
                    ie.tipo_sangre,
                    ie.alergias,
                    ie.medicamentos,
                    ie.condiciones_medicas,
                    ie.seguro_medico,
                    ie.numero_seguro,
                    ie.created_at,
                    ie.updated_at
                FROM informacion_emergencia ie
                WHERE ie.alumno_id = $1
            `;
            
            const result = await pool.query(query, [alumnoId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error al obtener información de emergencia:', error);
            throw error;
        }
    }

    // Crear información de emergencia
    static async create(alumnoId, data) {
        try {
            const query = `
                INSERT INTO informacion_emergencia (
                    alumno_id,
                    contacto_emergencia_nombre,
                    contacto_emergencia_telefono,
                    contacto_emergencia_relacion,
                    tipo_sangre,
                    alergias,
                    medicamentos,
                    condiciones_medicas,
                    seguro_medico,
                    numero_seguro
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;
            
            const values = [
                alumnoId,
                data.contacto_emergencia_nombre,
                data.contacto_emergencia_telefono,
                data.contacto_emergencia_relacion,
                data.tipo_sangre || null,
                data.alergias || null,
                data.medicamentos || null,
                data.condiciones_medicas || null,
                data.seguro_medico || null,
                data.numero_seguro || null
            ];
            
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('Error al crear información de emergencia:', error);
            throw error;
        }
    }

    // Actualizar información de emergencia
    static async update(id, alumnoId, data) {
        try {
            const query = `
                UPDATE informacion_emergencia SET
                    contacto_emergencia_nombre = $1,
                    contacto_emergencia_telefono = $2,
                    contacto_emergencia_relacion = $3,
                    tipo_sangre = $4,
                    alergias = $5,
                    medicamentos = $6,
                    condiciones_medicas = $7,
                    seguro_medico = $8,
                    numero_seguro = $9,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $10 AND alumno_id = $11
                RETURNING *
            `;
            
            const values = [
                data.contacto_emergencia_nombre,
                data.contacto_emergencia_telefono,
                data.contacto_emergencia_relacion,
                data.tipo_sangre || null,
                data.alergias || null,
                data.medicamentos || null,
                data.condiciones_medicas || null,
                data.seguro_medico || null,
                data.numero_seguro || null,
                id,
                alumnoId
            ];
            
            const result = await pool.query(query, values);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error al actualizar información de emergencia:', error);
            throw error;
        }
    }

    // Eliminar información de emergencia
    static async delete(id, alumnoId) {
        try {
            const query = `
                DELETE FROM informacion_emergencia
                WHERE id = $1 AND alumno_id = $2
                RETURNING *
            `;
            
            const result = await pool.query(query, [id, alumnoId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error al eliminar información de emergencia:', error);
            throw error;
        }
    }
}

export default InformacionEmergencia;
