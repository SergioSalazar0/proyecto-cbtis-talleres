import InformacionEmergencia from '../models/InformacionEmergencia.js';

class InformacionEmergenciaController {
    // Obtener información de emergencia del alumno autenticado
    static async getMiInformacion(req, res) {
        try {
            // El middleware authorizeAlumnoAccess ya validó que es alumno y estableció req.alumno
            
            // Buscar información de emergencia
            const infoEmergencia = await InformacionEmergencia.findByAlumnoId(req.alumno.id);

            return res.status(200).json({
                success: true,
                data: infoEmergencia
            });

        } catch (error) {
            console.error('Error al obtener información de emergencia:', error);
            return res.status(500).json({ 
                error: 'Error al obtener información de emergencia',
                details: error.message 
            });
        }
    }

    // Crear o actualizar información de emergencia
    static async createOrUpdate(req, res) {
        try {
            // El middleware authorizeAlumnoAccess ya validó que es alumno y estableció req.alumno

            const {
                contacto_emergencia_nombre,
                contacto_emergencia_telefono,
                contacto_emergencia_relacion,
                tipo_sangre,
                alergias,
                medicamentos,
                condiciones_medicas,
                seguro_medico,
                numero_seguro
            } = req.body;

            // Validar campos requeridos
            if (!contacto_emergencia_nombre || !contacto_emergencia_telefono || !contacto_emergencia_relacion) {
                return res.status(400).json({ 
                    error: 'Los campos de contacto de emergencia son obligatorios',
                    details: 'Debes proporcionar nombre, teléfono y relación del contacto de emergencia'
                });
            }

            // Verificar si ya existe información de emergencia
            const existente = await InformacionEmergencia.findByAlumnoId(req.alumno.id);

            let resultado;
            if (existente) {
                // Actualizar
                resultado = await InformacionEmergencia.update(existente.id, req.alumno.id, req.body);
            } else {
                // Crear
                resultado = await InformacionEmergencia.create(req.alumno.id, req.body);
            }

            return res.status(existente ? 200 : 201).json({
                success: true,
                message: existente ? 'Información actualizada correctamente' : 'Información creada correctamente',
                data: resultado
            });

        } catch (error) {
            console.error('Error al guardar información de emergencia:', error);
            return res.status(500).json({ 
                error: 'Error al guardar información de emergencia',
                details: error.message 
            });
        }
    }

    // Eliminar información de emergencia
    static async delete(req, res) {
        try {
            // El middleware authorizeAlumnoAccess ya validó que es alumno y estableció req.alumno

            const { id } = req.params;

            const resultado = await InformacionEmergencia.delete(id, req.alumno.id);

            if (!resultado) {
                return res.status(404).json({ 
                    error: 'Información de emergencia no encontrada' 
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Información de emergencia eliminada correctamente'
            });

        } catch (error) {
            console.error('Error al eliminar información de emergencia:', error);
            return res.status(500).json({ 
                error: 'Error al eliminar información de emergencia',
                details: error.message 
            });
        }
    }
}

export default InformacionEmergenciaController;
