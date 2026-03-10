# 📱 Guía de Uso - Sistema de Talleres CBTis 258 (Versión Beta)

> **¡Bienvenido a la versión beta!** Esta guía te ayudará a usar el sistema y proporcionar feedback valioso.

> **Actualización Febrero 2026:** Esta guía ya contempla módulos nuevos como asistencias por sesión, información de emergencia, chatbot institucional y notificaciones por correo para avisos/calendario.

---

## 🎯 ¿Qué es este sistema?

Sistema web para gestionar talleres extracurriculares del CBTis 258. Permite a estudiantes inscribirse en talleres (culturales, deportivos y cívicos) y a instructores gestionar sus grupos.

---

## 🏗️ Arquitectura del Sistema

```mermaid
graph TB
    A[👤 Usuario<br/>Frontend Vercel] --> B[🔌 API REST<br/>Backend Railway]
    B --> C[🗄️ PostgreSQL<br/>Base de Datos Railway]
    B --> D[🔐 JWT Auth<br/>Autenticación]
    B --> E[📊 CORS Config<br/>Seguridad]
    
    style A fill:#e1f5ff
    style B fill:#fff3e0
    style C fill:#f3e5f5
    style D fill:#e8f5e9
    style E fill:#fce4ec
```

---

## 👥 Tipos de Usuario

```mermaid
graph LR
    A[Sistema de Talleres] --> B[👨‍🎓 Alumno]
    A --> C[👨‍🏫 Instructor]
    A --> D[👨‍💼 Administrador]
    
    B --> B1[Ver talleres]
    B --> B2[Inscribirse]
    B --> B3[Ver calendario]
    
    C --> C1[Gestionar alumnos]
    C --> C2[Publicar avisos]
    C --> C3[Ver asistencias]
    
    D --> D1[Crear talleres]
    D --> D2[Gestionar usuarios]
    D --> D3[Ver reportes]
    
    style A fill:#4CAF50,color:#fff
    style B fill:#2196F3,color:#fff
    style C fill:#FF9800,color:#fff
    style D fill:#F44336,color:#fff
```

---

## 🚀 Flujo de Registro e Inicio de Sesión

```mermaid
sequenceDiagram
    participant U as 👤 Usuario
    participant F as 🌐 Frontend<br/>(Vercel)
    participant B as ⚙️ Backend<br/>(Railway)
    participant DB as 🗄️ PostgreSQL
    
    Note over U,DB: REGISTRO NUEVO ALUMNO
    
    U->>F: 1. Accede a /register.html
    F->>U: 2. Muestra formulario
    U->>F: 3. Completa datos<br/>(email, password, nombre)
    F->>B: 4. POST /api/auth/register
    B->>B: 5. Valida datos
    B->>B: 6. Hashea password (bcrypt)
    B->>DB: 7. INSERT INTO usuarios
    DB->>B: 8. Usuario creado
    B->>F: 9. Respuesta exitosa
    F->>U: 10. ✅ Redirige a /login.html
    
    Note over U,DB: INICIO DE SESIÓN
    
    U->>F: 11. Ingresa email/password
    F->>B: 12. POST /api/auth/login
    B->>DB: 13. SELECT usuario
    DB->>B: 14. Datos del usuario
    B->>B: 15. Verifica password
    B->>B: 16. Genera JWT token
    B->>F: 17. Retorna token + datos
    F->>F: 18. Guarda token (localStorage)
    F->>U: 19. ✅ Redirige al dashboard
```

---

## 📚 Flujo del Alumno - Inscripción a Taller

