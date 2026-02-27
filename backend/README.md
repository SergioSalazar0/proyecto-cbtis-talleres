# API Backend - Sistema de Gestión de Talleres CBTIS 258

Backend desarrollado con Node.js, Express y PostgreSQL para la gestión integral de talleres estudiantiles (inscripciones, avisos, calendario, asistencias, administración, información de emergencia y chatbot institucional).

## 🚀 Tecnologías Utilizadas

- **Node.js** v22+ con ES6 Modules
- **Express.js** v5 - Framework web
- **PostgreSQL** 17.6 - Base de datos
- **JWT** - Autenticación stateless
- **bcryptjs** - Hash de contraseñas
- **express-validator** - Validación de datos
- **helmet** - Seguridad HTTP
- **cors** - Control de acceso cross-origin
- **express-rate-limit** - Protección contra ataques
- **Google Gemini API** - Respuestas del asistente virtual

## 📁 Estructura del Proyecto

```
backend/
├── server.js              # Punto de entrada principal
├── package.json           # Dependencias y scripts
├── .env                   # Variables de entorno
├── database/
│   ├── config-db.js      # Configuración del pool PostgreSQL
│   └── schema.sql        # Esquema de base de datos
├── middlewares/
│   ├── auth.js           # Autenticación y autorización JWT
│   └── validation.js     # Validaciones con express-validator
├── models/
│   ├── User.js           # Modelo de usuarios
│   ├── Taller.js         # Modelo de talleres
│   ├── Aviso.js          # Modelo de avisos
│   ├── Calendario.js     # Modelo de calendario/eventos
│   └── Inscripcion.js    # Modelo de inscripciones
├── controllers/
│   ├── authController.js      # Controlador de autenticación
│   ├── tallerController.js    # Controlador de talleres
│   ├── avisoController.js     # Controlador de avisos
│   ├── calendarioController.js # Controlador de calendario
│   └── informacionEmergenciaController.js # Controlador de emergencia
└── routes/
    ├── auth.js           # Rutas de autenticación
    ├── talleres.js       # Rutas de talleres
    ├── avisos.js         # Rutas de avisos
    ├── calendario.js     # Rutas de calendario
  ├── informacionEmergencia.js # Rutas de emergencia
  ├── chatbot.js        # Rutas de asistente virtual
  └── admin.js          # Rutas administrativas
```

## ⚙️ Configuración e Instalación

### 1. Variables de Entorno (.env)

```env
# Servidor
PORT=5000
NODE_ENV=development

# Base de datos PostgreSQL
DATABASE_URL=postgresql://postgres:root@localhost:5432/talleres_cbtis258

# JWT
JWT_SECRET=tu_jwt_secret_super_seguro_aqui
JWT_EXPIRES_IN=24h

# Chatbot
GEMINI_API_KEY=tu_api_key_gemini

# CORS
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Email de avisos (Gmail SMTP)
EMAIL_ENABLED=false
GMAIL_USER=tu_correo@gmail.com
GMAIL_APP_PASSWORD=tu_app_password_de_16_caracteres
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_FROM_NAME=Sistema Talleres CBTIS 258
EMAIL_FROM_ADDRESS=tu_correo@gmail.com
```

### Envío de avisos por Gmail

- El endpoint `POST /api/avisos` ya puede enviar correo a alumnos inscritos del taller.
- No requiere cambios en base de datos.
- Para activarlo, establece `EMAIL_ENABLED=true` y configura `GMAIL_USER` + `GMAIL_APP_PASSWORD`.
- Recomendación: usa contraseña de aplicación de Google (no tu contraseña normal).

### 2. Base de Datos

1. Crear base de datos PostgreSQL:
```sql
CREATE DATABASE talleres_cbtis258;
```

2. Ejecutar el esquema:
```bash
psql -d talleres_cbtis258 -f database/schema.sql
```

### 3. Instalación de Dependencias

```bash
npm install
```

### 4. Scripts Disponibles

```bash
# Iniciar en producción
npm start

# Desarrollo con nodemon
npm run dev

# Probar conexión a DB
npm run db:test

# Linting
npm run lint
npm run lint:fix
```

## 👥 Roles y Permisos

### Alumno
- ✅ Registro automático
- ✅ Ver talleres disponibles
- ✅ Inscribirse a talleres
- ✅ Ver sus inscripciones
- ✅ Ver avisos de sus talleres
- ✅ Ver calendario de eventos
- ✅ Gestionar información de emergencia
- ✅ Consultar asistente virtual institucional

### Instructor
- ✅ Todas las funciones de alumno
- ✅ Ver alumnos inscritos en sus talleres
- ✅ Crear/editar avisos para sus talleres
- ✅ Crear/editar eventos de calendario
- ✅ Gestionar sus talleres asignados
- ✅ Registrar asistencias por sesión
- ✅ Gestionar sesiones de asistencia (apertura/cierre)

