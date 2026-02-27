import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import rateLimit from 'express-rate-limit';
import { testConnection } from './database/config-db.js';

// Importar rutas
import authRoutes from './routes/auth.js';
import tallerRoutes from './routes/talleres.js';
import avisosRoutes from './routes/avisos.js';
import calendarioRoutes from './routes/calendario.js';
import adminRoutes from './routes/admin.js';
import informacionEmergenciaRoutes from './routes/informacionEmergencia.js';
import chatbotRoutes from './routes/chatbot.js';

dotenv.config();

const app = express();

// --- 1. CONFIGURACIÓN DE SEGURIDAD Y MIDDLEWARES ---
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// Rate Limit para el Chatbot (Integrado correctamente)
const chatLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 5, 
    message: { error: "Has superado el límite de mensajes. Espera un minuto." },
    standardHeaders: true,
    legacyHeaders: false,
});

// CORS Dinámico (Combina variables de entorno y locales)
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5500',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- 2. RUTAS DE LA API ---
app.get('/', (req, res) => res.status(200).send('Servidor CBTIS 258 Operativo'));
app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

app.use('/api/auth', authRoutes);
app.use('/api/talleres', tallerRoutes);
app.use('/api/avisos', avisosRoutes);
app.use('/api/calendario', calendarioRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/informacion-emergencia', informacionEmergenciaRoutes);

// Aplicación del middleware de límite aquí
app.use('/api/chatbot', chatLimiter, chatbotRoutes);

// --- 3. MANEJO DE ERRORES ---
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((err, req, res, next) => {
    console.error('❌ ERROR CRÍTICO:', err.stack);
    res.status(500).json({ error: 'Error interno del servidor', message: err.message });
});

// --- 4. INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 5000;

process.on('uncaughtException', (err) => {
    console.error('❌ EXCEPCIÓN NO CAPTURADA:', err);
    process.exit(1); // Esto nos dirá en los logs EXACTAMENTE por qué muere
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ PROMESA NO MANEJADA:', reason);
    process.exit(1);
});

const startServer = async () => {
    try {
        await testConnection();
        // Escuchar en '0.0.0.0' es vital para Railway/Docker
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
        });
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        process.exit(1);
    }
};

startServer();

export default app;