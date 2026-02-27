import express from 'express';
import dotenv from 'dotenv';
import pool from '../database/config-db.js';
import crypto from 'crypto';
import { optionalAuth } from '../middlewares/auth.js';

dotenv.config();
const router = express.Router();

const MODEL_NAME = "gemini-2.5-flash";
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_HISTORY_MESSAGES = 12;
const chatSessions = new Map();

function getOrCreateSession(sessionId) {
    const id = sessionId && typeof sessionId === 'string' ? sessionId : crypto.randomUUID();
    const existing = chatSessions.get(id);

    if (existing) {
        existing.lastAccess = Date.now();
        return { sessionId: id, session: existing };
    }

    const created = {
        history: [],
        createdAt: Date.now(),
        lastAccess: Date.now()
    };
    chatSessions.set(id, created);
    return { sessionId: id, session: created };
}

function cleanupOldSessions() {
    const now = Date.now();
    for (const [sessionId, session] of chatSessions.entries()) {
        if ((now - session.lastAccess) > SESSION_TTL_MS) {
            chatSessions.delete(sessionId);
        }
    }
}

function normalizePageContext(pageContext = {}) {
    return {
        page: pageContext?.page || 'desconocida',
        section: pageContext?.section || null,
        selectedTallerId: pageContext?.selectedTallerId || null,
        selectedTallerNombre: pageContext?.selectedTallerNombre || null
    };
}

function formatChatHistory(history = []) {
    if (!history.length) return 'Sin historial previo en esta sesión.';

    return history
        .slice(-MAX_HISTORY_MESSAGES)
        .map(item => `${item.role === 'assistant' ? 'Asistente' : 'Usuario'}: ${item.text}`)
        .join('\n');
}

async function getUserScopedContext(user) {
    if (!user) {
        const { rows } = await pool.query(
            `SELECT nombre, categoria, horario
             FROM talleres
             WHERE activo = true
             ORDER BY nombre ASC
             LIMIT 12`
        );

        return {
            roleLabel: 'visitante',
            contextText: rows.length
                ? rows.map(t => `- ${t.nombre} (${t.categoria || 'Sin categoría'}) · Horario: ${t.horario || 'Por definir'}`).join('\n')
                : 'No hay talleres activos para mostrar.'
        };
    }

    if (user.tipo_usuario === 'admin') {
        const [talleresResult, usuariosResult] = await Promise.all([
            pool.query(
                `SELECT nombre, categoria, horario, activo
                 FROM talleres
                 ORDER BY activo DESC, nombre ASC
                 LIMIT 20`
            ),
            pool.query(
                `SELECT
                    COUNT(*) FILTER (WHERE tipo_usuario = 'alumno') AS alumnos,
                    COUNT(*) FILTER (WHERE tipo_usuario = 'instructor') AS instructores,
                    COUNT(*) FILTER (WHERE tipo_usuario = 'admin') AS admins
                 FROM usuarios`
            )
        ]);

        const conteo = usuariosResult.rows[0] || {};
        const talleres = talleresResult.rows || [];

        return {
            roleLabel: 'admin',
            contextText: `Resumen usuarios: alumnos=${conteo.alumnos || 0}, instructores=${conteo.instructores || 0}, admins=${conteo.admins || 0}\n` +
                (talleres.length
                    ? 'Talleres:\n' + talleres.map(t => `- ${t.nombre} (${t.categoria || 'Sin categoría'}) · ${t.activo ? 'Activo' : 'Inactivo'} · Horario: ${t.horario || 'Por definir'}`).join('\n')
                    : 'No hay talleres registrados.')
        };
    }

    if (user.tipo_usuario === 'instructor') {
        const { rows } = await pool.query(
            `SELECT t.id, t.nombre, t.categoria, t.horario
             FROM talleres t
             INNER JOIN perfiles_instructor pi ON t.instructor_id = pi.id
             WHERE pi.usuario_id = $1
             ORDER BY t.nombre ASC`,
            [user.id]
        );

        return {
            roleLabel: 'instructor',
            contextText: rows.length
                ? 'Tus talleres asignados:\n' + rows.map(t => `- ${t.nombre} (${t.categoria || 'Sin categoría'}) · Horario: ${t.horario || 'Por definir'} · ID: ${t.id}`).join('\n')
                : 'No tienes talleres asignados actualmente.'
        };
    }

    if (user.tipo_usuario === 'alumno') {
        const { rows } = await pool.query(
            `SELECT DISTINCT t.id, t.nombre, t.categoria, t.horario
             FROM inscripciones i
             INNER JOIN perfiles_alumno pa ON i.alumno_id = pa.id
             INNER JOIN talleres t ON i.taller_id = t.id
             WHERE pa.usuario_id = $1
               AND i.estado = 'activa'
             ORDER BY t.nombre ASC`,
            [user.id]
        );

        return {
            roleLabel: 'alumno',
            contextText: rows.length
                ? 'Talleres en los que estás inscrito:\n' + rows.map(t => `- ${t.nombre} (${t.categoria || 'Sin categoría'}) · Horario: ${t.horario || 'Por definir'} · ID: ${t.id}`).join('\n')
                : 'No tienes inscripciones activas actualmente.'
        };
    }

    return {
        roleLabel: user.tipo_usuario || 'usuario',
        contextText: 'Sin contexto específico para este rol.'
    };
}

