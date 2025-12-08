# Plan de Refactorización: DataTable.jsx → ModernDataTable
## Patrón Strangler Fig para Migración UI Empresarial

> **Metodología**: Ingeniería de Contexto + Patrón Strangler Fig
> **Estándar**: Densidad Empresarial (IBM Carbon / SAP Fiori)
> **Fecha**: 2025-12-06

---

## 1. Diagnóstico de Deuda Técnica

### 1.1 Violaciones al Sistema de Diseño Detectadas

| Línea | Violación | Regla Infringida | Corrección |
|-------|-----------|------------------|------------|
| 141 | `textShadow: '0 1px 2px rgba(0,0,0,0.3)'` | No usar valores inline | **Eliminar** (innecesario en dark mode) |
| 134 | `px-4 py-4` (16px padding) | Densidad empresarial = 8px | `px-2 py-2` via `h-row-compact` |
| 170 | `px-4 py-3.5` (14px vertical) | Grid 8pt estricto | `px-2 py-1.5` (6px) o `py-2` (8px) |
| 73-76 | `w-3.5 h-3.5` (14px iconos) | Escala de 4px | `w-3 h-3` (12px) |
| 86, 94 | `py-16` (64px empty state) | Excesivo para enterprise | `py-12` (48px) |

### 1.2 Lógica de Negocio Acoplada (Anti-patrón)

```javascript
// ❌ PROBLEMA: Constantes de dominio SPM dentro del componente UI
const CENTERED_COLUMNS = ['id', 'centro', 'almacen', ...]; // Líneas 5-22
const RIGHT_ALIGNED_COLUMNS = ['monto', 'total', ...];
const LEFT_ALIGNED_COLUMNS = ['justificacion', 'asunto', ...];
```

**Impacto**: El componente UI "conoce" la estructura de negocio de SPM, violando el principio de separación de concerns.

### 1.3 Elementos que YA Cumplen Estándares ✅

- Uso correcto de CSS Variables: `var(--border)`, `var(--fg)`, `var(--primary)`
- HTML semántico: `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`
- Atributos ARIA: `role="table"`, `aria-sort`, `aria-label`

---

## 2. Tokens de Densidad Empresarial

### 2.1 Definición de Tokens en `index.css`

```css
:root {
  /* PRIMITIVAS DE DENSIDAD EMPRESARIAL (Grid 8pt) */
  --spacing-base: 0.25rem; /* 4px - Base atómica */

  /* TOKENS SEMÁNTICOS - DENSIDAD DE TABLA */
  --density-cozy: 3rem;      /* 48px - Touch friendly */
  --density-compact: 2rem;   /* 32px - Enterprise standard */

  /* TOKENS DE COMPONENTE - TABLA */
  --table-row-height: var(--density-compact);
  --table-cell-px: 0.5rem;   /* 8px horizontal */
  --table-cell-py: 0.375rem; /* 6px vertical */
  --table-header-py: 0.5rem; /* 8px vertical */
  --table-font-size: 0.875rem;    /* 14px - text-sm */
  --table-header-size: 0.75rem;   /* 12px - text-xs */
}
```

### 2.2 Clase Utilitaria `h-row-compact` en Tailwind

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      height: {
        'row-compact': 'var(--density-compact)', // 32px
        'row-cozy': 'var(--density-cozy)',       // 48px
      }
    }
  }
}
```

### 2.3 Clase CSS Compuesta

```css
/* index.css - Clase de densidad obligatoria */
.h-row-compact {
  @apply h-8;           /* 32px altura */
}
.h-row-compact td,
.h-row-compact th {
  @apply px-2 py-1.5;   /* 8px horizontal, 6px vertical */
  @apply text-sm;       /* 14px */
}
.h-row-compact th {
  @apply text-xs font-semibold uppercase tracking-wider;
}
```

---

## 3. Desacoplamiento de Lógica de Negocio

### 3.1 Extraer a `utils/tableAlignments.js`

```javascript
// Lógica de dominio SPM - FUERA del componente UI
export const SPM_COLUMN_ALIGNMENTS = {
  // Columnas centradas
  id: 'center', centro: 'center', almacen: 'center',
  sector: 'center', estado: 'center', criticidad: 'center',
  fecha: 'center', planificador: 'center', items: 'center',

  // Columnas alineadas derecha (montos)
  monto: 'right', total: 'right', precio: 'right',
  subtotal: 'right', presupuesto: 'right',

  // Columnas alineadas izquierda (texto largo)
  justificacion: 'left', asunto: 'left', descripcion: 'left',
  observaciones: 'left', motivo: 'left',
};

