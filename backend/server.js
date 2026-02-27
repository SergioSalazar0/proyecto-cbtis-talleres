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

dotenv.config(); // Movido arriba para asegurar que las variables carguen primero

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();

// --- 1. CONFIGURACIÓN DE SEGURIDAD ---
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Lista de URLs permitidas (He incluido todas las que has usado)
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5500',
    'https://proyecto-cbtis-talleres-osbk.vercel.app',
    'https://proyecto-cbtis-talleres-osbk-akspyk5bs-sergiosalazar0s-projects.vercel.app',
    process.env.FRONTEND_URL // Mantenemos la variable de Railway por seguridad
].filter(Boolean); // Elimina valores nulos o vacíos

app.use(cors({
    origin: function (origin, callback) {
        // Permitir si el origen está en la lista o si no hay origen (como Postman o el Health Check)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log("⚠️ Intento de conexión bloqueado por CORS desde:", origin);
            callback(new Error('No permitido por la política de CORS de Sergio'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200 // Importante para navegadores antiguos y preflights
}));

// --- 2. CONFIGURACIÓN DEL ESCUDO (Rate Limit) ---
const chatLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 10, // Subí un poco el rango para evitar bloqueos accidentales en pruebas
    message: { response: "Has enviado muchos mensajes. Espera un minuto." },
    standardHeaders: true,
    legacyHeaders: false,
});

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
    res.json({ 
        status: 'OK',
        message: 'Servidor Backend operativo',
        timestamp: new Date().toISOString()
    });
});

// --- 5. MANEJO DE RUTAS NO ENCONTRADAS (404) ---
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Ruta no encontrada',
        message: `El backend no reconoce la ruta: ${req.originalUrl}` 
    });
});

// --- 6. MANEJO GLOBAL DE ERRORES (Anti-CORS silencioso) ---
// Este bloque es vital para que si algo explota, el navegador reciba un JSON y no un error de red
app.use((err, req, res, next) => {
    console.error('❌ ERROR INTERNO:', err.stack);
    res.status(500).json({
        error: 'Error interno del servidor',
        message: err.message
    });
});

// --- 7. INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        console.log('--- Iniciando orquestación de servicios ---');
        
        const dbConnected = await testConnection();
        
        if (!dbConnected) {
            console.error('⚠️ ATENCIÓN: La conexión a la BD falló.');
        } else {
            console.log('✅ Conexión a base de datos exitosa.');
        }

        app.listen(PORT, '0.0.0.0', () => {
            console.log('==============================================');
            console.log(`🚀 BACKEND ARRANCADO EN PUERTO ${PORT}`);
            console.log(`🌍 MODO: ${process.env.NODE_ENV || 'development'}`);
            console.log('==============================================');
        });

    } catch (error) {
        console.error('❌ Error crítico en startup:', error);
        process.exit(1); 
    }
};

startServer();

export default app;