```mermaid
graph TD
    Start([👨‍🎓 Alumno inicia sesión]) --> A[Dashboard Alumno]
    A --> B{¿Qué quiere hacer?}
    
    B -->|Ver talleres| C[Explora talleres<br/>disponibles]
    B -->|Ver calendario| D[Consulta eventos<br/>y horarios]
    B -->|Ver avisos| E[Lee notificaciones<br/>de instructores]
    
    C --> C1[Selecciona categoría:<br/>Cultural/Deportivo/Cívico]
    C1 --> C2[Ve detalles del taller<br/>en modal]
    C2 --> C3{¿Le interesa?}
    
    C3 -->|Sí| C4[Click en Inscribirse]
    C4 --> C5[POST /api/talleres/:id/inscripcion]
    C5 --> C6{¿Hay cupo?}
    
    C6 -->|Sí| C7[✅ Inscripción exitosa]
    C6 -->|No| C8[❌ Cupo lleno]
    
    C7 --> C9[Taller aparece en<br/>Mis Talleres]
    C9 --> C10[Recibe avisos del<br/>instructor]
    
    C3 -->|No| C11[Busca otro taller]
    C11 --> C1
    
    D --> D1[Ve fechas importantes<br/>de sus talleres]
    E --> E1[Revisa avisos<br/>importantes]
    
    C10 --> End([Alumno usa el sistema])
    D1 --> End
    E1 --> End
    
    style Start fill:#2196F3,color:#fff
    style End fill:#4CAF50,color:#fff
    style C7 fill:#4CAF50,color:#fff
    style C8 fill:#f44336,color:#fff
```

---

## 👨‍🏫 Flujo del Instructor - Gestión de Taller

```mermaid
graph TD
    Start([👨‍🏫 Instructor inicia sesión]) --> A[Dashboard Instructor]
    A --> B{¿Qué necesita hacer?}
    
    B -->|Ver alumnos| C[Lista de alumnos<br/>inscritos]
    B -->|Publicar aviso| D[Crear nuevo aviso]
    B -->|Gestionar calendario| E[Agregar fechas<br/>importantes]
    B -->|Consultar perfil| F[Ver/Editar perfil]
    
    C --> C1[Ve lista completa<br/>con información]
    C1 --> C2{Acciones}
    C2 -->|Ver info emergencia| C3[Consulta datos<br/>médicos del alumno]
    C2 -->|Registrar asistencia| C4[Marca presente/ausente]
    C2 -->|Asignar calificación| C5[Evalúa desempeño]
    
    D --> D1[Escribe título y<br/>mensaje del aviso]
    D1 --> D2[Marca como<br/>importante opcional]
    D2 --> D3[POST /api/avisos]
    D3 --> D4[✅ Aviso publicado]
    D4 --> D5[Todos los alumnos<br/>lo reciben]
    
    E --> E1[Selecciona fecha<br/>en calendario]
    E1 --> E2[Agrega título y<br/>descripción]
    E2 --> E3[Selecciona tipo:<br/>Clase/Examen/Evento]
    E3 --> E4[POST /api/calendario]
    E4 --> E5[✅ Fecha agregada]
    E5 --> E6[Alumnos ven fecha<br/>en su calendario]
    
    F --> F1[Completa información<br/>de contacto]
    F1 --> F2[Teléfono/Especialidad/<br/>Info emergencia]
    F2 --> F3[PUT /api/auth/profile]
    F3 --> F4[✅ Perfil actualizado]
    
    C5 --> End([Instructor gestiona<br/>su taller])
    D5 --> End
    E6 --> End
    F4 --> End
    
    style Start fill:#FF9800,color:#fff
    style End fill:#4CAF50,color:#fff
    style D4 fill:#4CAF50,color:#fff
    style E5 fill:#4CAF50,color:#fff
    style F4 fill:#4CAF50,color:#fff
```

---

## 👨‍💼 Flujo del Administrador - Gestión Completa

