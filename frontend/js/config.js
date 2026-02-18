// frontend/js/config.js

// URL de la API en producción (tu backend en Railway)
const PRODUCTION_API_URL = 'https://backend-talleres-production.up.railway.app/api'; 

// URL de la API en desarrollo (tu máquina local)
const DEVELOPMENT_API_URL = 'http://localhost:5000/api';

// Determinar qué URL usar.
// Si el nombre del host (hostname) NO es 'localhost' o '127.0.0.1', asumimos que estamos en producción.
const IS_DEVELOPMENT = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Esta es la constante que usarás en todos tus demás archivos JS.
const API_BASE_URL = IS_DEVELOPMENT ? DEVELOPMENT_API_URL : PRODUCTION_API_URL;

console.log(`API URL: ${API_BASE_URL}`); // Un log para verificar que está funcionando.