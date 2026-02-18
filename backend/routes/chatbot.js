import express from 'express';
import dotenv from 'dotenv';
import pool from '../database/config-db.js';

dotenv.config();
const router = express.Router();

const MODEL_NAME = "gemini-2.5-flash";

async function generarContenidoGemini(apiKey, userText) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [
                {
                    role: "user",
                    parts: [{ text: userText }]
                }
            ],
            generationConfig: {
                temperature: 0.5,
                topP: 0.95,
                maxOutputTokens: 2048,
                stopSequences: []
            }
        })
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error.message || 'Error desconocido de Gemini');
    }

    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.map(part => part?.text || '').join('') || '';
    const finishReason = candidate?.finishReason || 'UNKNOWN';

    if (!text) {
        throw new Error('Respuesta inválida de Gemini (sin contenido)');
    }

    return { text, finishReason };
}

async function obtenerContextoDesdeDB() {
    try {
        const { rows } = await pool.query('SELECT nombre, horario FROM talleres LIMIT 15');
        if (rows.length === 0) return "No hay talleres registrados en la base de datos hoy.";
        
        return "TALLERES DISPONIBLES (Datos Reales):\n" + 
               rows.map(t => `- ${t.nombre}: Horario ${t.horario}`).join('\n');
    } catch (error) {
        console.error("Error al traer talleres:", error);
        return "Error técnico al consultar los talleres.";
    }
}

router.post('/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensaje vacío' });

    const contextoTalleres = await obtenerContextoDesdeDB();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY no está configurada');
        return res.status(500).json({ response: 'Configuración incompleta del asistente. Contacta al administrador.' });
    }

    // --- IDENTIDAD INSTITUCIONAL MEJORADA ---
    const systemInstruction = `
    Eres el "Asistente Virtual Oficial" del CBTis 258. Tu misión es ayudar a la comunidad estudiantil.

    INFORMACIÓN GENERAL DEL PLANTEL:
    - Nombre: Centro de Bachillerato Tecnológico Industrial y de Servicios No. 258.
    - Ubicación: General Escobedo, Nuevo León.
    - Horario: Lunes a Viernes (servicio administrativo).
    - Carreras Técnicas que ofrecemos: Programación, Contabilidad, Soporte y Mantenimiento de Cómputo, y Mantenimiento Industrial.
    
    ÁREAS DE ATENCIÓN:
    - Servicios Escolares: Dirigir aquí al alumno para trámites de becas, títulos, certificados, constancias y problemas de inscripción oficial.
    - Talleres Extracurriculares: Son actividades para el desarrollo integral.

    CONTEXTO ACTUAL DE TALLERES (Base de Datos):
    ${contextoTalleres}

    REGLAS DE ORO:
    1. Si te preguntan "¿Qué es el CBTis 258?", explica que es una institución de educación media superior técnica en Escobedo.
    2. SIEMPRE termina tus oraciones. No dejes párrafos a la mitad.
    3. Si el alumno pregunta por algo que no conoces, dile amablemente que consulte en la oficina de Servicios Escolares.
    4. Usa un lenguaje amigable (ej: "¡Hola! Con gusto te ayudo...") pero mantén la seriedad institucional.
    `;

    try {
        const maxContinuaciones = 2;
        let promptActual = `${systemInstruction}\n\nPregunta del alumno: ${message}`;
        let respuestaCompleta = '';

        for (let intento = 0; intento <= maxContinuaciones; intento++) {
            const { text, finishReason } = await generarContenidoGemini(apiKey, promptActual);
            respuestaCompleta += (respuestaCompleta ? '\n' : '') + text.trim();

            if (finishReason !== 'MAX_TOKENS') {
                return res.json({ response: respuestaCompleta.trim() });
            }

            promptActual = `${systemInstruction}

La respuesta anterior quedó truncada por límite de tokens. Continúa EXACTAMENTE donde te quedaste, sin repetir contenido y terminando todas las oraciones.

Texto generado hasta ahora:
${respuestaCompleta}`;
        }

        return res.json({ response: respuestaCompleta.trim() });

    } catch (error) {
        console.error("💥 Error fatal chatbot:", error.message);
        return res.status(503).json({ response: "Asistente fuera de línea. Por favor, intenta más tarde." });
    }
});

export default router;