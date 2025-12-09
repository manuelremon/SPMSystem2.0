"""
Generador de especificacion OpenAPI 3.0 para SPM API.
Sprint 9.1 - Documentacion automatica de endpoints.

Provee:
- Especificacion OpenAPI 3.0 completa
- Schemas de request/response
- Documentacion de autenticacion
- Endpoint /api/docs para servir la especificacion
"""

from typing import Any, Dict, List

# Version de la API
API_VERSION = "2.0.0"
API_TITLE = "SPM API"
API_DESCRIPTION = """
## Sistema de Planificacion de Materiales (SPM) v2.0

API REST para gestion de solicitudes de materiales, planificacion MRP,
y recomendaciones inteligentes basadas en ML.

### Autenticacion

La API usa JWT Bearer tokens. Obtener token en `/api/auth/login`.

```
Authorization: Bearer <token>
```

### Respuestas

Todas las respuestas siguen el formato:

```json
{
  "ok": true,
  "data": { ... }
}
```

En caso de error:

```json
{
  "ok": false,
  "error": {
    "code": "error_code",
    "message": "Descripcion del error"
  }
}
```
"""


def generate_openapi_spec() -> Dict[str, Any]:
    """
    Genera la especificacion OpenAPI 3.0 completa.

    Returns:
        Especificacion OpenAPI como diccionario
    """
    return {
        "openapi": "3.0.3",
        "info": {
            "title": API_TITLE,
            "description": API_DESCRIPTION,
            "version": API_VERSION,
            "contact": {
                "name": "SPM Support",
                "url": "https://github.com/manuelremon/SPMSystem2.0",
            },
            "license": {"name": "MIT", "url": "https://opensource.org/licenses/MIT"},
        },
        "servers": [
            {"url": "http://localhost:5000", "description": "Servidor de desarrollo"},
            {"url": "https://spm-api.onrender.com", "description": "Servidor de produccion"},
        ],
        "tags": _get_tags(),
        "paths": _get_paths(),
        "components": _get_components(),
        "security": [{"bearerAuth": []}],
    }


def _get_tags() -> List[Dict[str, str]]:
    """Define los tags/grupos de endpoints."""
    return [
        {"name": "auth", "description": "Autenticacion y gestion de sesiones"},
        {"name": "solicitudes", "description": "CRUD de solicitudes de materiales"},
        {"name": "planificador", "description": "Planificacion y tratamiento de solicitudes"},
        {"name": "materiales", "description": "Busqueda y consulta de materiales"},
        {"name": "mrp", "description": "Planificacion de requerimientos de materiales"},
        {"name": "ai", "description": "Recomendaciones inteligentes y ML"},
        {"name": "sla", "description": "Metricas y alertas de SLA"},
        {"name": "export", "description": "Exportacion de reportes"},
        {"name": "admin", "description": "Administracion del sistema"},
        {"name": "health", "description": "Estado del sistema"},
    ]


