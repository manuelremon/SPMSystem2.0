# Quick Reference - Base de Datos SPM

## Acceso Rápido a Información

### Queries Útiles

```sql
-- Ver todos los usuarios
SELECT id_spm, nombre, apellido, rol, mail FROM usuarios;

-- Ver todos los materiales disponibles
SELECT codigo, descripcion, precio_usd FROM materiales;

-- Ver presupuestos disponibles
SELECT centro, sector, monto_usd, saldo_usd FROM presupuestos;

-- Ver solicitudes (una vez que existan)
SELECT id, id_usuario, centro, sector, status, created_at FROM solicitudes;

-- Ver centros disponibles
SELECT codigo, nombre FROM catalog_centros;

-- Ver sectores disponibles
SELECT nombre FROM catalog_sectores;

-- Ver almacenes disponibles
SELECT codigo, nombre, centro_codigo FROM catalog_almacenes;
```

### Usuarios de Prueba

| ID | Nombre Completo | Email | Rol | Password |
|----|----|----|----|-----|
| admin001 | Administrador Sistema | admin@spm.local | admin | 1234 |
| empl001 | Juan Pérez | juan@spm.local | empleado | 1234 |
| empl002 | María García | maria@spm.local | empleado | 1234 |
| aprobador001 | Carlos López | carlos@spm.local | aprobador | 1234 |
| planificador001 | Ana Martínez | ana@spm.local | planificador | 1234 |

### Catálogos

#### Centros de Operación
- C001: Centro Principal
- C002: Centro Secundario
- C003: Centro Logístico

#### Sectores
- IT: Tecnología
- RRHH: Recursos Humanos
- FINANZAS: Finanzas
- OPERACIONES: Operaciones
- MANTENIMIENTO: Mantenimiento

#### Materiales Disponibles
- MAT001: Computadora Portátil (1200 USD)
- MAT002: Monitor LED (300 USD)
- MAT003: Teclado Inalámbrico (80 USD)
- MAT004: Mouse Óptico (25 USD)
- MAT005: Cable HDMI (15 USD)
- MAT006: Papel Bond (5 USD)
- MAT007: Bolígrafos (10 USD)

#### Almacenes
- ALM001: Almacén Central (en C001)
- ALM002: Almacén Secundario (en C002)
- ALM003: Almacén Temporal (en C003)

#### Roles del Sistema
- admin: Acceso total
- empleado: Crear y ver solicitudes
- aprobador: Aprobar solicitudes
- planificador: Gestionar compras
- jefe_centro: Supervisar centro

### Presupuestos Asignados

| Centro | Sector | Monto (USD) | Saldo (USD) |
|--------|--------|------------|-----------|
| C001 | IT | 50000 | 50000 |
| C001 | RRHH | 10000 | 10000 |
| C002 | OPERACIONES | 30000 | 30000 |
| C003 | MANTENIMIENTO | 15000 | 15000 |

Total disponible: 105,000 USD

## Estructura de Tablas Principales

### USUARIOS
```
id_spm (PK)
nombre
apellido
rol
mail
posicion
sector
centros (JSON)
estado_registro
```

### SOLICITUDES
```
id (PK)
id_usuario (FK → usuarios)
centro
sector
justificacion
status: draft|submitted|approved|rejected|processing|dispatched|closed
criticidad: baja|normal|alta|urgente
data_json (items: [{material, cantidad, precio_unitario_est}])
created_at
updated_at
```

### SOLPEDS (Items de Solicitud)
```
id (PK)
solicitud_id (FK)
material
um (unidad de medida)
cantidad
precio_unitario_est
status
```

### MATERIALES
```
codigo (PK)
descripcion
descripcion_larga
centro
sector
unidad
precio_usd
```

### PRESUPUESTOS
```
centro (PK)
sector (PK)
monto_usd
saldo_usd
```

## Cambios Frecuentes

### Agregar un nuevo usuario
```python
INSERT INTO usuarios
(id_spm, nombre, apellido, rol, contrasena, mail, estado_registro)
VALUES ('usuario123', 'Nombre', 'Apellido', 'empleado', 'hash_password', 'email@spm.local', 'activo')
```

### Agregar un nuevo material
```python
INSERT INTO materiales
(codigo, descripcion, centro, sector, unidad, precio_usd)
VALUES ('MAT008', 'Nuevo Material', 'C001', 'IT', 'UNIDAD', 500.00)
```

### Actualizar saldo de presupuesto
```python
UPDATE presupuestos
SET saldo_usd = saldo_usd - 1000
WHERE centro = 'C001' AND sector = 'IT'
```

## Notas Importantes

- SQLite no enforza foreign keys por defecto
  → Habilitar en app.py: `conn.execute("PRAGMA foreign_keys = ON")`

- Campos JSON principales:
  → solicitudes.data_json: Contiene lista de items
  → solicitud_tratamiento_log.payload_json: Cambios de estado

- Estados válidos de solicitud:
  → draft: Borrador
  → submitted: Enviada
  → approved: Aprobada
  → rejected: Rechazada
  → processing: En procesamiento
  → dispatched: Despachada
  → closed: Cerrada

- Criticidades permitidas:
  → baja, normal, alta, urgente

## Archivos de Referencia

- analizar_db.py: Script para analizar la BD
- seed_db.py: Script para popular datos iniciales
- DB_ANALYSIS.md: Análisis detallado
- BD_RESUMEN_FINAL.md: Resumen completo
- DB_DIAGRAMA.txt: Diagrama visual

## Localización de Archivos

- Base de datos: `src/backend/core/data/spm.db`
- Scripts análisis: Raíz del proyecto SPM
- Documentación: Raíz del proyecto SPM

## Tamaño y Performance

- Tamaño actual: ~100 KB
- Capacidad: +1,000,000 registros sin degradación
- Índices optimizados en: usuarios, solicitudes, materiales
- Query más frecuente: Búsqueda de solicitudes por usuario (idx_sol_user)