function getPageSpecificInstruction(pageContext) {
    const page = String(pageContext.page || '').toLowerCase();

    if (page.includes('dashboard-admin')) {
        return 'El usuario está en panel admin: prioriza acciones de gestión, reportes y administración.';
    }
    if (page.includes('dashboard-instructor')) {
        return 'El usuario está en panel instructor: prioriza asistencia, calendario de sus talleres y avisos para alumnos.';
    }
    if (page.includes('dashboard-user')) {
        return 'El usuario está en panel alumno: prioriza inscripciones, próximos eventos y avisos de sus talleres.';
    }
    if (page.includes('login')) {
        return 'El usuario está en login: ofrece ayuda de acceso y recuperación de contraseña.';
    }
    if (page.includes('register')) {
        return 'El usuario está en registro: orienta sobre creación de cuenta y requisitos.';
    }

    return 'El usuario está en página pública: responde de forma general sobre la institución y talleres.';
}

function normalizeText(value = '') {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function includesAny(text, terms) {
    return terms.some(term => text.includes(term));
}

function buildTemplateResponse({ message, roleLabel, pageContext }) {
    const text = normalizeText(message);
    const page = normalizeText(pageContext?.page || '');
    const selectedTaller = pageContext?.selectedTallerNombre || null;

    const askingLoginHelp = includesAny(text, ['no puedo iniciar sesion', 'no puedo entrar', 'login', 'contrasena', 'password', 'acceso']);
    if (askingLoginHelp || page.includes('login')) {
        if (includesAny(text, ['contrasena', 'password', 'olvide'])) {
            return 'Para recuperar acceso, intenta primero con tus credenciales correctas y verifica mayúsculas/minúsculas. Si el problema persiste, solicita restablecimiento con administración del sistema o Servicios Escolares según el proceso interno del plantel.';
        }
        return 'Para iniciar sesión: 1) entra a Ingresar, 2) captura correo y contraseña, 3) presiona Entrar. Si falla, revisa conexión, credenciales y que tu cuenta esté activa.';
    }

    if (roleLabel === 'instructor') {
        if (includesAny(text, ['asistencia', 'registrar asistencia', 'qr', 'sesion'])) {
            return `Para asistencia como instructor: 1) abre Alumnos inscritos, 2) selecciona taller${selectedTaller ? ` (${selectedTaller})` : ''}, 3) inicia sesión de escaneo QR, 4) registra alumnos, 5) cierra sesión para guardar conteo y, si necesitas, exporta Excel por sesión.`;
        }
        if (includesAny(text, ['aviso', 'avisos', 'publicar'])) {
            return 'Para publicar avisos: entra a la sección Avisos, crea un nuevo aviso, define taller, título y contenido, y guarda. Después podrás editarlo o eliminarlo según tus permisos.';
        }
        if (includesAny(text, ['evento', 'calendario', 'fecha'])) {
            return `Para calendario en instructor: entra a Calendario, selecciona fecha o botón Nuevo Evento, completa taller/título/tipo/fecha y guarda. Solo podrás gestionar eventos de tus talleres asignados.`;
        }
    }

    if (roleLabel === 'alumno') {
        if (includesAny(text, ['inscribir', 'inscripcion', 'talleres disponibles'])) {
            return 'Para inscribirte: entra a tu dashboard de alumno, ve al módulo de talleres disponibles, elige un taller con cupo y confirma la inscripción. Luego aparecerá en tus inscripciones activas.';
        }
        if (includesAny(text, ['mis talleres', 'inscrito', 'inscripciones'])) {
            return 'Puedes ver tus talleres en el panel de alumno dentro de la sección de inscripciones/mis talleres. Ahí también verás estado y datos básicos del taller.';
        }
        if (includesAny(text, ['calendario', 'evento', 'proximos eventos'])) {
            return 'En tu sección Calendario puedes ver eventos y fechas importantes de los talleres donde estás inscrito. También puedes filtrar por tipo de evento y por taller.';
        }
        if (includesAny(text, ['aviso', 'avisos'])) {
            return 'En la sección Avisos del dashboard de alumno puedes consultar comunicados de tus talleres inscritos y filtrar por taller/tipo.';
        }
    }

    if (roleLabel === 'admin') {
        if (includesAny(text, ['crear instructor', 'instructor', 'usuarios'])) {
            return 'Como admin puedes gestionar usuarios e instructores desde el panel administrativo: crear instructor, ajustar estado de usuario, cambiar contraseña y consultar listados.';
        }
        if (includesAny(text, ['taller', 'crear taller', 'editar taller'])) {
            return 'Como admin puedes crear/editar/eliminar talleres, cambiar estado y revisar detalle de cada taller desde tu dashboard administrativo.';
        }
        if (includesAny(text, ['reporte', 'estadistica', 'dashboard'])) {
            return 'En el dashboard admin puedes consultar reportes de actividad/inscripciones y estadísticas generales para seguimiento del sistema.';
        }
    }

    if (includesAny(text, ['que ofrece', 'que modulos', 'funciones', 'que puede hacer'])) {
        return 'La app ofrece: autenticación por rol, gestión de perfil, talleres, calendario de eventos, avisos, asistencias con QR (instructor/admin), exportación a Excel, panel administrativo y asistente virtual contextual.';
    }

    return null;
}

function getRoleCapabilities(roleLabel) {
    const comunes = `
- Módulos comunes de la app: Login, Registro, Perfil, Calendario, Avisos, Chatbot.
- Talleres públicos: consulta general de oferta en página principal.
`;

    if (roleLabel === 'admin') {
        return `
${comunes}
- Admin puede: gestionar talleres (crear/editar/eliminar), administrar usuarios, crear instructores, cambiar estados y revisar reportes.
- Admin puede consultar estadísticas globales del sistema.
`;
    }

    if (roleLabel === 'instructor') {
        return `
${comunes}
- Instructor puede: ver sus talleres asignados, gestionar calendario de sus talleres, publicar avisos, ver alumnos inscritos y registrar asistencias.
- Instructor puede abrir/cerrar sesiones de asistencia y exportar asistencias en Excel por sesión.
`;
    }

    if (roleLabel === 'alumno') {
        return `
${comunes}
- Alumno puede: ver talleres disponibles, inscribirse, consultar sus inscripciones activas y revisar calendario/avisos de sus talleres.
- Alumno puede actualizar su perfil y consultar información general en el panel de usuario.
`;
    }

    return `
${comunes}
- Visitante puede: explorar información general, ver categorías de talleres y dirigirse a login/registro.
`;
}

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

async function obtenerContextoGeneralDesdeDB() {
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

router.post('/chat', optionalAuth, async (req, res) => {
    cleanupOldSessions();

    const { message, sessionId: incomingSessionId, pageContext } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensaje vacío' });

    const normalizedPageContext = normalizePageContext(pageContext);
    const { sessionId, session } = getOrCreateSession(incomingSessionId);

    const [contextoGeneral, contextoRol] = await Promise.all([
        obtenerContextoGeneralDesdeDB(),
        getUserScopedContext(req.user)
    ]);

    const templateResponse = buildTemplateResponse({
        message,
        roleLabel: contextoRol.roleLabel,
        pageContext: normalizedPageContext
    });

    if (templateResponse) {
        const userMessage = String(message).trim();
        const assistantMessage = templateResponse;

        session.history.push({ role: 'user', text: userMessage, ts: Date.now() });
        session.history.push({ role: 'assistant', text: assistantMessage, ts: Date.now() });

        if (session.history.length > MAX_HISTORY_MESSAGES) {
            session.history = session.history.slice(-MAX_HISTORY_MESSAGES);
        }

        return res.json({ response: assistantMessage, sessionId, source: 'template' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY no está configurada');
        return res.status(500).json({ response: 'Configuración incompleta del asistente. Contacta al administrador.' });
    }

    // --- IDENTIDAD INSTITUCIONAL MEJORADA ---
    const pageInstruction = getPageSpecificInstruction(normalizedPageContext);
    const historialTexto = formatChatHistory(session.history);
    const roleCapabilities = getRoleCapabilities(contextoRol.roleLabel);

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

    FUNCIONALIDADES REALES DE LA APP WEB (BASE DE CONOCIMIENTO INTERNA):
    ${roleCapabilities}

    GUÍA DE RESPUESTA DENTRO DEL SISTEMA:
    - Si el usuario pregunta "cómo hacer algo", responde con pasos concretos dentro de la app según su rol y la página actual.
    - Prioriza siempre resolver con funciones de la plataforma antes de escalar a un área externa.
    - Si el usuario está en dashboard, menciona la sección/módulo que debe abrir para completar la acción.

    CONTEXTO ACTUAL DE TALLERES (GENERAL):
    ${contextoGeneral}

    CONTEXTO SEGÚN USUARIO (PERMISOS):
    - Rol detectado: ${contextoRol.roleLabel}
    - Datos disponibles para este usuario:
    ${contextoRol.contextText}

    CONTEXTO DE PÁGINA ACTUAL:
    - Página: ${normalizedPageContext.page}
    - Sección activa: ${normalizedPageContext.section || 'N/A'}
    - Taller seleccionado (ID): ${normalizedPageContext.selectedTallerId || 'N/A'}
    - Taller seleccionado (Nombre): ${normalizedPageContext.selectedTallerNombre || 'N/A'}
    - Instrucción de página: ${pageInstruction}

    HISTORIAL RECIENTE DE LA SESIÓN:
    ${historialTexto}

    REGLAS DE ORO:
    1. Si te preguntan "¿Qué es el CBTis 258?", explica que es una institución de educación media superior técnica en Escobedo.
    2. SIEMPRE termina tus oraciones. No dejes párrafos a la mitad.
    3. SOLO deriva a Servicios Escolares cuando sea un trámite externo al sistema (becas, certificados, títulos, constancias, cambios administrativos oficiales).
    4. Usa un lenguaje amigable (ej: "¡Hola! Con gusto te ayudo...") pero mantén la seriedad institucional.
    5. Nunca ofrezcas acceso a datos fuera de los talleres permitidos por el rol detectado.
    6. Si el usuario pide algo de otro rol, explica la limitación y sugiere el canal correcto.
    7. Evita responder con "ve a Servicios Escolares" si existe una acción que sí puede hacerse dentro de la app.
    `;

    try {
        const maxContinuaciones = 2;
        let promptActual = `${systemInstruction}\n\nPregunta del alumno: ${message}`;
        let respuestaCompleta = '';

        for (let intento = 0; intento <= maxContinuaciones; intento++) {
            const { text, finishReason } = await generarContenidoGemini(apiKey, promptActual);
            respuestaCompleta += (respuestaCompleta ? '\n' : '') + text.trim();

            if (finishReason !== 'MAX_TOKENS') {
                const userMessage = String(message).trim();
                const assistantMessage = respuestaCompleta.trim();

                session.history.push({ role: 'user', text: userMessage, ts: Date.now() });
                session.history.push({ role: 'assistant', text: assistantMessage, ts: Date.now() });

                if (session.history.length > MAX_HISTORY_MESSAGES) {
                    session.history = session.history.slice(-MAX_HISTORY_MESSAGES);
                }

                return res.json({ response: assistantMessage, sessionId });
            }

            promptActual = `${systemInstruction}

La respuesta anterior quedó truncada por límite de tokens. Continúa EXACTAMENTE donde te quedaste, sin repetir contenido y terminando todas las oraciones.

Texto generado hasta ahora:
${respuestaCompleta}`;
        }

        const userMessage = String(message).trim();
        const assistantMessage = respuestaCompleta.trim();

        session.history.push({ role: 'user', text: userMessage, ts: Date.now() });
        session.history.push({ role: 'assistant', text: assistantMessage, ts: Date.now() });

        if (session.history.length > MAX_HISTORY_MESSAGES) {
            session.history = session.history.slice(-MAX_HISTORY_MESSAGES);
        }

        return res.json({ response: assistantMessage, sessionId });

    } catch (error) {
        console.error("💥 Error fatal chatbot:", error.message);
        return res.status(503).json({ response: "Asistente fuera de línea. Por favor, intenta más tarde.", sessionId });
    }
});

router.post('/clear-session', (req, res) => {
    const { sessionId } = req.body || {};

    if (!sessionId || !chatSessions.has(sessionId)) {
        return res.json({ message: 'Sesión no encontrada o ya limpia' });
    }

    chatSessions.delete(sessionId);
    return res.json({ message: 'Sesión limpiada correctamente' });
});

export default router;