def _get_paths() -> Dict[str, Any]:
    """Define todos los paths/endpoints de la API."""
    return {
        # ==================== AUTH ====================
        "/api/auth/login": {
            "post": {
                "tags": ["auth"],
                "summary": "Iniciar sesion",
                "description": "Autentica usuario y retorna tokens JWT",
                "operationId": "login",
                "security": [],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/LoginRequest"}
                        }
                    },
                },
                "responses": {
                    "200": {
                        "description": "Login exitoso",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/LoginResponse"}
                            }
                        },
                    },
                    "401": {"$ref": "#/components/responses/Unauthorized"},
                },
            }
        },
        "/api/auth/refresh": {
            "post": {
                "tags": ["auth"],
                "summary": "Refrescar token",
                "description": "Obtiene nuevo access token usando refresh token",
                "operationId": "refreshToken",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/RefreshRequest"}
                        }
                    },
                },
                "responses": {
                    "200": {
                        "description": "Token refrescado",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/TokenResponse"}
                            }
                        },
                    },
                    "401": {"$ref": "#/components/responses/Unauthorized"},
                },
            }
        },
        "/api/auth/me": {
            "get": {
                "tags": ["auth"],
                "summary": "Obtener usuario actual",
                "description": "Retorna informacion del usuario autenticado",
                "operationId": "getCurrentUser",
                "responses": {
                    "200": {
                        "description": "Datos del usuario",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/UserResponse"}
                            }
                        },
                    },
                    "401": {"$ref": "#/components/responses/Unauthorized"},
                },
            }
        },
        # ==================== SOLICITUDES ====================
        "/api/solicitudes": {
            "get": {
                "tags": ["solicitudes"],
                "summary": "Listar solicitudes",
                "description": "Obtiene lista paginada de solicitudes con filtros",
                "operationId": "listSolicitudes",
                "parameters": [
                    {"$ref": "#/components/parameters/pageParam"},
                    {"$ref": "#/components/parameters/limitParam"},
                    {
                        "name": "estado",
                        "in": "query",
                        "schema": {"type": "string"},
                        "description": "Filtrar por estado",
                    },
                    {
                        "name": "centro",
                        "in": "query",
                        "schema": {"type": "string"},
                        "description": "Filtrar por centro",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Lista de solicitudes",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/SolicitudesListResponse"}
                            }
                        },
                    },
                    "401": {"$ref": "#/components/responses/Unauthorized"},
                },
            },
            "post": {
                "tags": ["solicitudes"],
                "summary": "Crear solicitud",
                "description": "Crea una nueva solicitud de materiales",
                "operationId": "createSolicitud",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/SolicitudCreate"}
                        }
                    },
                },
                "responses": {
                    "201": {
                        "description": "Solicitud creada",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/SolicitudResponse"}
                            }
                        },
                    },
                    "400": {"$ref": "#/components/responses/BadRequest"},
                    "401": {"$ref": "#/components/responses/Unauthorized"},
                },
            },
        },
        "/api/solicitudes/{id}": {
            "get": {
                "tags": ["solicitudes"],
                "summary": "Obtener solicitud",
                "description": "Obtiene detalle de una solicitud por ID",
                "operationId": "getSolicitud",
                "parameters": [{"$ref": "#/components/parameters/idParam"}],
                "responses": {
                    "200": {
                        "description": "Detalle de solicitud",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/SolicitudResponse"}
                            }
                        },
                    },
                    "404": {"$ref": "#/components/responses/NotFound"},
                },
            },
            "put": {
                "tags": ["solicitudes"],
                "summary": "Actualizar solicitud",
                "description": "Actualiza una solicitud existente",
                "operationId": "updateSolicitud",
                "parameters": [{"$ref": "#/components/parameters/idParam"}],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/SolicitudUpdate"}
                        }
                    },
                },
                "responses": {
                    "200": {
                        "description": "Solicitud actualizada",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/SolicitudResponse"}
                            }
                        },
                    },
                    "400": {"$ref": "#/components/responses/BadRequest"},
                    "404": {"$ref": "#/components/responses/NotFound"},
                },
            },
        },
        "/api/solicitudes/{id}/aprobar": {
            "post": {
                "tags": ["solicitudes"],
                "summary": "Aprobar solicitud",
                "description": "Aprueba una solicitud pendiente",
                "operationId": "approveSolicitud",
                "parameters": [{"$ref": "#/components/parameters/idParam"}],
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {"comentario": {"type": "string"}},
                            }
                        }
                    }
                },
                "responses": {
                    "200": {"description": "Solicitud aprobada"},
                    "400": {"$ref": "#/components/responses/BadRequest"},
                    "403": {"$ref": "#/components/responses/Forbidden"},
                },
            }
        },
        "/api/solicitudes/{id}/rechazar": {
            "post": {
                "tags": ["solicitudes"],
                "summary": "Rechazar solicitud",
                "description": "Rechaza una solicitud pendiente",
                "operationId": "rejectSolicitud",
                "parameters": [{"$ref": "#/components/parameters/idParam"}],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": ["motivo"],
                                "properties": {"motivo": {"type": "string"}},
                            }
                        }
                    },
                },
                "responses": {
                    "200": {"description": "Solicitud rechazada"},
                    "400": {"$ref": "#/components/responses/BadRequest"},
                    "403": {"$ref": "#/components/responses/Forbidden"},
                },
            }
        },
        # ==================== MRP ====================
        "/api/mrp/alertas": {
            "get": {
                "tags": ["mrp"],
                "summary": "Obtener alertas MRP",
                "description": "Lista alertas de stock y requerimientos",
                "operationId": "getMRPAlertas",
                "parameters": [
                    {
                        "name": "centro",
                        "in": "query",
                        "schema": {"type": "string"},
                        "description": "Filtrar por centro",
                    },
                    {
                        "name": "criticidad",
                        "in": "query",
                        "schema": {"type": "string", "enum": ["critico", "bajo", "normal"]},
                        "description": "Filtrar por nivel de criticidad",
                    },
                ],
                "responses": {
                    "200": {
                        "description": "Lista de alertas",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/MRPAlertasResponse"}
                            }
                        },
                    }
                },
            }
        },
        "/api/mrp/kpis": {
            "get": {
                "tags": ["mrp"],
                "summary": "Obtener KPIs MRP",
                "description": "Indicadores clave de rendimiento MRP",
                "operationId": "getMRPKPIs",
                "responses": {
                    "200": {
                        "description": "KPIs del sistema MRP",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/MRPKPIsResponse"}
                            }
                        },
                    }
                },
            }
        },
        # ==================== AI ====================
        "/api/ai/status": {
            "get": {
                "tags": ["ai"],
                "summary": "Estado de pipelines ML",
                "description": "Obtiene estado de los modelos de ML",
                "operationId": "getAIStatus",
                "responses": {
                    "200": {
                        "description": "Estado de los pipelines",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/AIStatusResponse"}
                            }
                        },
                    }
                },
            }
        },
        "/api/ai/train": {
            "post": {
                "tags": ["ai"],
                "summary": "Entrenar modelos ML",
                "description": "Entrena los pipelines de ML con datos historicos",
                "operationId": "trainAIModels",
                "responses": {
                    "200": {
                        "description": "Resultado del entrenamiento",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/AITrainResponse"}
                            }
                        },
                    }
                },
            }
        },
        "/api/ai/solicitudes/priorizar": {
            "get": {
                "tags": ["ai"],
                "summary": "Priorizar solicitudes",
                "description": "Ordena solicitudes por prioridad usando ML",
                "operationId": "prioritizeSolicitudes",
                "parameters": [
                    {
                        "name": "estado",
                        "in": "query",
                        "schema": {"type": "string", "default": "submitted"},
                    },
                    {"name": "limit", "in": "query", "schema": {"type": "integer", "default": 20}},
                ],
                "responses": {
                    "200": {
                        "description": "Solicitudes priorizadas",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/AIPrioritizeResponse"}
                            }
                        },
                    }
                },
            }
        },
        "/api/ai/sugerir-accion": {
            "post": {
                "tags": ["ai"],
                "summary": "Sugerir accion",
                "description": "Sugiere accion para una solicitud",
                "operationId": "suggestAction",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "solicitud_id": {"type": "integer"},
                                    "solicitud": {"type": "object"},
                                },
                            }
                        }
                    },
                },
                "responses": {
                    "200": {
                        "description": "Accion sugerida",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/AISuggestResponse"}
                            }
                        },
                    }
                },
            }
        },
        # ==================== SLA ====================
        "/api/sla/metricas": {
            "get": {
                "tags": ["sla"],
                "summary": "Metricas SLA",
                "description": "Obtiene metricas de cumplimiento SLA",
                "operationId": "getSLAMetrics",
                "responses": {
                    "200": {
                        "description": "Metricas de SLA",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/SLAMetricsResponse"}
                            }
                        },
                    }
                },
            }
        },
        "/api/sla/alertas": {
            "get": {
                "tags": ["sla"],
                "summary": "Alertas SLA",
                "description": "Lista alertas de SLA activas",
                "operationId": "getSLAAlerts",
                "responses": {
                    "200": {
                        "description": "Alertas activas",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/SLAAlertsResponse"}
                            }
                        },
                    }
                },
            }
        },
        # ==================== EXPORT ====================
        "/api/export/solicitudes": {
            "get": {
                "tags": ["export"],
                "summary": "Exportar solicitudes",
                "description": "Exporta solicitudes a Excel o CSV",
                "operationId": "exportSolicitudes",
                "parameters": [
                    {
                        "name": "formato",
                        "in": "query",
                        "schema": {"type": "string", "enum": ["xlsx", "csv"], "default": "xlsx"},
                    },
                    {"name": "estado", "in": "query", "schema": {"type": "string"}},
                ],
                "responses": {
                    "200": {
                        "description": "Archivo descargable",
                        "content": {
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {},
                            "text/csv": {},
                        },
                    }
                },
            }
        },
        "/api/export/formatos": {
            "get": {
                "tags": ["export"],
                "summary": "Formatos disponibles",
                "description": "Lista formatos de exportacion soportados",
                "operationId": "getExportFormats",
                "security": [],
                "responses": {
                    "200": {
                        "description": "Formatos soportados",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "ok": {"type": "boolean"},
                                        "data": {
                                            "type": "object",
                                            "properties": {
                                                "formatos": {
                                                    "type": "array",
                                                    "items": {"type": "string"},
                                                }
                                            },
                                        },
                                    },
                                }
                            }
                        },
                    }
                },
            }
        },
        # ==================== HEALTH ====================
        "/api/health": {
            "get": {
                "tags": ["health"],
                "summary": "Health check",
                "description": "Verifica estado del sistema",
                "operationId": "healthCheck",
                "security": [],
                "responses": {
                    "200": {
                        "description": "Sistema saludable",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/HealthResponse"}
                            }
                        },
                    }
                },
            }
        },
    }


