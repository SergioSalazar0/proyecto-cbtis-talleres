import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pkg;

/**
 * Configuración del pool de conexiones PostgreSQL
 */
const poolConfig = {
    // URL de conexión desde variables de entorno
    connectionString: process.env.DATABASE_URL,
    
    // Configuración SSL para Railway
    ssl: {
        rejectUnauthorized: false
    },
    
    // Configuración del pool
    max: 20, 
    min: 2,  
    idleTimeoutMillis: 30000, 
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '10000', 10),
    acquireTimeoutMillis: 60000, 
    keepAlive: true,
    keepAliveInitialDelayMillis: parseInt(process.env.DB_KEEPALIVE_DELAY_MS || '10000', 10),
    
    // Configuración adicional
    allowExitOnIdle: false, 
    
    // Configuración de queries
    statement_timeout: 30000, 
    query_timeout: 30000,    
    
    // Configuración de aplicación
    application_name: 'talleres_cbtis258_api',
    
    // IMPORTANTE: Configuración de encoding UTF-8
    client_encoding: 'UTF8'
};

// Crear el pool de conexiones
const pool = new Pool(poolConfig);

/**
 * Manejo de eventos del pool para monitoring y debugging
 */

// Evento cuando se conecta un nuevo cliente
pool.on('connect', async (client) => {
    try {
        await client.query("SET CLIENT_ENCODING TO 'UTF8'");
        await client.query("SET NAMES 'UTF8'");
        if (process.env.NODE_ENV === 'development') {
            console.log('🔗 Nueva conexión establecida con la base de datos (UTF-8)');
        }
    } catch (err) {
        console.error('❌ Error configurando encoding UTF-8:', err.message);
    }
});

// Evento cuando se libera un cliente
pool.on('release', (err, client) => {
    if (err) {
        console.error('❌ Error al liberar cliente de base de datos:', err.message);
    }
});

// Evento de error en el pool
pool.on('error', (err, client) => {
    console.error('❌ Error inesperado en el pool de base de datos:', err.message);
});

// Evento cuando se remueve un cliente
pool.on('remove', (client) => {
    if (process.env.NODE_ENV === 'development') {
        console.log('🗑️ Cliente removido del pool de base de datos');
    }
});

/**
 * Función para probar la conexión a la base de datos
 */
export const testConnection = async () => {
    let client;
    try {
        console.log('🔄 Probando conexión a la base de datos...');
        
        client = await pool.connect();
        const result = await client.query('SELECT NOW() as current_time, version() as db_version');
        
        console.log('✅ Conexión a base de datos exitosa');
        console.log(`📅 Fecha servidor DB: ${result.rows[0].current_time}`);
        console.log(`🗄️ Versión PostgreSQL: ${result.rows[0].db_version.split(',')[0]}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error al conectar con la base de datos:');
        console.error(`   Mensaje: ${error.message}`);
        console.error(`   Código: ${error.code}`);
        
        return false;
        
    } finally {
        if (client) {
            client.release();
        }
    }
};

/**
 * Función para ejecutar queries
 */
export const query = async (text, params = []) => {
    const start = Date.now();
    let client;
    
    try {
        client = await pool.connect();
        const result = await client.query(text, params);
        
        const duration = Date.now() - start;
        if (duration > 1000) {
            console.warn(`⚠️ Query lento detectado (${duration}ms):`, text.substring(0, 200));
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Error en query:', error.message);
        throw error;
        
    } finally {
        if (client) {
            client.release();
        }
    }
};

/**
 * Función para ejecutar transacciones
 */
export const transaction = async (callback) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en transacción, haciendo rollback:', error.message);
        throw error;
        
    } finally {
        client.release();
    }
};

/**
 * Función para obtener estadísticas del pool
 */
export const getPoolStats = () => {
    return {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
        maxConnections: poolConfig.max,
        activeConnections: pool.totalCount - pool.idleCount
    };
};

/**
 * Función para cerrar todas las conexiones del pool
 */
export const closePool = async () => {
    try {
        console.log('🔄 Cerrando pool de conexiones...');
        await pool.end();
        console.log('✅ Pool de conexiones cerrado correctamente');
    } catch (error) {
        console.error('❌ Error al cerrar pool de conexiones:', error.message);
        throw error;
    }
};

export default pool;

// Manejar cierre graceful del proceso
process.on('SIGTERM', closePool);
process.on('SIGINT', closePool);