// frontend/js/config.js

// URL de la API en producción (backend en Railway)
const PRODUCTION_API_URL = 'https://proyecto-cbtis-talleres-production.up.railway.app/api';

// URL de la API en desarrollo local
const DEVELOPMENT_API_URL = 'http://localhost:5000/api';

const hostname = window.location.hostname;
const IS_DEVELOPMENT = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

// Permite sobreescribir en tiempo de ejecución si se define antes de este script.
const RUNTIME_API_URL = window.__API_BASE_URL__ || window.API_BASE_URL_OVERRIDE;

const resolvedApiBaseUrl = (RUNTIME_API_URL || (IS_DEVELOPMENT ? DEVELOPMENT_API_URL : PRODUCTION_API_URL)).replace(/\/+$/, '');

// Constante global para uso en el resto de scripts
const API_BASE_URL = resolvedApiBaseUrl;
window.API_BASE_URL = resolvedApiBaseUrl;

console.log(`API URL: ${API_BASE_URL}`);