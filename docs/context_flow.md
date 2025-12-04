# Diagrama de Flujo de Contexto - SPM

Este diagrama describe el flujo principal de la aplicación para la creación y gestión de solicitudes de materiales.

```mermaid
graph TD
    %% Actores
    User((Usuario Solicitante))
    Approver((Aprobador))
    Planner((Planificador))

    %% Frontend
    subgraph Frontend [Aplicación Web]
        Login[Login (index.html)]
        Home[Dashboard (home.html)]
        NewReq[Nueva Solicitud (nueva-solicitud.html)]
        AddMat[Agregar Materiales (agregar-materiales.html)]
        ListReq[Mis Solicitudes (solicitudes.html)]
    end

    %% Backend
    subgraph Backend [API Backend (Flask)]
        AuthAPI[/api/auth/login]
        SolAPI_Create[/api/solicitudes (POST)]
        SolAPI_Update[/api/solicitudes (PUT/PATCH)]
        MatAPI[/api/materiales (GET)]
    end

    %% Flujo Principal
    User -->|Accede| Login
    Login -->|Credenciales| AuthAPI
    AuthAPI -.->|Token JWT| Login
    Login -->|Redirige| Home

    User -->|Inicia Solicitud| NewReq
    NewReq -->|Datos Cabecera| SolAPI_Create
    SolAPI_Create -.->|ID Solicitud| NewReq
    NewReq -->|Redirige| AddMat

    AddMat -->|Busca Materiales| MatAPI
    MatAPI -.->|Lista Materiales| AddMat
    User -->|Selecciona Items| AddMat
    AddMat -->|Guarda/Finaliza| SolAPI_Update

    SolAPI_Update -->|Notifica| Approver

    %% Gestión
    User -->|Consulta| ListReq
    Approver -->|Aprueba/Rechaza| SolAPI_Update
    SolAPI_Update -->|Asigna| Planner
```
