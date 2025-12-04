flowchart LR
    %% Actores de negocio
    S[Solicitante<br/>Operador de planta]:::actor
    A[Aprobador<br/>Jefe / Gerente]:::actor
    P[Planificador de materiales]:::actor
    ADM[Administrador del sistema]:::actor
    AUD[Auditor / Control de gestión]:::actor

    %% Sistemas externos (propuestos + algunos ya implícitos)
    subgraph CORP[Entorno Corporativo]
        DIR[Directorio corporativo / SSO<br/>(LDAP / Azure AD)]:::external
        ERP[ERP / MRP corporativo<br/>(SAP, Oracle, etc.)]:::external
        BI[Plataforma BI / Data Warehouse]:::external
        MAIL[Servidor de correo / Notificaciones]:::external
        DMS[Gestor documental (SharePoint, Files)]:::external
    end

    %% Sistema SPM
    subgraph SPM[SPM v1.0 - Sistema de Solicitudes de Materiales]
        subgraph UI[Frontend Web<br/>Vite + JavaScript/HTML/CSS]
            UI_DASH[Dashboard & Reportes]:::module
            UI_SOL[Gestión de Solicitudes]:::module
            UI_MAT[Catálogo de Materiales]:::module
            UI_PLAN[Panel de Planificación]:::module
            UI_ADMIN[Panel Administración]:::module
            UI_AI[Consola IA / Asistente]:::module
        end

        subgraph API[Backend Flask / API REST]
            R_SOL[Rutas Solicitudes<br/>/api/solicitudes]:::module
            R_MAT[Rutas Materiales<br/>/api/materiales]:::module
            R_AUTH[Rutas Auth<br/>/api/auth]:::module
            R_ADM[Rutas Admin<br/>/api/admin]:::module
            R_PLN[Rutas Planificación<br/>/api/planner]:::module
            R_PREF[Rutas Preferencias<br/>/api/preferencias]:::module
            R_IA[Rutas IA / Chatbot<br/>/api/ia, /api/chatbot]:::module
        end

        subgraph CORE[Core de Negocio]
            S_SOL[Servicios de Solicitudes]:::service
            S_MAT[Servicios de Materiales]:::service
            S_DASH[Servicios de Dashboard]:::service
            S_IA[Servicios IA<br/>ai_service, form_intelligence_v2]:::service
            S_DB[Servicios DB / Seguridad<br/>paging, security]:::service
        end

        subgraph DATA[Datos & Motores]
            DB[(BD SQLite / PostgreSQL<br/>Tablas: usuarios, solicitudes, materiales,<br/>presupuestos, catálogos, notificaciones, planificadores)]:::db
            PLAN[Motor de Planificación<br/>src/planner/*]:::engine
            AGENT[Agentes IA<br/>src/agent/*]:::engine
            AI_ASSIST[Asistente IA<br/>src/ai_assistant/*]:::engine
            FILES[(Uploads de archivos<br/>src/backend/uploads)]:::storage
            LOGS[(Logs app/logs)]:::storage
        end
    end

    %% Flujos principales
    S -->|Crea / consulta solicitudes| UI_SOL
    A -->|Aprueba / rechaza| UI_SOL
    P -->|Planifica y optimiza demanda| UI_PLAN
    ADM -->|Administra usuarios, catálogos, presupuestos| UI_ADMIN
    AUD -->|Consulta reportes y auditoría| UI_DASH

    %% UI -> API -> Core -> Datos
    UI_SOL -->|REST JSON| R_SOL
    UI_MAT -->|Búsqueda material| R_MAT
    UI_DASH -->|KPIs / métricas| R_ADM
    UI_PLAN -->|Cargar y optimizar| R_PLN
    UI_AI -->|Consultas IA| R_IA
    UI_ADMIN -->|Operaciones admin| R_ADM
    UI -->|Login / refresh| R_AUTH

    R_SOL --> S_SOL --> DB
    R_MAT --> S_MAT --> DB
    R_ADM --> S_DASH --> DB
    R_PLN --> PLAN --> DB
    R_IA --> S_IA --> AGENT --> AI_ASSIST
    S_DB --> DB
    R_SOL --> FILES
    R_SOL --> LOGS

    %% Integraciones corporativas (propuestas)
    R_AUTH --- DIR
    S_SOL --- ERP
    S_DASH --- BI
    S_SOL --- MAIL
    FILES --- DMS

    classDef actor fill:#f5f5f5,stroke:#333,stroke-width:1px;
    classDef external fill:#fff3cd,stroke:#c69500,stroke-width:1px;
    classDef module fill:#e3f2fd,stroke:#1565c0,stroke-width:1px;
    classDef service fill:#e8f5e9,stroke:#2e7d32,stroke-width:1px;
    classDef db fill:#f3e5f5,stroke:#6a1b9a,stroke-width:1px;
    classDef engine fill:#ffebee,stroke:#c62828,stroke-width:1px;
    classDef storage fill:#eeeeee,stroke:#616161,stroke-width:1px;




flowchart TB
    subgraph DEV[Entorno Desarrollo Local]
        DEV_BR[Browser Dev<br/>http://localhost:5173]:::actor
        VITE[Vite Dev Server<br/>npm run dev]:::module
        FLASK_DEV[Flask Dev Server<br/>python wsgi.py (5000)]:::module
    end

    subgraph PROD[Entorno Producción (diseño basado en ARCHITECTURE.md)]
        LB[Reverse Proxy / Nginx<br/>SSL, rutas /api, estáticos]:::external
        GUNI[Gunicorn + Flask<br/>Workers WSGI]:::module
        subgraph APP[Aplicación SPM (contenedor Docker)]
            APP_BACK[Backend Flask<br/>src/backend]:::module
            APP_FRONT[Frontend build<br/>dist/ estático]:::module
        end
        DBP[(BD Prod<br/>PostgreSQL / SQLite)]:::db
        REDIS[(Cache / Sessions Redis):::Opcional]:::storage
        FILESP[(File Store<br/>disco / S3)]:::storage
    end

    %% Código fuente principal
    subgraph SRC[src/]
        subgraph BE[backend_v2/]
            APP_PY[app.py<br/>Flask factory]:::module
            API_ROUTES[routes/*.py<br/>Blueprints REST]:::module
            CORE_B[core/*<br/>config.py, db.py, security]:::module
            AGENT_B[agent/*<br/>IA Logic]:::module
        end

        subgraph FE[src/frontend/]
            FE_HTML[index.html, home, pages/*]:::module
            FE_APP[app.js, boot.js]:::module
            FE_UTILS[utils/api.js, auth.js, validators.js]:::module
            FE_UI[components, ui, styles.css]:::module
            FE_TESTS[__tests__/]:::module
        end

        subgraph PL[src/planner/]
            PL_ALG[algorithms/*]:::engine
            PL_MODELS[models/* (ItemMaster, Inventory, etc.)]:::engine
            PL_OPT[optimization/* (MIP/ILP)]:::engine
            PL_RULES[rules/*]:::engine
        end

        subgraph AG[src/agent/]
            AG_MAIN[main.py]:::engine
            AG_LLM[llm.py]:::engine
            AG_CAT[catalog.py, rules.py, models.py]:::engine
        end

        subgraph AI_ASS[src/ai_assistant/]
            AI_API[api.py]:::engine
            AI_EMB[embeddings.py, retriever.py, indexer.py, store.py]:::engine
        end
    end

    DB_FILE[(spm.db dev<br/>src/backend/core/data)]:::db

    %% Flujos dev
    DEV_BR -->|HTTP| VITE -->|proxy /api → 5000| FLASK_DEV
    FLASK_DEV --> DB_FILE

    %% Flujos prod
    LB -->|/ (static)| APP_FRONT
    LB -->|/api/*| GUNI --> APP_BACK
    APP_BACK --> DBP
    APP_BACK --> FILESP
    APP_BACK -. cache .-> REDIS

    %% Interno backend
    APP_BACK --> APP_PY --> MIDDLE --> API_ROUTES --> SERVICES --> CORE_B --> DB_FILE
    SERVICES --> MODELS

    %% Planner + IA
    API_ROUTES -->|/api/planner/*| PL_ALG
    PL_ALG --> PL_OPT --> DBP
    API_ROUTES -->|/api/ia, /api/chatbot| AG_MAIN --> AG_LLM
    AG_MAIN --> AI_ASSIST

    %% Frontend interno
    APP_FRONT --> FE_HTML
    FE_HTML --> FE_APP --> FE_UTILS --> API_ROUTES
    FE_APP --> FE_UI
    FE_APP --> FE_TESTS

    classDef actor fill:#f5f5f5,stroke:#333;
    classDef module fill:#e3f2fd,stroke:#1565c0,stroke-width:1px;
    classDef service fill:#e8f5e9,stroke:#2e7d32,stroke-width:1px;
    classDef engine fill:#ffebee,stroke:#c62828,stroke-width:1px;
    classDef db fill:#f3e5f5,stroke:#6a1b9a,stroke-width:1px;
    classDef storage fill:#eeeeee,stroke:#616161,stroke-width:1px;



flowchart TD
    %% Etapa 0: Acceso
    U_LOGIN[Usuario Solicitante] -->|1. Accede a URL SPM| OPEN_APP[http://127.0.0.1:5000]
    OPEN_APP --> SHOW_LOGIN[Pantalla Login (index.html)]

    SHOW_LOGIN -->|2. Ingresa credenciales| SEND_LOGIN[POST /api/auth/login]
    SEND_LOGIN --> AUTH_BACK[Auth Backend<br/>auth_routes + services/auth]
    AUTH_BACK -->|Valida usuario, password, rol, estado| AUTH_OK{¿Credenciales válidas?}

    AUTH_OK -->|No| LOGIN_FAIL[Error login<br/>mensaje en UI]
    AUTH_OK -->|Sí| ISSUE_JWT[Genera JWT + datos usuario]
    ISSUE_JWT --> STORE_TOKEN[Frontend guarda token<br/>(localStorage / memory)]
    STORE_TOKEN --> LOAD_HOME[Redirección a home.html / dashboard]

    %% Etapa 1: Creación de solicitud
    LOAD_HOME --> NAV_NEW_SOL[Usuario navega a<br/>“Crear Solicitud”]
    NAV_NEW_SOL --> FILL_FORM[Completa formulario<br/>centro, sector, materiales, etc.]

    FILL_FORM --> LOCAL_VALIDATE[Validaciones frontend<br/>campos obligatorios, formatos]
    LOCAL_VALIDATE -->|Errores| SHOW_FORM_ERRORS[Mensajes en formulario]
    LOCAL_VALIDATE -->|OK| SEND_SOL[POST /api/solicitudes<br/>SolicitudCreate JSON]

    %% Backend creación
    SEND_SOL --> MID[Middleware<br/>CORS, Auth(JWT), CSRF, Rate limit]
    MID --> VAL_SCHEMA[Validación Pydantic<br/>SolicitudCreate, SolicitudItem]
    VAL_SCHEMA -->|Error| RESP_400[Respuesta 400 VALIDATION_ERROR<br/>detalles por campo]
    RESP_400 --> SHOW_FORM_ERRORS

    VAL_SCHEMA -->|OK| BUS_SOLIC[Servicio solicitudes<br/>S_SOL]
    BUS_SOLIC --> DB_CHECKS[Consultas BD<br/>usuarios, materiales, presupuestos]
    DB_CHECKS --> RULES_CHECK[Reglas de negocio:<br/>material existe, usuario activo,<br/>rango de monto, planner válido]

    RULES_CHECK -->|Falla| RESP_422[Respuesta 422 BUSINESS_RULE_ERROR]
    RESP_422 --> SHOW_BUSINESS_ERRORS[Errores de negocio en UI]

    RULES_CHECK -->|OK| INSERT_SOL[Insert en tabla solicitudes<br/>status='pendiente_de_aprobacion']
    INSERT_SOL --> CREATE_NOTIF[Inserta notificación para aprobador]
    INSERT_SOL --> CALC_TOTAL[Calcula total_monto, guarda JSON de ítems]
    CALC_TOTAL --> RESP_201[Devuelve solicitud creada<br/>id, status, totales]
    RESP_201 --> UI_CONFIRM[UI muestra confirmación + solicitud en “Mis Solicitudes”]

    %% Etapa 2: Aprobación
    UI_CONFIRM --> LOGOUT[Solicitante puede cerrar sesión]
    LOGOUT --> LOGIN_APR[Login como Aprobador]
    LOGIN_APR --> VIEW_PENDING[Aprobador abre “Solicitudes Pendientes”]
    VIEW_PENDING --> GET_PENDING[GET /api/solicitudes?status=pendiente_de_aprobacion]
    GET_PENDING --> S_SOL_LIST[Servicio solicitudes filtra por rol/aprobador]
    S_SOL_LIST --> DB_SOL_Q[Query solicitudes por aprobador/centro]
    DB_SOL_Q --> RESP_LIST[Devuelve listado JSON]
    RESP_LIST --> UI_LIST[UI muestra tabla de solicitudes pendientes]

    UI_LIST --> OPEN_DETAIL[Aprobador abre detalle]
    OPEN_DETAIL --> GET_DETAIL[GET /api/solicitudes/{id}]
    GET_DETAIL --> RESP_DETAIL[Detalle JSON]
    RESP_DETAIL --> UI_DETAIL[Detalle en UI (items, montos, justificación)]

    UI_DETAIL --> DECISION{¿Aprobar o rechazar?}
    DECISION -->|Rechazar| SEND_REJECT[POST /api/solicitudes/{id}/decidir<br/>{accion:'rechazar'}]
    DECISION -->|Aprobar| SEND_APPROVE[POST /api/solicitudes/{id}/decidir<br/>{accion:'aprobar'}]

    SEND_REJECT --> UPDATE_STATUS_R[Servicio cambia status<br/>→ 'rechazada']
    UPDATE_STATUS_R --> NOTIF_SOL_R[Notificación al solicitante]
    NOTIF_SOL_R --> RESP_DECISION_R[Respuesta JSON]
    RESP_DECISION_R --> UI_STATUS_R[UI muestra “Rechazada”]

    SEND_APPROVE --> UPDATE_STATUS_A[Servicio cambia status<br/>→ 'aprobada']
    UPDATE_STATUS_A --> NOTIF_SOL_A[Notificación al solicitante y planificador]
    UPDATE_STATUS_A --> QUEUE_PLAN[Marca solicitud como “lista para planificación”]
    QUEUE_PLAN --> RESP_DECISION_A[Respuesta JSON]
    RESP_DECISION_A --> UI_STATUS_A[UI muestra “Aprobada”]

    %% Etapa 3: Planificación (planner)
    UI_STATUS_A --> P_OPEN[Planificador abre panel<br/>“Panel de Planificación”]
    P_OPEN --> P_GET[GET /api/planner/solicitudes]
    P_GET --> PL_SVC[Servicio planner<br/>planner_routes + src/planner/*]
    PL_SVC --> DB_SOL_PL[Lee solicitudes aprobadas, inventario, capacidades]
    DB_SOL_PL --> PL_OPT_CALL[Llama motor de optimización<br/>MIP/ILP, scoring, reglas]
    PL_OPT_CALL --> PL_SOLUTION[Genera plan: qué comprar, cuándo, a quién]
    PL_SOLUTION --> DB_SAVE_PLAN[Guarda resultados (tablas planner / campos adicionales)]
    DB_SAVE_PLAN --> RESP_PLAN[Devuelve plan por solicitud]
    RESP_PLAN --> UI_PLAN_VIEW[UI muestra cronograma, sugerencias, flags de riesgo]

    %% Etapa 4: Cierre / Integración ERP (propuesto)
    UI_PLAN_VIEW --> ERP_DECISION{¿Enviar a ERP / MRP?}
    ERP_DECISION -->|Sí (futuro)| SEND_ERP[Servicio integra con ERP<br/>crea Pedido de Compra / Reserva]
    SEND_ERP --> ERP_ACK[ACK ERP→num pedido]
    ERP_ACK --> DB_UPDATE_ERP[Guardar n° pedido, estado de integración]
    DB_UPDATE_ERP --> UI_FINAL[UI muestra estado final: En proceso → Cerrada]

    classDef default fill:#ffffff,stroke:#333,stroke-width:1px;




flowchart TD
    P_REQ[POST /api/planner/solicitudes/{id}/optimize] --> P_ROUTE[planner_routes.py]
    P_ROUTE --> P_SERVICE[Servicio Planner<br/>orquestación]

    P_SERVICE --> LOAD_DATA[Carga datos planificación<br/>solicitud, inventario, capacidades,<br/>lead times, opciones de abastecimiento]
    LOAD_DATA --> BUILD_MODELS[Construye modelos dominio<br/>ItemMaster, InventorySnapshot,<br/>LeadTimeEstimate, ResourceCapacity,<br/>SourcingOption]

    BUILD_MODELS --> BUILD_PROBLEM[Construye modelo de optimización<br/>variables, restricciones, función objetivo]
    BUILD_PROBLEM --> SOLVER[MIP/ILP Solver<br/>biblioteca de optimización]
    SOLVER -->|Itera hasta solución factible| SOLVER
    SOLVER --> SOLUTION{¿Solución encontrada?}

    SOLUTION -->|No| PLAN_FAIL[Marca solicitud como<br/>“no optimizable” / fallback reglas]
    SOLUTION -->|Sí| MAP_SOLUTION[Mapea solución a<br/>plan de compra / abastecimiento]

    MAP_SOLUTION --> SAVE_PLAN[Persiste plan en BD<br/>tablas planner / campos adicionales]
    SAVE_PLAN --> RESP_PLANNER[Devuelve plan JSON<br/>a frontend (timeline, proveedor, fechas, costo)]