```mermaid
graph TD
    Start([👨‍💼 Admin inicia sesión]) --> A[Dashboard Admin]
    A --> B[Ve estadísticas<br/>generales]
    B --> C{¿Qué gestionar?}
    
    C -->|Talleres| D[Gestión de Talleres]
    C -->|Instructores| E[Gestión de Instructores]
    C -->|Usuarios| F[Gestión de Usuarios]
    C -->|Reportes| G[Ver Reportes]
    
    D --> D1{Acciones en talleres}
    D1 -->|Crear nuevo| D2[Formulario nuevo taller]
    D1 -->|Editar existente| D3[Modificar taller]
    D1 -->|Asignar instructor| D4[Seleccionar instructor]
    D1 -->|Cambiar estado| D5[Activar/Desactivar]
    
    D2 --> D6[Nombre, descripción<br/>categoría, cupo, horario]
    D6 --> D7[POST /api/admin/talleres]
    D7 --> D8[✅ Taller creado]
    
    D4 --> D9[Lista de instructores<br/>disponibles]
    D9 --> D10[PUT /api/admin/talleres/:id]
    D10 --> D11[✅ Instructor asignado]
    
    E --> E1{Acciones instructores}
    E1 -->|Crear nuevo| E2[Formulario instructor]
    E1 -->|Editar perfil| E3[Modificar datos]
    E1 -->|Cambiar password| E4[Nueva contraseña]
    E1 -->|Eliminar| E5[Confirmar eliminación]
    
    E2 --> E6[Email, nombre,<br/>apellidos, especialidad]
    E6 --> E7[POST /api/admin/usuarios/instructor]
    E7 --> E8[✅ Instructor creado]
    
    F --> F1{Acciones usuarios}
    F1 -->|Ver todos| F2[Lista completa]
    F1 -->|Filtrar por tipo| F3[Admin/Instructor/Alumno]
    F1 -->|Activar/Desactivar| F4[Cambiar estado]
    F1 -->|Cambiar password| F5[Nueva contraseña]
    
    F2 --> F6[Buscar por email<br/>o nombre]
    F4 --> F7[PUT /api/admin/usuarios/:id/status]
    F7 --> F8[✅ Estado actualizado]
    
    G --> G1{Tipo de reporte}
    G1 -->|Inscripciones| G2[Ver ocupación<br/>por taller]
    G1 -->|Actividad| G3[Ver actividad<br/>reciente]
    G1 -->|Estadísticas| G4[Dashboard con<br/>números generales]
    
    G2 --> G5[Tabla con cupos<br/>y porcentajes]
    G3 --> G6[Últimas acciones<br/>del sistema]
    
    D8 --> End([Admin gestiona<br/>todo el sistema])
    D11 --> End
    E8 --> End
    F8 --> End
    G5 --> End
    G6 --> End
    
    style Start fill:#F44336,color:#fff
    style End fill:#4CAF50,color:#fff
    style D8 fill:#4CAF50,color:#fff
    style D11 fill:#4CAF50,color:#fff
    style E8 fill:#4CAF50,color:#fff
    style F8 fill:#4CAF50,color:#fff
```

---

## 🔄 Flujo de Datos - Inscripción a Taller

```mermaid
sequenceDiagram
    participant A as 👨‍🎓 Alumno
    participant F as 🌐 Frontend
    participant B as ⚙️ Backend
    participant DB as 🗄️ PostgreSQL
    participant I as 👨‍🏫 Instructor
    
    A->>F: 1. Click en "Ver talleres"
    F->>B: 2. GET /api/talleres
    B->>DB: 3. SELECT * FROM talleres
    DB->>B: 4. Lista de talleres
    B->>F: 5. Respuesta con talleres
    F->>A: 6. Muestra modal con info
    
    A->>F: 7. Click en "Inscribirse"
    F->>B: 8. POST /api/talleres/:id/inscripcion
    
    B->>DB: 9. Verifica cupo disponible
    DB->>B: 10. Cupo OK
    
    B->>DB: 11. INSERT INTO inscripciones
    DB->>B: 12. ✅ Inscripción guardada
    
    B->>DB: 13. UPDATE talleres<br/>SET inscritos = inscritos + 1
    DB->>B: 14. Contador actualizado
    
    B->>F: 15. Respuesta exitosa
    F->>A: 16. ✅ Notificación: "¡Inscrito!"
    
    Note over I: El instructor ve<br/>al alumno en su lista
    
    I->>F: 17. Accede a Dashboard
    F->>B: 18. GET /api/talleres/:id/alumnos
    B->>DB: 19. SELECT alumnos inscritos
    DB->>B: 20. Lista con nuevo alumno
    B->>F: 21. Respuesta
    F->>I: 22. Ve al alumno inscrito
```

