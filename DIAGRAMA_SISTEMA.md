# SPM v3.0 - Arquitectura y Flujo de Sistema

Este documento describe la arquitectura y los flujos principales del Sistema de Planificación de Materiales (SPM v3.0).

## 1. Arquitectura de Alto Nivel

El sistema sigue una arquitectura cliente-servidor con un frontend en React (SPA) y un backend en Flask que expone una API REST. Se integra con múltiples bases de datos y servicios externos (SAP, Vertex AI).

```mermaid
graph TD
    %% Usuarios y Clientes
    subgraph Usuarios ["👥 Usuarios"]
        U_Admin[Administrador]
        U_Coord[Coordinador]
        U_Usuar[Usuario/Solicitante]
        U_Plan[Planner]
        U_Jefe[Jefe]
    end

    %% Frontend App
    subgraph Frontend ["🖥️ Frontend (React + Vite)"]
        UI_Router[React Router]
        UI_Zustand[Zustand Store]
        UI_Context[Auth/i18n Context]
        UI_Services[API Clients/Axios]
        UI_Components[UI Components]

        UI_Router --> UI_Components
        UI_Components --> UI_Zustand
        UI_Components --> UI_Context
        UI_Components --> UI_Services
    end

    Usuarios -->|HTTPS| Frontend

    %% API Gateway & Security
    subgraph APILayer ["🛡️ API Layer / Middleware"]
        CORS[CORS]
        CSRF[Protección CSRF]
        AuthMid[Auth Middleware JWT]
        RateLimit[Rate Limiting]
        Validation[Request Validation]
    end

    Frontend -->|REST API / WebSockets| APILayer

    %% Backend App
    subgraph Backend ["⚙️ Backend (Flask Python)"]
        Routes_Auth[Auth Routes]
        Routes_Sol[Solicitudes & Planner]
        Routes_MRP[MRP & Analytics]
        Routes_Admin[Admin & Core]
        Routes_AI[Copilot & Vertex AI]

        Services_Bus[Capa de Servicios]
        Core_Jobs[Scheduled Jobs / Celery]

        Routes_Auth --> Services_Bus
        Routes_Sol --> Services_Bus
        Routes_MRP --> Services_Bus
        Routes_Admin --> Services_Bus
        Routes_AI --> Services_Bus
    end

    APILayer --> Backend

    %% Bases de Datos
    subgraph DataTier ["🗄️ Capa de Datos"]
        DB_SPM[(SPM Transaccional\nSQLite/PostgreSQL)]
        DB_SAP[(Datos SAP\nStock/Consumo)]
        DB_Master[(Maestro Materiales)]
        Cache[(Redis Cache L2)]
    end

    Backend --> DataTier

    %% Sistemas Externos
    subgraph External ["🌐 Sistemas Externos"]
        VertexAI[Google Vertex AI\nLLM / Asistente]
        SAP[SAP ERP / Procurement]
        Email[Servicio Email]
    end

    Backend -.->|API| VertexAI
    Backend -.->|Sync/ETL| SAP
    Backend -.->|SMTP| Email
```

## 2. Flujo Principal: Ciclo de Vida de una Solicitud de Material

Este es el flujo central del sistema, que abarca desde que un usuario solicita un material hasta su planificación y entrega.