export function getColumnAlignment(key) {
  return SPM_COLUMN_ALIGNMENTS[key?.toLowerCase()] ?? 'center';
}

export function withSpmAlignments(columns) {
  return columns.map(col => ({
    ...col,
    align: col.align ?? getColumnAlignment(col.key)
  }));
}
```

### 3.2 Uso en Consumidores

```jsx
// En páginas que usan DataTable
import { withSpmAlignments } from '@/utils/tableAlignments';

const columns = withSpmAlignments([
  { key: 'id', header: 'ID' },
  { key: 'monto', header: 'Monto' },
  // align se infiere automáticamente del helper
]);
```

---

## 4. Flujo de Trabajo: Patrón Strangler Fig

### FASE 0: Instalación de Dependencias

```bash
cd frontend
npm install @tanstack/react-table
```

### FASE 1: Preparación de Infraestructura (No rompe nada)

#### 1.1 Crear Primitivos Shadcn Table

**Archivo**: `components/ui/table.jsx`

```jsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Table = React.forwardRef(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
));

const TableHeader = React.forwardRef(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
));

const TableBody = React.forwardRef(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));

const TableRow = React.forwardRef(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "h-row-compact border-b transition-colors hover:bg-muted/50",
      className
    )}
    {...props}
  />
));

const TableHead = React.forwardRef(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-8 px-2 text-left align-middle font-semibold text-xs uppercase tracking-wider",
      "text-[var(--fg-muted)] bg-[var(--bg-soft)] sticky top-0 z-10",
      className
    )}
    {...props}
  />
));

const TableCell = React.forwardRef(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("px-2 py-1.5 align-middle text-sm", className)}
    {...props}
  />
));

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
```

#### 1.2 Agregar Tokens de Densidad a `index.css`

```css
/* Después de las variables existentes */

/* TOKENS DE DENSIDAD EMPRESARIAL */
--density-compact: 2rem;   /* 32px */
--density-cozy: 3rem;      /* 48px */

/* Clase de densidad obligatoria para tablas */
.h-row-compact {
  height: var(--density-compact);
}
```

#### 1.3 Crear Helper de Alineación

**Archivo**: `utils/tableAlignments.js` (ver Sección 3.1)

---

### FASE 2: Implementación del Componente Estrangulador

#### 2.1 Estructura de Carpetas

```
frontend/src/components/features/DataTable/
├── ModernDataTable.jsx    # Componente principal con TanStack
├── columns.js             # Adaptador de columnas legacy → TanStack
└── index.js               # Re-exports
```

#### 2.2 ModernDataTable.jsx (Esqueleto)

```jsx
import React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell
} from "@/components/ui/table";
import { ChevronUp, ChevronDown, ChevronsUpDown, Inbox } from "lucide-react";
import { adaptLegacyColumns } from "./columns";