---

## 🎨 Flujo Visual - Navegación del Sistema

```mermaid
graph LR
    Home[🏠 Página Principal<br/>index.html] --> Login[🔐 Login<br/>login.html]
    Home --> Register[📝 Registro<br/>register.html]
    
    Login --> DashAlumno[👨‍🎓 Dashboard Alumno<br/>dashboard-user.html]
    Login --> DashInstructor[👨‍🏫 Dashboard Instructor<br/>dashboard-instructor.html]
    Login --> DashAdmin[👨‍💼 Dashboard Admin<br/>dashboard-admin-system.html]
    
    Register --> Login
    
    Home --> Culturales[🎭 Talleres Culturales<br/>culturales.html]
    Home --> Deportivos[⚽ Talleres Deportivos<br/>deportes.html]
    Home --> Civicos[🎖️ Talleres Cívicos<br/>civicos.html]
    
    Culturales --> Login
    Deportivos --> Login
    Civicos --> Login
    
    DashAlumno --> Calendario1[📅 Mi Calendario]
    DashAlumno --> Talleres1[📚 Mis Talleres]
    DashAlumno --> Avisos1[📢 Avisos]
    
    DashInstructor --> Alumnos[👥 Mis Alumnos]
    DashInstructor --> Calendario2[📅 Calendario Taller]
    DashInstructor --> Avisos2[📢 Publicar Avisos]
    
    DashAdmin --> Stats[📊 Estadísticas]
    DashAdmin --> GestionTalleres[📚 Gestión Talleres]
    DashAdmin --> GestionUsuarios[👥 Gestión Usuarios]
    DashAdmin --> Reportes[📈 Reportes]
    
    style Home fill:#4CAF50,color:#fff
    style Login fill:#2196F3,color:#fff
    style Register fill:#2196F3,color:#fff
    style DashAlumno fill:#00BCD4,color:#fff
    style DashInstructor fill:#FF9800,color:#fff
    style DashAdmin fill:#F44336,color:#fff
```

---

## 🔐 Flujo de Autenticación JWT

```mermaid
sequenceDiagram
    participant U as 👤 Usuario
    participant F as 🌐 Frontend
    participant B as ⚙️ Backend
    participant DB as 🗄️ PostgreSQL
    
    Note over U,DB: Usuario ya logueado
    
    U->>F: 1. Accede a página protegida
    F->>F: 2. Lee token de localStorage
    F->>B: 3. Request con header<br/>Authorization: Bearer [token]
    
    B->>B: 4. Middleware auth.js<br/>verifica token JWT
    
    alt Token válido
        B->>B: 5. Decodifica token
        B->>DB: 6. Verifica usuario existe
        DB->>B: 7. Usuario activo
        B->>B: 8. Adjunta req.user
        B->>F: 9. ✅ Procesa request
        F->>U: 10. Muestra datos
    else Token inválido/expirado
        B->>F: 11. ❌ 401 Unauthorized
        F->>F: 12. Elimina token
        F->>U: 13. Redirige a /login.html
    end
    
    Note over U,DB: Token expira en 24 horas (renovable con /api/auth/refresh)
```

---

## 📊 Modelo de Datos Simplificado

