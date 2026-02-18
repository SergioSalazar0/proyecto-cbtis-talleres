import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { testConnection } from './database/config-db.js';

// Importar todas tus rutas
import authRoutes from './routes/auth.js';
import tallerRoutes from './routes/talleres.js';
import avisosRoutes from './routes/avisos.js';
import calendarioRoutes from './routes/calendario.js';
import adminRoutes from './routes/admin.js';
import informacionEmergenciaRoutes from './routes/informacionEmergencia.js';
import chatbotRoutes from './routes/chatbot.js';

import rateLimit from 'express-rate-limit';

// Configuración del escudo: Máximo 5 preguntas cada minuto por usuario
const chatLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 5, 
    message: { response: "Has enviado muchos mensajes. Espera un minuto." },
    standardHeaders: true,
    legacyHeaders: false,
});
// Cargar variables de entorno
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();

// --- 1. CONFIGURACIÓN DE SEGURIDAD ---
// Desactivamos CSP para evitar que bloquee scripts de jQuery o estilos locales en desarrollo
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// --- 2. CONFIGURACIÓN DE CORS (CRUCIAL PARA PUERTO 3000) ---
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// --- 3. MIDDLEWARES DE PARSEO ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- 4. RUTAS DE LA API ---
app.use('/api/auth', authRoutes);
app.use('/api/talleres', tallerRoutes);
app.use('/api/avisos', avisosRoutes);
app.use('/api/calendario', calendarioRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/informacion-emergencia', informacionEmergenciaRoutes);
app.use('/api/chatbot', chatbotRoutes);

// Health check para verificar que el puerto 5000 está vivo
app.get('/api/health', (req, res) => {
    res.json({ status: 'Servidor Backend en puerto 5000 operativo' });
});

// --- 5. MANEJO DE RUTAS NO ENCONTRADAS (404) ---
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Ruta no encontrada',
        message: `El backend no reconoce la ruta: ${req.originalUrl}` 
    });
});

// --- 6. INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        // Intentar conectar a la base de datos antes de arrancar
        const dbConnected = await testConnection();
        
        app.listen(PORT, () => {
            console.log('==============================================');
            console.log(`🚀 BACKEND TALLERES CBTIS 258 ARRANCADO`);
            console.log(`🌍 URL: http://localhost:${PORT}`);
            console.log(`🤖 CHATBOT: http://localhost:${PORT}/api/chatbot/chat`);
            console.log(`🛡️  CORS habilitado para puerto 3000`);
            console.log('==============================================');
        });
    } catch (error) {
        console.error('❌ Error crítico al iniciar servidor:', error);
        process.exit(1);
    }
};

startServer();

export default app;