### Administrador
- ✅ Todas las funciones anteriores
- ✅ Crear/editar/eliminar talleres
- ✅ Crear instructores
- ✅ Cambiar contraseñas de usuarios
- ✅ Dar de baja usuarios
- ✅ Ver reportes y estadísticas
- ✅ Gestión completa del sistema

## 🔗 Endpoints de la API

### Base URL: `http://localhost:5000/api`

### 🔐 Autenticación (`/auth`)

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| `POST` | `/auth/login` | Iniciar sesión | ❌ |
| `POST` | `/auth/register` | Registrar alumno | ❌ |
| `PUT` | `/auth/complete-profile` | Completar perfil | ✅ Alumno |
| `GET` | `/auth/verify` | Verificar token | ✅ |
| `POST` | `/auth/refresh` | Renovar token | ✅ |
| `PUT` | `/auth/change-password` | Cambiar contraseña | ✅ |
| `POST` | `/auth/logout` | Cerrar sesión | ✅ |
| `GET` | `/auth/profile` | Obtener perfil | ✅ |
| `PUT` | `/auth/profile` | Actualizar perfil | ✅ |

### 🎯 Talleres (`/talleres`)

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| `GET` | `/talleres` | Listar todos los talleres | ❌ |
| `GET` | `/talleres/categoria/:categoria` | Talleres por categoría | ❌ |
| `GET` | `/talleres/disponibles` | Talleres con cupo | ✅ |
| `GET` | `/talleres/mis-inscripciones` | Inscripciones del alumno | ✅ Alumno |
| `GET` | `/talleres/mis-talleres` | Talleres del usuario | ✅ |
| `GET` | `/talleres/estadisticas` | Estadísticas | ✅ Admin/Instructor |
| `GET` | `/talleres/:id` | Detalle de taller | ❌ |
| `POST` | `/talleres` | Crear taller | ✅ Admin |
| `PUT` | `/talleres/:id` | Actualizar taller | ✅ Admin/Instructor |
| `DELETE` | `/talleres/:id` | Eliminar taller | ✅ Admin |
| `GET` | `/talleres/:id/alumnos` | Alumnos inscritos | ✅ Admin/Instructor |
| `GET` | `/talleres/:id/asistencias` | Asistencias por fecha | ✅ Admin/Instructor |
| `POST` | `/talleres/:id/asistencias` | Registrar asistencia | ✅ Admin/Instructor |
| `GET` | `/talleres/:id/sesiones-asistencia` | Historial de sesiones | ✅ Admin/Instructor |
| `POST` | `/talleres/:id/sesiones-asistencia` | Crear sesión | ✅ Admin/Instructor |
| `PUT` | `/talleres/:id/sesiones-asistencia/:sesionId` | Actualizar sesión | ✅ Admin/Instructor |
| `POST` | `/talleres/:id/sesiones-asistencia/:sesionId/incrementar` | Incrementar contador | ✅ Admin/Instructor |
| `POST` | `/talleres/:id/inscripcion` | Inscribirse | ✅ Alumno |
| `GET` | `/talleres/:id/cupo` | Verificar cupo | ❌ |

### 📢 Avisos (`/avisos`)

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| `GET` | `/avisos/importantes` | Avisos importantes | ❌ |
| `GET` | `/avisos/mis-avisos` | Avisos del usuario | ✅ |
| `GET` | `/avisos/alumno` | Avisos para alumno | ✅ Alumno |
| `GET` | `/avisos/proximos-expirar` | Próximos a expirar | ✅ Instructor/Admin |
| `GET` | `/avisos/estadisticas` | Estadísticas | ✅ Instructor/Admin |
| `GET` | `/avisos/search` | Buscar avisos | ✅ |
| `GET` | `/avisos/taller/:tallerId` | Avisos de un taller | ✅ |
| `GET` | `/avisos/:id` | Detalle de aviso | ✅ |
| `POST` | `/avisos` | Crear aviso | ✅ Instructor |
| `PUT` | `/avisos/:id` | Actualizar aviso | ✅ Admin/Instructor |
| `DELETE` | `/avisos/:id` | Eliminar aviso | ✅ Admin/Instructor |