```mermaid
erDiagram
    USUARIOS ||--o{ INSCRIPCIONES : realiza
    USUARIOS ||--o{ AVISOS : publica
    USUARIOS ||--o{ FECHAS_IMPORTANTES : crea
    USUARIOS ||--|| PERFILES_ALUMNO : tiene
    USUARIOS ||--|| PERFILES_INSTRUCTOR : tiene
    USUARIOS ||--|| INFORMACION_EMERGENCIA : tiene
    
    TALLERES ||--o{ INSCRIPCIONES : tiene
    TALLERES ||--o{ AVISOS : pertenece
    TALLERES ||--o{ FECHAS_IMPORTANTES : tiene
    TALLERES }o--|| USUARIOS : asignado_a
    
    USUARIOS {
        uuid id PK
        string email
        string password_hash
        string tipo_usuario
        boolean activo
        timestamp fecha_registro
    }
    
    TALLERES {
        uuid id PK
        string nombre
        string descripcion
        string categoria
        uuid instructor_id FK
        int cupo_maximo
        string horario
        string lugar
        boolean activo
    }
    
    INSCRIPCIONES {
        uuid id PK
        uuid alumno_id FK
        uuid taller_id FK
        timestamp fecha_inscripcion
        string estado
    }
    
    AVISOS {
        uuid id PK
        uuid instructor_id FK
        uuid taller_id FK
        string titulo
        text contenido
        boolean importante
        timestamp fecha_publicacion
    }
```

---

## 🧪 Cómo Usar la Versión Beta

### Novedades incluidas
- ✅ Información de emergencia del alumno (`/api/informacion-emergencia`)
- ✅ Registro de asistencias por sesión (`/api/talleres/:id/sesiones-asistencia`)
- ✅ Chatbot institucional (`/api/chatbot/chat`)
- ✅ Notificación por correo al crear/editar avisos (`/api/avisos`)
- ✅ Notificación por correo al crear/editar recordatorios del calendario (`/api/calendario`)

### Paso 1: Accede al Sistema
```
🌐 URL: https://proyecto-talleres-cbtis258.vercel.app
```

### Paso 2: Regístrate como Alumno
1. Click en "Registrarse"
2. Completa el formulario con tus datos
3. Click en "Crear Cuenta"
4. Inicia sesión con tu email y contraseña

### Paso 3: Explora Talleres
1. En el dashboard, ve a "Mis Talleres"
2. Explora talleres por categoría
3. Click en "Ver más" para detalles
4. Click en "Inscribirse"

### Paso 4: Usa el Calendario
1. Ve a la sección "Calendario"
2. Consulta fechas importantes
3. Verás eventos de tus talleres inscritos

### Paso 5: Lee Avisos
1. Sección "Avisos"
2. Revisa notificaciones de instructores
3. Los importantes aparecen destacados

### Paso 6: Completa tu Información de Emergencia (Alumno)
1. En tu dashboard, abre la sección de perfil/emergencia
2. Captura contacto, teléfono y datos médicos relevantes
3. Guarda para que esté disponible en caso necesario

### Paso 7: Usa el Chatbot Institucional
1. Abre el chat desde el frontend
2. Haz preguntas generales del plantel o talleres
3. Si tu duda es administrativa específica, te redirigirá a Servicios Escolares

### Paso 8: Verifica Notificaciones por Correo (Instructor)
1. En `backend/.env`, configura al menos:
    - `EMAIL_ENABLED=true`
    - `RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx`
    - `EMAIL_FROM_ADDRESS=tu_remitente_verificado@tudominio.com`
2. Reinicia el backend después de guardar cambios en `.env`.
3. Crea o edita un aviso y verifica el mensaje de confirmación de envío.
4. Crea o edita un recordatorio en calendario y verifica el mensaje de envío.

> Nota: el remitente (`EMAIL_FROM_ADDRESS`) debe estar validado en Resend (dominio o sender verificado).

### Solución rápida de errores comunes (Correo)
- **"Los datos proporcionados no son válidos" al crear aviso**: revisa los campos requeridos (título, contenido, taller) y la fecha de expiración si aplica.
- **No llega correo aunque el aviso se guarda**: verifica que existan alumnos inscritos activos en ese taller y que tengan email registrado.