export function ModernDataTable({
  columns = [],
  rows = [],
  emptyMessage = "Sin datos",
  className = "",
  density = "compact", // 'compact' | 'cozy'
}) {
  const [sorting, setSorting] = React.useState([]);

  // Adaptar columnas legacy al formato TanStack
  const tanstackColumns = React.useMemo(
    () => adaptLegacyColumns(columns),
    [columns]
  );

  const table = useReactTable({
    data: rows,
    columns: tanstackColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const densityClass = density === "compact" ? "h-row-compact" : "h-row-cozy";

  // Empty state
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center mb-4">
          <Inbox className="w-6 h-6 text-[var(--fg-muted)]" />
        </div>
        <div className="text-[var(--fg-muted)] text-sm">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <Table className={className}>
      <TableHeader>
        {table.getHeaderGroups().map(headerGroup => (
          <TableRow key={headerGroup.id} className={densityClass}>
            {headerGroup.headers.map(header => (
              <TableHead
                key={header.id}
                onClick={header.column.getToggleSortingHandler()}
                className={header.column.getCanSort() ? "cursor-pointer select-none" : ""}
              >
                <div className="flex items-center gap-1">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getCanSort() && (
                    <SortIcon sorted={header.column.getIsSorted()} />
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map(row => (
          <TableRow key={row.id} className={densityClass}>
            {row.getVisibleCells().map(cell => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SortIcon({ sorted }) {
  if (sorted === "asc") return <ChevronUp className="w-3 h-3" />;
  if (sorted === "desc") return <ChevronDown className="w-3 h-3" />;
  return <ChevronsUpDown className="w-3 h-3 opacity-40" />;
}
```

#### 2.3 Adaptador de Columnas (`columns.js`)

```javascript
// Convierte formato legacy a formato TanStack Table
export function adaptLegacyColumns(legacyColumns) {
  return legacyColumns.map(col => ({
    accessorKey: col.key,
    header: col.header,
    cell: col.render
      ? ({ row }) => col.render(row.original)
      : ({ getValue }) => getValue(),
    enableSorting: !!col.sortAccessor,
    sortingFn: col.sortAccessor
      ? (rowA, rowB) => {
          const a = col.sortAccessor(rowA.original);
          const b = col.sortAccessor(rowB.original);
          return a < b ? -1 : a > b ? 1 : 0;
        }
      : undefined,
    meta: { align: col.align || 'center' },
  }));
}
```

---

### FASE 3: Migración de Consumidores

#### 3.1 Patrón de Reemplazo (Sin romper compatibilidad)

```jsx
// ANTES
import { DataTable } from "@/components/ui/DataTable";

// DESPUÉS
import { ModernDataTable as DataTable } from "@/components/features/DataTable";
import { withSpmAlignments } from "@/utils/tableAlignments";

// Uso idéntico, solo agregar helper de alineación
const columns = withSpmAlignments([...]);
```

#### 3.2 Páginas a Migrar

| Página | Prioridad | Complejidad |
|--------|-----------|-------------|
| `MisSolicitudes.jsx` | Alta | Media |
| `Aprobaciones.jsx` | Alta | Media |
| `Materials.jsx` | Alta | Baja |
| `Planner.jsx` | Media | Alta |
| `AdminUsuarios.jsx` | Media | Baja |
| `AdminMateriales.jsx` | Media | Baja |
| `AdminCentros.jsx` | Baja | Baja |
| `AdminAlmacenes.jsx` | Baja | Baja |

---

### FASE 4: Validación y Limpieza

#### 4.1 Checklist de Validación

- [ ] Todas las filas usan `h-row-compact` (32px altura)
- [ ] Headers usan `text-xs uppercase tracking-wider`
- [ ] Padding horizontal = 8px (`px-2`)
- [ ] Headers son `sticky top-0 z-10` para scroll
- [ ] Ordenamiento funciona igual que antes
- [ ] Renderizado de celdas custom preservado
- [ ] Atributos ARIA presentes
- [ ] Modo reducido de movimiento respetado

#### 4.2 Limpieza Final

```bash
# Mover legacy a deprecated
mv frontend/src/components/ui/DataTable.jsx frontend/src/components/deprecated/

# Buscar imports huérfanos
grep -r "from.*ui/DataTable" frontend/src/

# Eliminar CSS muerto asociado
```

---

## 5. Mapa de Artefactos de Contexto

### 5.1 Archivos a Crear

| Archivo | Propósito | Prioridad |
|---------|-----------|-----------|
| `components/ui/table.jsx` | Primitivos Shadcn (Table, TableHead, etc.) | FASE 1 |
| `utils/tableAlignments.js` | Helper centralizado de alineación SPM | FASE 1 |
| `components/features/DataTable/ModernDataTable.jsx` | Componente principal con TanStack | FASE 2 |
| `components/features/DataTable/columns.js` | Adaptador de columnas legacy → TanStack | FASE 2 |
| `components/features/DataTable/index.js` | Re-exports | FASE 2 |

### 5.2 Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `frontend/package.json` | Agregar `@tanstack/react-table` |
| `frontend/src/index.css` | Agregar tokens `--density-compact` y clase `.h-row-compact` |
| `frontend/tailwind.config.js` | Agregar `height: { 'row-compact': 'var(--density-compact)' }` |
| 8+ páginas consumidoras | Actualizar imports |

### 5.3 Archivos a Deprecar

| Archivo | Destino |
|---------|---------|
| `components/ui/DataTable.jsx` | `components/deprecated/DataTable.legacy.jsx` |

---

## 6. Reglas de Guardrails para CLAUDE.md

Agregar estas restricciones al archivo `CLAUDE.md` del proyecto:

```markdown
## Restricciones de UI (Densidad Empresarial)

### DON'Ts - Prohibiciones Absolutas
- NUNCA usar valores hexadecimales (#FFFFFF) o píxeles directamente
- NUNCA usar clases arbitrarias de Tailwind (ej. `w-[350px]`, `h-[37px]`)
- NUNCA usar padding > 8px (px-2) en celdas de tabla
- NUNCA usar altura de fila > 32px para datos tabulares

### DOs - Obligaciones
- SIEMPRE usar la clase `h-row-compact` en filas de tabla
- SIEMPRE usar `text-xs uppercase tracking-wider` para headers de tabla
- SIEMPRE aplicar `sticky top-0 z-10` a headers para scroll
- SIEMPRE respetar el Grid de 8pt (múltiplos de 4px: p-1, p-2, p-3, p-4)
- SIEMPRE usar tokens semánticos de `index.css` para colores
```

---

## 7. Estimación y Riesgos

### Estimación de Esfuerzo

| Fase | Duración | Dependencias |
|------|----------|--------------|
| FASE 0: Dependencias | 5 min | - |
| FASE 1: Infraestructura | 2-3 horas | - |
| FASE 2: Componente | 3-4 horas | FASE 1 |
| FASE 3: Migración | 2-3 horas | FASE 2 |
| FASE 4: Limpieza | 1 hora | FASE 3 |
| **TOTAL** | **8-11 horas** | |

### Riesgos y Mitigaciones

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Regresiones visuales | Media | Comparar screenshots antes/después |
| API incompatible | Baja | Adaptador `adaptLegacyColumns()` |
| Pérdida de a11y | Baja | Primitivos Shadcn tienen ARIA |
| Conflictos de merge | Media | Migrar por página, no masivo |

---

## 8. Resumen Ejecutivo

### Decisiones Finales

| Aspecto | Decisión |
|---------|----------|
| **Metodología** | Patrón Strangler Fig (migración incremental) |
| **Densidad** | 32px altura fila (`h-row-compact`) obligatoria |
| **Alineación** | Helper centralizado en `utils/tableAlignments.js` |
| **Tecnología** | TanStack Table v8 + Shadcn UI primitives |
| **Ubicación** | `components/features/DataTable/ModernDataTable.jsx` |
| **Compatibilidad** | Props 100% compatibles con DataTable legacy |
| **Lenguaje** | JavaScript (JSX) |

### Objetivos Alcanzados

1. ✅ **Desacoplamiento**: Lógica de negocio SPM extraída a helper
2. ✅ **Estandarización**: Primitivos Shadcn para consistencia
3. ✅ **Densidad Empresarial**: Grid 8pt, filas 32px, padding 8px
4. ✅ **Rendimiento**: TanStack Table (virtualización opcional)
5. ✅ **Accesibilidad**: ARIA preservado, sticky headers
6. ✅ **Mantenibilidad**: Tokens semánticos, no valores mágicos