```mermaid
stateDiagram-v2
    [*] --> Creada : Usuario crea solicitud

    state Creada {
        [*] --> ValidacionInicial
        ValidacionInicial --> PendienteAprobacion : Presupuesto/Reglas OK
        ValidacionInicial --> RechazadaAut : Reglas Fallan
    }

    Creada --> Pendiente_Aprobacion

    state Pendiente_Aprobacion {
        [*] --> RevisionCoordinador
        RevisionCoordinador --> Aprobada : Coordinador Aprueba
        RevisionCoordinador --> Rechazada : Coordinador Rechaza
    }

    Pendiente_Aprobacion --> Aprobada : Aprobación Exitosa
    Pendiente_Aprobacion --> Rechazada : Rechazada

    state Aprobada {
        [*] --> AsignacionPlanner
        AsignacionPlanner --> EnPlanificacion
    }

    Aprobada --> En_Planificacion

    state En_Planificacion {
        [*] --> AnalisisMRP
        AnalisisMRP --> ValidacionStock
        ValidacionStock --> VerificacionAlternativos : Sin Stock
        ValidacionStock --> OpcionesAbastecimiento : Con Stock Parcial/Nulo
        OpcionesAbastecimiento --> DecisiónTomada : Planner asigna tratamiento
    }

    En_Planificacion --> Planificada
    En_Planificacion --> Cancelada : Imposible abastecer

    state Planificada {
        [*] --> GeneracionOrdenes
        GeneracionOrdenes --> NotificacionSAP : Enviar a ERP
        NotificacionSAP --> EjecucionCompras
    }

    Planificada --> En_Transito : Compras procesadas
    En_Transito --> Entregada : Recepción en almacén

    Entregada --> [*]
    Rechazada --> [*]
    Cancelada --> [*]

    %% Integración AI en el proceso
    note right of En_Planificacion
        El Asistente IA / Copilot sugiere
        opciones de abastecimiento o materiales
        equivalentes basándose en histórico.
    end note
```

## 3. Arquitectura del Flujo de Planificación y AI (Copilot / MRP)

El motor de MRP (Material Requirements Planning) y el Copilot de IA son piezas fundamentales para asistir al Planner.

```mermaid
sequenceDiagram
    actor Planner
    participant Frontend
    participant API_Planner
    participant Motor_MRP
    participant Vertex_AI
    participant DB_SAP

    Planner->>Frontend: Selecciona Solicitud a planificar
    Frontend->>API_Planner: GET /api/planificador/solicitudes/{id}/analizar

    API_Planner->>Motor_MRP: Evaluar reglas de abastecimiento
    Motor_MRP->>DB_SAP: Consultar Stock Actual, Tránsitos y Pronósticos
    DB_SAP-->>Motor_MRP: Datos de Inventario

    API_Planner->>Vertex_AI: Solicitar recomendaciones (RAG/Prompt)
    Vertex_AI-->>API_Planner: Opciones generadas por IA (Ej. usar equivalente, transferir)

    API_Planner-->>Frontend: Retorna Análisis (Stock + Recomendaciones IA)
    Frontend-->>Planner: Muestra Dashboard de Decisión

    Planner->>Frontend: Selecciona opción de abastecimiento (Ej. Orden de Compra)
    Frontend->>API_Planner: POST /api/planificador/solicitudes/{id}/tratamiento

    API_Planner->>Motor_MRP: Generar acciones post-tratamiento
    API_Planner-->>Frontend: Éxito
    Frontend-->>Planner: Notifica solicitud planificada
```

## 4. Estructura de Módulos (Backend Blueprints)

El backend está organizado en múltiples dominios funcionales (Blueprints):

```mermaid
graph LR
    subgraph API_Gateway ["Gateway / App (app.py)"]
        Router[Blueprints Router]
    end

    subgraph Modulos_Core ["Core & Auth"]
        Auth[Auth & Usuarios]
        Admin[Administración]
        MiCuenta[Perfil]
    end

    subgraph Modulos_Materiales ["Gestión de Materiales"]
        Cat[Catálogos]
        Mat[Materiales]
        Stk[Stock]
        Eq[Equivalencias]
    end

    subgraph Modulos_Operaciones ["Operaciones & Solicitudes"]
        Sol[Solicitudes]
        Plan[Planificador]
        OC[Órdenes Compra]
        Proc[Procurement SAP]
    end

    subgraph Modulos_Inteligencia ["Inteligencia & Planning"]
        MRP[Motor MRP]
        Dash[Dashboards]
        AI[AI & Copilot]
        Forc[Demand Planning]
    end

    Router --> Modulos_Core
    Router --> Modulos_Materiales
    Router --> Modulos_Operaciones
    Router --> Modulos_Inteligencia
```