### 📅 Calendario (`/calendario`)

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| `GET` | `/calendario/eventos-hoy` | Eventos de hoy | ❌ |
| `GET` | `/calendario/mis-fechas` | Fechas del usuario | ✅ |
| `GET` | `/calendario/eventos-proximos` | Próximos eventos (alumno) | ✅ Alumno |
| `GET` | `/calendario/mensual` | Vista mensual | ✅ |
| `GET` | `/calendario/rango` | Eventos en rango | ✅ |
| `GET` | `/calendario/estadisticas` | Estadísticas | ✅ Instructor/Admin |
| `GET` | `/calendario/search` | Buscar eventos | ✅ |
| `GET` | `/calendario/tipo/:tipo` | Eventos por tipo | ✅ |
| `GET` | `/calendario/taller/:tallerId` | Eventos de taller | ✅ |
| `GET` | `/calendario/:id` | Detalle de evento | ✅ |
| `POST` | `/calendario` | Crear evento | ✅ Instructor |
| `PUT` | `/calendario/:id` | Actualizar evento | ✅ Admin/Instructor |
| `DELETE` | `/calendario/:id` | Eliminar evento | ✅ Admin/Instructor |

### 🆘 Información de Emergencia (`/informacion-emergencia`)

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| `GET` | `/informacion-emergencia/mi-informacion` | Obtener info de emergencia del alumno | ✅ Alumno |
| `POST` | `/informacion-emergencia/` | Crear/actualizar info de emergencia | ✅ Alumno |
| `PUT` | `/informacion-emergencia/` | Actualizar info (alias) | ✅ Alumno |
| `DELETE` | `/informacion-emergencia/:id` | Eliminar info de emergencia | ✅ Alumno |

### 🤖 Chatbot (`/chatbot`)

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| `POST` | `/chatbot/chat` | Consulta al asistente virtual CBTis 258 | ❌ |

### ⚙️ Administración (`/admin`)

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| `GET` | `/admin/dashboard` | Dashboard admin | ✅ Admin |
| `GET` | `/admin/usuarios` | Listar usuarios | ✅ Admin |
| `PUT` | `/admin/usuarios/:id/status` | Cambiar estado | ✅ Admin |
| `PUT` | `/admin/usuarios/:id/password` | Cambiar contraseña | ✅ Admin |
| `PUT` | `/admin/usuarios/:id/numero-control` | Actualizar número de control | ✅ Admin |
| `DELETE` | `/admin/usuarios/:id` | Eliminar usuario | ✅ Admin |
| `GET` | `/admin/reportes/inscripciones` | Reporte inscripciones | ✅ Admin |
| `GET` | `/admin/reportes/actividad` | Reporte actividad | ✅ Admin |
| `POST` | `/admin/usuarios/instructor` | Crear instructor | ✅ Admin |
| `GET` | `/admin/instructores` | Listar instructores | ✅ Admin |
| `PUT` | `/admin/instructores/:usuarioId` | Actualizar instructor | ✅ Admin |
| `GET` | `/admin/talleres` | Listar talleres para administración | ✅ Admin |
| `GET` | `/admin/talleres/:id` | Detalle de taller para administración | ✅ Admin |
| `POST` | `/admin/talleres` | Crear taller (admin) | ✅ Admin |
| `PUT` | `/admin/talleres/:id` | Actualizar taller (admin) | ✅ Admin |
| `PUT` | `/admin/talleres/:id/status` | Cambiar estado de taller | ✅ Admin |
| `DELETE` | `/admin/talleres/:id` | Eliminar taller (admin) | ✅ Admin |
| `POST` | `/admin/asistencias/registrar` | Registrar asistencia (módulo admin) | ✅ Admin |
| `GET` | `/admin/asistencias` | Consultar asistencias | ✅ Admin |
| `GET` | `/admin/sistema/info` | Info del sistema | ✅ Admin |

### 🏥 Health Check

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| `GET` | `/health` | Estado del servidor | ❌ |

## 🧪 Pruebas con Thunder Client

### Paso 1: Instalación
1. Instala la extensión **Thunder Client** en VS Code
2. Abre VS Code y ve a la barra lateral izquierda
3. Haz clic en el ícono de Thunder Client (⚡)

### Paso 2: Configuración del Entorno
1. Crea un nuevo entorno llamado "CBTIS 258 Local"
2. Agrega las siguientes variables:
```json
{
  "baseUrl": "http://localhost:5000/api",
  "authToken": ""
}
```

### Paso 3: Secuencia de Pruebas

#### 3.1 Health Check
```
GET {{baseUrl}}/health
```

#### 3.2 Registro de Usuario (Simplificado)
```
POST {{baseUrl}}/auth/register
Content-Type: application/json

{
  "email": "juan.perez@estudiante.cbtis258.edu.mx",
  "password": "Password123"
}
```

#### 3.2.1 Completar Perfil (Después del registro)
```
PUT {{baseUrl}}/auth/complete-profile
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "nombre": "Juan",
  "apellido_paterno": "Pérez",
  "apellido_materno": "García",
  "numero_control": "22480001",
  "grupo": "5A TV",
  "especialidad": "Programación",
  "telefono": "4771234567",
  "fecha_nacimiento": "2005-03-15"
}
```