---

## 📝 ¿Cómo Dar Feedback?

### Lo que necesitamos saber:

1. **🐛 Bugs encontrados:**
   - ¿Qué estabas haciendo?
   - ¿Qué esperabas que pasara?
   - ¿Qué pasó en realidad?
   - Captura de pantalla si es posible

2. **💡 Sugerencias de mejora:**
   - ¿Qué te gustaría que tuviera?
   - ¿Qué no te gustó?
   - ¿Qué cambiarías?

3. **✅ Lo que funciona bien:**
   - ¿Qué te gustó?
   - ¿Qué fue fácil de usar?

### Reporta feedback por:
- 📧 Email: [sergio.sanchez@cbtis258.edu.mx]
- 🐙 GitHub Issues: https://github.com/sergiodev3/proyecto-talleres-cbtis258/issues

---

## ❓ Preguntas Frecuentes

**P: ¿Necesito crear cuenta para ver talleres?**  
R: No, puedes explorar talleres sin cuenta. Solo necesitas cuenta para inscribirte.

**P: ¿Puedo inscribirme a varios talleres?**  
R: Sí, puedes inscribirte a múltiples talleres mientras haya cupo.

**P: ¿Cómo cancelo mi inscripción?**  
R: Contacta al instructor o administrador (función en desarrollo).

**P: ¿Los instructores pueden verme?**  
R: Sí, una vez inscrito apareces en su lista de alumnos.

**P: ¿Es seguro?**  
R: Sí, usamos encriptación (HTTPS) y autenticación JWT. Tu contraseña está hasheada.

**P: ¿Los avisos y recordatorios del calendario se envían por correo?**  
R: Sí, cuando el instructor crea o edita esos registros se intenta notificar por email a alumnos inscritos activos del taller.

**P: ¿Por qué falla el correo con Resend?**  
R: Normalmente por `RESEND_API_KEY` invalida o remitente no verificado. Revisa que `EMAIL_FROM_ADDRESS` exista en Resend y que `EMAIL_ENABLED=true`.

---

## 🚀 Tecnologías Usadas

```mermaid
graph TB
    subgraph "Frontend - Vercel"
        A[HTML5 + CSS3]
        B[JavaScript ES6+]
        C[Bootstrap 3]
        D[FullCalendar]
    end
    
    subgraph "Backend - Railway"
        E[Node.js 18+]
        F[Express.js]
        G[JWT Auth]
        H[bcrypt]
    end
    
    subgraph "Base de Datos - Railway"
        I[PostgreSQL 14+]
        J[pg driver]
    end
    
    A --> E
    B --> E
    C --> E
    D --> E
    E --> I
    F --> I
    G --> I
    H --> I
    
    style A fill:#e1f5ff
    style E fill:#fff3e0
    style I fill:#f3e5f5
```

---

## 🎯 Roadmap Futuro

```mermaid
gantt
    title Plan de Desarrollo
    dateFormat YYYY-MM-DD
    
    section Versión Beta
    Testing con usuarios          :2025-11-20, 14d
    Recopilación feedback        :2025-11-20, 14d
    
    section v1.0
    Corrección de bugs           :2025-12-04, 7d
    Cancelación inscripciones    :2025-12-04, 7d
    Sistema de notificaciones    :2025-12-11, 7d
    
    section v1.1
    App móvil                    :2026-01-01, 30d
    Chat en tiempo real          :2026-01-15, 15d
    Exportar reportes PDF        :2026-02-01, 7d
```

---

## 🙏 Agradecimientos

¡Gracias por probar la versión beta! Tu feedback es invaluable para mejorar el sistema.

**Desarrollado con ❤️ para CBTis 258**

---

📅 Versión Beta - Actualizada Febrero 2026  
🔗 Repositorio: https://github.com/sergiodev3/proyecto-talleres-cbtis258
