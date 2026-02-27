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

// Configuración del escudo
const chatLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 5, 
    message: { response: "Has enviado muchos mensajes. Espera un minuto." },
    standardHeaders: true,
    legacyHeaders: false,
});

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();

// --- 1. CONFIGURACIÓN DE SEGURIDAD ---
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// --- 2. CONFIGURACIÓN DE CORS ---
const allowedOrigins = [
    'http://localhost:3000', 
    'http://127.0.0.1:3000', 
    'http://localhost:5500', 
    'http://127.0.0.1:5500',
    process.env.FRONTEND_URL 
].filter(Boolean);

app.use(cors({
    origin: allowedOrigins,
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

app.get('/api/health', (req, res) => {
    res.json({ status: 'Servidor Backend en puerto 5000 operativo' });
});

// --- 5. MANEJO DE RUTAS NO ENCONTRADAS ---
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Ruta no encontrada',
        message: `El backend no reconoce la ruta: ${req.originalUrl}` 
    });
});

// --- 6. INICIO DEL SERVIDOR (MODO ANTICRASH) ---
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        console.log('--- Iniciando orquestación de servicios ---');
        
        // Intentamos conectar a la BD
        const dbConnected = await testConnection();
        
        if (!dbConnected) {
            console.error('⚠️ ATENCIÓN: La conexión a la BD falló.');
            console.error('⚠️ El servidor arrancará de todos modos para que puedas ver el error en los logs.');
        } else {
            console.log('✅ Conexión a base de datos exitosa.');
        }

        app.listen(PORT, '0.0.0.0', () => {
            console.log('==============================================');
            console.log(`🚀 BACKEND TALLERES CBTIS 258 ARRANCADO en puerto ${PORT}`);
            console.log(`🌍 URL: http://localhost:${PORT}`);
            console.log('==============================================');
        });

    } catch (error) {
        console.error('❌ Error crítico en startup:', error);
        // Solo salimos si el servidor no puede ni siquiera levantar el puerto
        process.exit(1); 
    }
};

startServer();

export default app;