def _get_components() -> Dict[str, Any]:
    """Define componentes reutilizables (schemas, responses, parameters)."""
    return {
        "securitySchemes": {
            "bearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
                "description": "JWT token obtenido de /api/auth/login",
            }
        },
        "parameters": {
            "idParam": {
                "name": "id",
                "in": "path",
                "required": True,
                "schema": {"type": "integer"},
                "description": "ID del recurso",
            },
            "pageParam": {
                "name": "page",
                "in": "query",
                "schema": {"type": "integer", "default": 1},
                "description": "Numero de pagina",
            },
            "limitParam": {
                "name": "limit",
                "in": "query",
                "schema": {"type": "integer", "default": 20, "maximum": 100},
                "description": "Items por pagina",
            },
        },
        "responses": {
            "Unauthorized": {
                "description": "No autenticado",
                "content": {
                    "application/json": {"schema": {"$ref": "#/components/schemas/ErrorResponse"}}
                },
            },
            "Forbidden": {
                "description": "Sin permisos",
                "content": {
                    "application/json": {"schema": {"$ref": "#/components/schemas/ErrorResponse"}}
                },
            },
            "NotFound": {
                "description": "Recurso no encontrado",
                "content": {
                    "application/json": {"schema": {"$ref": "#/components/schemas/ErrorResponse"}}
                },
            },
            "BadRequest": {
                "description": "Request invalido",
                "content": {
                    "application/json": {"schema": {"$ref": "#/components/schemas/ErrorResponse"}}
                },
            },
        },
        "schemas": {
            # ==================== BASE ====================
            "ErrorResponse": {
                "type": "object",
                "properties": {
                    "ok": {"type": "boolean", "example": False},
                    "error": {
                        "type": "object",
                        "properties": {"code": {"type": "string"}, "message": {"type": "string"}},
                    },
                },
            },
            # ==================== AUTH ====================
            "LoginRequest": {
                "type": "object",
                "required": ["email", "password"],
                "properties": {
                    "email": {"type": "string", "format": "email", "example": "usuario@spm.com"},
                    "password": {"type": "string", "format": "password", "example": "password123"},
                },
            },
            "LoginResponse": {
                "type": "object",
                "properties": {
                    "ok": {"type": "boolean"},
                    "data": {
                        "type": "object",
                        "properties": {
                            "access_token": {"type": "string"},
                            "refresh_token": {"type": "string"},
                            "user": {"$ref": "#/components/schemas/User"},
                        },
                    },
                },
            },
            "RefreshRequest": {
                "type": "object",
                "required": ["refresh_token"],
                "properties": {"refresh_token": {"type": "string"}},
            },
            "TokenResponse": {
                "type": "object",
                "properties": {
                    "ok": {"type": "boolean"},
                    "data": {"type": "object", "properties": {"access_token": {"type": "string"}}},
                },
            },
            "User": {
                "type": "object",
                "properties": {
                    "id_spm": {"type": "string"},
                    "nombre": {"type": "string"},
                    "email": {"type": "string"},
                    "rol": {"type": "string"},
                    "centro": {"type": "string"},
                    "sector": {"type": "string"},
                },
            },
            "UserResponse": {
                "type": "object",
                "properties": {
                    "ok": {"type": "boolean"},
                    "data": {"$ref": "#/components/schemas/User"},
                },
            },
            # ==================== SOLICITUDES ====================
            "SolicitudCreate": {
                "type": "object",
                "required": ["items"],
                "properties": {
                    "centro": {"type": "string"},
                    "sector": {"type": "string"},
                    "criticidad": {"type": "string", "enum": ["Normal", "Alta", "Urgente"]},
                    "fecha_necesidad": {"type": "string", "format": "date"},
                    "comentarios": {"type": "string"},
                    "items": {
                        "type": "array",
                        "items": {"$ref": "#/components/schemas/SolicitudItem"},
                        "minItems": 1,
                    },
                },
            },
            "SolicitudUpdate": {
                "type": "object",
                "properties": {
                    "criticidad": {"type": "string"},
                    "fecha_necesidad": {"type": "string", "format": "date"},
                    "comentarios": {"type": "string"},
                    "items": {
                        "type": "array",
                        "items": {"$ref": "#/components/schemas/SolicitudItem"},
                    },
                },
            },
            "SolicitudItem": {
                "type": "object",
                "required": ["material_codigo", "cantidad"],
                "properties": {
                    "material_codigo": {"type": "string"},
                    "descripcion": {"type": "string"},
                    "cantidad": {"type": "number", "minimum": 1},
                    "unidad": {"type": "string"},
                    "precio_unitario": {"type": "number"},
                },
            },
            "Solicitud": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "codigo": {"type": "string"},
                    "estado": {"type": "string"},
                    "centro": {"type": "string"},
                    "sector": {"type": "string"},
                    "criticidad": {"type": "string"},
                    "total_monto": {"type": "number"},
                    "fecha_necesidad": {"type": "string"},
                    "created_at": {"type": "string", "format": "date-time"},
                    "updated_at": {"type": "string", "format": "date-time"},
                    "items": {
                        "type": "array",
                        "items": {"$ref": "#/components/schemas/SolicitudItem"},
                    },
                },
            },
            "SolicitudResponse": {
                "type": "object",
                "properties": {
                    "ok": {"type": "boolean"},
                    "data": {"$ref": "#/components/schemas/Solicitud"},
                },
            },
            "SolicitudesListResponse": {
                "type": "object",
                "properties": {
                    "ok": {"type": "boolean"},
                    "data": {"type": "array", "items": {"$ref": "#/components/schemas/Solicitud"}},
                    "pagination": {"$ref": "#/components/schemas/Pagination"},
                },
            },
            "Pagination": {
                "type": "object",
                "properties": {
                    "page": {"type": "integer"},
                    "limit": {"type": "integer"},
                    "total": {"type": "integer"},
                    "pages": {"type": "integer"},
                },
            },
            # ==================== MRP ====================
            "MRPAlertasResponse": {
                "type": "object",
                "properties": {
                    "ok": {"type": "boolean"},
                    "data": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "material_codigo": {"type": "string"},
                                "descripcion": {"type": "string"},
                                "stock_actual": {"type": "number"},
                                "stock_seguridad": {"type": "number"},
                                "nivel_alerta": {"type": "string"},
                                "dias_cobertura": {"type": "number"},
                            },
                        },
                    },
                },
            },
            "MRPKPIsResponse": {
                "type": "object",
                "properties": {
                    "ok": {"type": "boolean"},
                    "data": {
                        "type": "object",
                        "properties": {
                            "materiales_criticos": {"type": "integer"},
                            "materiales_bajo_minimo": {"type": "integer"},
                            "cobertura_promedio": {"type": "number"},
                            "rotacion_inventario": {"type": "number"},
                        },
                    },
                },
            },
            # ==================== AI ====================
            "AIStatusResponse": {
                "type": "object",
                "properties": {
                    "ok": {"type": "boolean"},
                    "data": {
                        "type": "object",
                        "properties": {
                            "clustering": {"type": "object"},
                            "scoring": {"type": "object"},
                            "forecast": {"type": "object"},
                            "pipelines_trained": {"type": "boolean"},
                        },
                    },
                },
            },
            "AITrainResponse": {
                "type": "object",
                "properties": {
                    "ok": {"type": "boolean"},
                    "data": {
                        "type": "object",
                        "properties": {
                            "status": {"type": "string"},
                            "clustering": {"type": "object"},
                            "forecast": {"type": "object"},
                            "errors": {"type": "array", "items": {"type": "string"}},
                        },
                    },
                },
            },
            "AIPrioritizeResponse": {
                "type": "object",
                "properties": {
                    "ok": {"type": "boolean"},
                    "data": {
                        "type": "object",
                        "properties": {
                            "total_solicitudes": {"type": "integer"},
                            "solicitudes_rankeadas": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "solicitud_id": {"type": "integer"},
                                        "score": {"type": "number"},
                                        "rank": {"type": "integer"},
                                    },
                                },
                            },
                        },
                    },
                },
            },
            "AISuggestResponse": {
                "type": "object",
                "properties": {
                    "ok": {"type": "boolean"},
                    "data": {
                        "type": "object",
                        "properties": {
                            "accion_sugerida": {
                                "type": "string",
                                "enum": ["aprobar", "revisar", "escalar", "rechazar"],
                            },
                            "confianza": {"type": "number"},
                            "razones": {"type": "array", "items": {"type": "string"}},
                        },
                    },
                },
            },
            # ==================== SLA ====================
            "SLAMetricsResponse": {
                "type": "object",
                "properties": {
                    "ok": {"type": "boolean"},
                    "data": {
                        "type": "object",
                        "properties": {
                            "cumplimiento_general": {"type": "number"},
                            "tiempo_promedio_respuesta": {"type": "number"},
                            "solicitudes_en_tiempo": {"type": "integer"},
                            "solicitudes_vencidas": {"type": "integer"},
                        },
                    },
                },
            },
            "SLAAlertsResponse": {
                "type": "object",
                "properties": {
                    "ok": {"type": "boolean"},
                    "data": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "solicitud_id": {"type": "integer"},
                                "tipo_alerta": {"type": "string"},
                                "horas_restantes": {"type": "number"},
                                "severidad": {"type": "string"},
                            },
                        },
                    },
                },
            },
            # ==================== HEALTH ====================
            "HealthResponse": {
                "type": "object",
                "properties": {
                    "ok": {"type": "boolean"},
                    "data": {
                        "type": "object",
                        "properties": {
                            "status": {"type": "string"},
                            "version": {"type": "string"},
                            "database": {"type": "string"},
                            "uptime": {"type": "number"},
                        },
                    },
                },
            },
        },
    }
