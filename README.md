# 🎓 Sistema de Gestión de Talleres - CBTis 258

Sistema web completo para la gestión de talleres extracurriculares (culturales, deportivos y cívicos) del CBTis 258. Permite a los estudiantes inscribirse en talleres, consultar horarios y recibir avisos, mientras que los instructores pueden gestionar asistencias, calificaciones y comunicarse con sus alumnos.

> **🚀 Versión Beta** - Actualizado a Febrero 2026
> 
> Este proyecto sigue en fase beta e integra nuevas funciones operativas para administración, control de asistencias por sesión, información de emergencia y chatbot institucional.

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Tecnologías](#-tecnologías)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [API Endpoints](#-api-endpoints)
- [Uso](#-uso)
- [Capturas de Pantalla](#-capturas-de-pantalla)
- [Contribución](#-contribución)
- [Licencia](#-licencia)

## ✨ Características

### Para Alumnos
- 📝 Registro e inicio de sesión seguro
- 🔍 Búsqueda y exploración de talleres por categoría (Culturales, Deportes, Cívicos)
- ✅ Inscripción a talleres disponibles
- 📚 Visualización de mis inscripciones activas
- 📅 Visualización de calendario de eventos
- 📢 Recepción de avisos importantes
- 👤 Gestión de perfil personal
- 🚨 Registro y actualización de información de emergencia
- 🤖 Consulta al chatbot institucional con información general y talleres disponibles

### Para Instructores
- 📊 Dashboard personalizado con estadísticas
- 📅 Calendario interactivo para gestión de eventos
- 👥 Visualización de alumnos inscritos
- 📢 Publicación de avisos para sus talleres
- 📝 Gestión completa de perfil (incluyendo contactos de emergencia)
- 🎯 Gestión de fechas importantes por taller
- ✅ Registro de asistencias por alumno y por sesión
- 🧾 Historial de sesiones de asistencia por taller

### Para Administradores
- 👤 Gestión completa de usuarios (alumnos, instructores, admins)
- 🎨 CRUD completo de talleres
- 📊 Dashboard con estadísticas en tiempo real
- 👨‍🏫 Asignación de instructores a talleres
- 🔐 Control de acceso y permisos
- 📈 Reportes de inscripciones
- 🔑 Cambio de contraseña de usuarios y edición de número de control
- 👨‍🏫 Gestión de catálogo de instructores (listado y actualización)
- ✅ Registro/consulta centralizada de asistencias desde módulo admin

## 🛠 Tecnologías

### Backend
- **Node.js** (v18+) - Entorno de ejecución
- **Express.js 5** - Framework web
- **PostgreSQL** (v14+) - Base de datos
- **JWT** - Autenticación y autorización
- **bcryptjs** - Hash de contraseñas
- **dotenv** - Variables de entorno
- **cors** - Manejo de CORS
- **helmet** - Seguridad HTTP
- **express-rate-limit** - Rate limiting
- **Google Gemini API** - Motor del chatbot institucional

### Frontend
- **HTML5 / CSS3** - Estructura y estilos
- **JavaScript (ES6+)** - Lógica del cliente
- **Bootstrap 3** - Framework CSS
- **Light Bootstrap Dashboard** - Template de dashboard
- **Axios** - Cliente HTTP
- **FullCalendar 5** - Calendario interactivo
- **Font Awesome** - Iconos

## 📦 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- [Node.js](https://nodejs.org/) (v18 o superior)
- [PostgreSQL](https://www.postgresql.org/) (v14 o superior)
- [Git](https://git-scm.com/)
- Editor de código (recomendado: [VS Code](https://code.visualstudio.com/))

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/sergiodev3/proyecto-talleres-cbtis258.git
cd proyecto-talleres-cbtis258
```

> **Importante:** No ejecutes `npm install` en la raíz del proyecto. Instala dependencias por módulo: `backend` y, si usarás el servidor de frontend con Node, también `frontend`.

### 2. Configurar la Base de Datos

```bash
# Conectarse a PostgreSQL
psql -U postgres

# Crear la base de datos
CREATE DATABASE talleres_cbtis258;

# Salir de psql
\q

# Ejecutar el script de esquema
psql -U postgres -d talleres_cbtis258 -f backend/database/schema.sql

# Ejecutar script de actualización de instructor (si es necesario)
psql -U postgres -d talleres_cbtis258 -f backend/database/add-instructor-fields.sql
```

### 3. Configurar el Backend

```bash
cd backend

# Instalar dependencias
npm install

# Crear archivo .env con tus configuraciones
```

### 4. Configurar el Frontend

```bash
cd ../frontend

# (Opcional) Instalar dependencias si usarás frontend/server.js
npm install

# Verificar que API_BASE_URL apunte al backend correcto
# Editar en cada archivo HTML si es necesario
# Por defecto: http://localhost:5000/api
```

### 5. Iniciar la Aplicación

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
- Usar Live Server de VS Code o cualquier servidor HTTP
- Abrir `index.html` en el navegador

## ⚙️ Configuración

### Variables de Entorno (.env)

Crea un archivo `.env` en la carpeta `backend` con el siguiente contenido:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:tu_password@localhost:5432/talleres_cbtis258

# JWT
JWT_SECRET=tu_secret_key_muy_segura_y_larga_aqui
JWT_EXPIRES_IN=24h

# Chatbot
GEMINI_API_KEY=tu_api_key_de_gemini

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Configuración de la Base de Datos

El esquema incluye las siguientes tablas principales:
- `usuarios` - Información de autenticación
- `perfiles_alumno` - Datos de alumnos
- `perfiles_instructor` - Datos de instructores
- `talleres` - Información de talleres
- `inscripciones` - Relación alumno-taller
- `asistencias` - Asistencias por alumno y fecha
- `sesiones_asistencia` - Sesiones con contador y estado (activa/cerrada)
- `fechas_importantes` - Eventos del calendario
- `avisos` - Notificaciones importantes

## 📁 Estructura del Proyecto

```
proyecto-talleres-cbtis258/
├── backend/
│   ├── controllers/          # Lógica de negocio
│   │   ├── authController.js
│   │   ├── avisoController.js
│   │   ├── calendarioController.js
│   │   ├── informacionEmergenciaController.js
│   │   ├── tallerController.js
│   │   └── ...
│   ├── database/            # Scripts de BD
│   │   ├── config-db.js
│   │   ├── schema.sql
│   │   └── add-instructor-fields.sql
│   ├── middlewares/         # Middleware de Express
│   │   ├── auth.js
│   │   └── validation.js
│   ├── models/             # Modelos de datos
│   │   ├── User.js
│   │   ├── Calendario.js
│   │   └── ...
│   ├── routes/             # Rutas de API
│   │   ├── admin.js
│   │   ├── auth.js
│   │   ├── avisos.js
│   │   ├── calendario.js
│   │   ├── chatbot.js
│   │   ├── informacionEmergencia.js
│   │   └── talleres.js
│   ├── .env.example        # Ejemplo de variables de entorno
│   ├── .gitignore
│   ├── package.json
│   └── server.js           # Punto de entrada
│
├── frontend/
│   ├── assets/             # Recursos estáticos
│   │   ├── css/
│   │   ├── js/
│   │   ├── img/
│   │   └── fonts/
│   ├── css/                # Estilos personalizados
│   ├── images/             # Imágenes
│   ├── js/                 # Scripts personalizados
│   ├── index.html          # Página principal
│   ├── login.html          # Inicio de sesión
│   ├── register.html       # Registro de alumno
│   ├── dashboard-user.html # Dashboard de alumno
│   ├── dashboard-instructor.html # Dashboard de instructor
│   ├── dashboard-admin-system.html # Dashboard de admin
│   └── ...
│
├── .gitignore
└── README.md
```

## 🔌 API Endpoints

> Resumen de endpoints principales actualizados. Para referencia completa y ejemplos de prueba, revisa `backend/README.md`.

### Autenticación
```
POST   /api/auth/login              - Iniciar sesión
POST   /api/auth/register           - Registrar alumno
GET    /api/auth/verify             - Verificar token
POST   /api/auth/refresh            - Renovar token
POST   /api/auth/logout             - Cerrar sesión
GET    /api/auth/profile            - Obtener perfil
PUT    /api/auth/profile            - Actualizar perfil
PUT    /api/auth/change-password    - Cambiar contraseña
PUT    /api/auth/complete-profile   - Completar perfil de alumno
```

### Talleres
```
GET    /api/talleres                - Listar talleres (público)
GET    /api/talleres/categoria/:cat - Talleres por categoría
GET    /api/talleres/disponibles    - Talleres disponibles para alumno
GET    /api/talleres/mis-inscripciones - Talleres inscritos (alumno)
GET    /api/talleres/mis-talleres   - Talleres del instructor
GET    /api/talleres/:id/alumnos    - Alumnos inscritos por taller
GET    /api/talleres/:id/asistencias - Asistencias por fecha
POST   /api/talleres/:id/asistencias - Registrar asistencia por número de control
GET    /api/talleres/:id/sesiones-asistencia - Historial de sesiones
POST   /api/talleres/:id/sesiones-asistencia - Crear sesión de asistencia
PUT    /api/talleres/:id/sesiones-asistencia/:sesionId - Actualizar sesión
POST   /api/talleres/:id/sesiones-asistencia/:sesionId/incrementar - Incrementar contador
GET    /api/talleres/:id            - Detalle de taller
POST   /api/talleres/:id/inscripcion - Inscribirse a taller
GET    /api/talleres/:id/cupo       - Verificar cupo
```

### Calendario
```
GET    /api/calendario/eventos-hoy  - Eventos del día
GET    /api/calendario/rango        - Eventos en rango de fechas
GET    /api/calendario/mis-fechas   - Fechas del instructor
GET    /api/calendario/eventos-proximos - Próximos eventos (alumno)
GET    /api/calendario/mensual      - Vista mensual por taller
GET    /api/calendario/search       - Búsqueda de eventos
POST   /api/calendario              - Crear evento
PUT    /api/calendario/:id          - Actualizar evento
DELETE /api/calendario/:id          - Eliminar evento
```

### Avisos
```
GET    /api/avisos/importantes      - Avisos importantes públicos
GET    /api/avisos/alumno           - Avisos para alumno autenticado
GET    /api/avisos/mis-avisos       - Avisos del instructor
GET    /api/avisos/search           - Buscar avisos
POST   /api/avisos                  - Crear aviso
PUT    /api/avisos/:id              - Actualizar aviso
DELETE /api/avisos/:id              - Eliminar aviso
```

### Información de Emergencia
```
GET    /api/informacion-emergencia/mi-informacion - Obtener info de emergencia
POST   /api/informacion-emergencia/ - Crear/actualizar info
PUT    /api/informacion-emergencia/ - Actualizar info (alias)
DELETE /api/informacion-emergencia/:id - Eliminar info
```

### Chatbot Institucional
```
POST   /api/chatbot/chat            - Chat con asistente virtual CBTis 258
```

### Administración (requiere rol admin)
```
GET    /api/admin/dashboard         - Estadísticas generales
GET    /api/admin/usuarios          - Listar usuarios
POST   /api/admin/usuarios/instructor - Crear instructor
PUT    /api/admin/usuarios/:id/status - Cambiar estado usuario
PUT    /api/admin/usuarios/:id/password - Cambiar contraseña de usuario
PUT    /api/admin/usuarios/:id/numero-control - Actualizar número de control
DELETE /api/admin/usuarios/:id      - Eliminar usuario
GET    /api/admin/instructores      - Listar instructores
PUT    /api/admin/instructores/:usuarioId - Actualizar instructor
GET    /api/admin/talleres          - Gestión de talleres
GET    /api/admin/talleres/:id      - Detalle de taller
POST   /api/admin/talleres          - Crear taller
PUT    /api/admin/talleres/:id      - Actualizar taller
PUT    /api/admin/talleres/:id/status - Cambiar estado de taller
DELETE /api/admin/talleres/:id      - Eliminar taller
GET    /api/admin/reportes/inscripciones - Reporte de inscripciones
GET    /api/admin/reportes/actividad - Reporte de actividad
POST   /api/admin/asistencias/registrar - Registro de asistencia (admin)
GET    /api/admin/asistencias       - Consulta de asistencias
GET    /api/admin/sistema/info      - Información del sistema
```

### Health Check
```
GET    /api/health                  - Estado del backend
```

## 📖 Uso

### Primer Uso

1. **Crear usuario administrador inicial:**
   - Ejecutar script SQL para insertar primer admin manualmente.
   - Alternativamente, usa el flujo administrativo ya existente si tu entorno ya cuenta con una cuenta admin.

2. **Como Administrador:**
   - Acceder a `dashboard-admin-system.html`
   - Crear talleres desde la sección "Gestión de Talleres"
   - Crear instructores y asignarlos a talleres
   - Monitorear inscripciones, estadísticas, reportes y asistencias

3. **Como Instructor:**
   - Acceder a `dashboard-instructor.html`
   - Completar perfil con información de contacto
   - Gestionar calendario de eventos del taller
   - Ver alumnos inscritos y registrar asistencias por sesión

4. **Como Alumno:**
   - Registrarse desde `register.html`
   - Explorar talleres disponibles
   - Inscribirse a talleres de interés
   - Ver calendario de eventos y gestionar información de emergencia
   - Consultar dudas generales en el chatbot institucional

## 🖼 Capturas de Pantalla

### Página Principal
![Home](docs/screenshots/home.png)

### Dashboard de Instructor con Calendario
![Instructor Dashboard](docs/screenshots/instructor-calendar.png)

### Dashboard de Administrador
![Admin Dashboard](docs/screenshots/admin-dashboard.png)

## 🤝 Contribución

Las contribuciones son bienvenidas. Por favor, sigue estos pasos:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add: nueva característica increíble'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Convenciones de Commits

- `Add:` Nueva característica
- `Fix:` Corrección de bug
- `Update:` Actualización de funcionalidad existente
- `Refactor:` Refactorización de código
- `Docs:` Cambios en documentación
- `Style:` Cambios de formato, no afectan funcionalidad

## 🔐 Seguridad

- Las contraseñas se hashean con bcrypt (12 salt rounds)
- Autenticación basada en JWT
- Rate limiting en endpoints sensibles
- Validación de entrada en todos los endpoints
- Protección CSRF y XSS mediante Helmet
- CORS configurado apropiadamente
- Manejo seguro de variables de entorno

## 📝 Licencia

Este proyecto es parte de un proyecto académico del CBTis 258. Todos los derechos reservados.

## 👥 Autores

- **Sergio** - [sergiodev3](https://github.com/sergiodev3)

## 🙏 Agradecimientos

- Centro de Bachillerato Tecnológico industrial y de servicios No. 258 "Mariano Escobedo"
- Creative Tim por el template Light Bootstrap Dashboard
- Comunidad de Open Source por las librerías utilizadas

## 📞 Contacto

Para preguntas o soporte:
- GitHub: [@sergiodev3](https://github.com/sergiodev3)
- Proyecto: [https://github.com/sergiodev3/proyecto-talleres-cbtis258](https://github.com/sergiodev3/proyecto-talleres-cbtis258)

---

⭐ Si este proyecto te fue útil, considera darle una estrella en GitHub!