#### 3.3 Login
```
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "email": "juan.perez@estudiante.cbtis258.edu.mx",
  "password": "Password123"
}
```

**⚠️ Importante:** Copia el `token` de la respuesta y actualiza la variable `authToken` en tu entorno.

#### 3.4 Ver Talleres (Sin autenticación)
```
GET {{baseUrl}}/talleres
```

#### 3.5 Ver Talleres Disponibles (Con autenticación)
```
GET {{baseUrl}}/talleres/disponibles
Authorization: Bearer {{authToken}}
```

#### 3.6 Inscribirse a un Taller
```
POST {{baseUrl}}/talleres/{taller_id}/inscripcion
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "comentarios": "Me interesa mucho este taller"
}
```

#### 3.7 Ver Mis Talleres
```
GET {{baseUrl}}/talleres/mis-talleres
Authorization: Bearer {{authToken}}
```

#### 3.8 Ver Avisos Importantes
```
GET {{baseUrl}}/avisos/importantes
```

#### 3.9 Ver Eventos de Hoy
```
GET {{baseUrl}}/calendario/eventos-hoy
```

#### 3.10 Ver Mi Perfil
```
GET {{baseUrl}}/auth/profile
Authorization: Bearer {{authToken}}
```

### Paso 4: Pruebas Administrativas

Para probar funciones administrativas, necesitas crear un usuario administrador. Usa el script incluido para generar el hash de contraseña:

```bash
# Generar hash de contraseña
node generate-admin-hash.js
```

Luego ejecuta este INSERT en PostgreSQL con el hash generado:

```sql
-- Conectar a PostgreSQL y ejecutar:
INSERT INTO usuarios (id, email, password_hash, tipo_usuario, activo) 
VALUES (
  gen_random_uuid(), 
  'admin@cbtis258.edu.mx', 
  'TU_HASH_GENERADO_AQUI', 
  'admin', 
  true
);
```

Luego usar las credenciales de admin (`admin@cbtis258.edu.mx` / `Password123`) para hacer login y probar endpoints administrativos.

### Paso 5: Colección de Thunder Client

Puedes crear una colección completa con todas estas peticiones organizadas por categorías:

1. **Health & Auth**
   - Health Check
   - Register
   - Login
   - Profile

2. **Talleres**
   - Listar Talleres
   - Talleres por Categoría
   - Talleres Disponibles
   - Inscripción

3. **Avisos**
   - Avisos Importantes
   - Mis Avisos
   - Crear Aviso (Instructor/Admin)

4. **Calendario**
   - Eventos Hoy
   - Eventos Próximos
   - Vista Mensual

5. **Admin** (Solo con token de admin)
   - Dashboard
   - Usuarios
   - Reportes

## 🔒 Autenticación JWT

### Headers Requeridos
```
Authorization: Bearer tu_jwt_token_aqui
Content-Type: application/json
```

### Estructura del Token
```json
{
  "userId": "uuid",
  "email": "usuario@email.com",
  "userType": "alumno|instructor|admin",
  "iat": 1698678234,
  "exp": 1698764634
}
```

## 📊 Códigos de Respuesta

| Código | Descripción |
|--------|-------------|
| `200` | Éxito |
| `201` | Creado exitosamente |
| `400` | Error de validación |
| `401` | No autorizado |
| `403` | Prohibido |
| `404` | No encontrado |
| `409` | Conflicto (datos duplicados) |
| `429` | Demasiadas peticiones |
| `500` | Error interno del servidor |

## 🚨 Manejo de Errores

### Ejemplo de Respuesta de Error
```json
{
  "error": "Error de validación",
  "message": "El email ya está registrado",
  "details": [
    {
      "field": "email",
      "message": "Email already exists"
    }
  ]
}
```

## 🔧 Desarrollo

### Estructura de Respuestas Exitosas
```json
{
  "success": true,
  "data": { /* datos */ },
  "message": "Operación exitosa"
}
```

### Logs del Servidor
En modo desarrollo, todas las peticiones se registran:
```
2025-10-30T21:42:28.123Z - GET /api/talleres - IP: ::1
```

## 📝 Notas Importantes

1. **Rate Limiting**: 100 requests por 15 minutos por IP
2. **Auth Rate Limiting**: 5 intentos de login por 15 minutos por IP
3. **CORS**: Configurado para frontend local y Live Server
4. **Validación**: Todos los inputs son validados y sanitizados
5. **Seguridad**: Headers de seguridad con Helmet
6. **Passwords**: Hash con bcryptjs (10 rounds)
7. **Transacciones**: Operaciones críticas usan transacciones DB

---

**🎯 ¡El backend está listo para ser consumido por tu frontend!**

Para soporte técnico o dudas, revisa los logs del servidor o contacta al equipo de desarrollo.
