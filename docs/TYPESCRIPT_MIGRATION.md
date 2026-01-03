# Plan de Migracion a TypeScript

**Estado:** Evaluacion
**Prioridad:** P3 (Optimizacion futura)

---

## Justificacion

TypeScript proporciona:
- Type safety en tiempo de compilacion
- Mejor autocompletado en IDEs
- Refactoring mas seguro
- Documentacion implícita via tipos

## Estado Actual

| Aspecto | Valor |
|---------|-------|
| Frontend React | JavaScript (JSX) |
| Componentes | 75 archivos |
| Paginas | 46 archivos |
| Hooks | 8 archivos |
| Services | 11 archivos |

## Estrategia de Migracion

### Fase 1: Configuracion (1-2 horas)
```bash
cd frontend
npm install -D typescript @types/react @types/react-dom @types/node
npx tsc --init
```

Ajustar `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": false,
    "allowJs": true,
    "checkJs": false,
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

### Fase 2: Migracion Gradual

**Orden recomendado:**
1. `src/utils/` - Funciones puras, faciles de tipar
2. `src/services/` - APIs con tipos de respuesta claros
3. `src/hooks/` - Lógica reutilizable
4. `src/store/` - Estado global (Zustand soporta TS)
5. `src/components/ui/` - Componentes base
6. `src/components/` - Componentes de feature
7. `src/pages/` - Paginas (ultimo, dependen de todo)

**Proceso por archivo:**
1. Renombrar `.jsx` a `.tsx`
2. Agregar tipos a props: `function Button({ onClick }: { onClick: () => void })`
3. Tipar estados: `const [data, setData] = useState<User[]>([])`
4. Corregir errores de tipo
5. Verificar: `npm run build`

### Fase 3: Estricto (Opcional)

Una vez migrado todo:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true
  }
}
```

## Tipos Principales a Definir

```typescript
// types/auth.ts
interface User {
  id_spm: string;
  nombre: string;
  apellido: string;
  email: string;
  roles: string[];
  is_admin: boolean;
}

// types/solicitud.ts
interface Solicitud {
  id: number;
  numero_solicitud: string;
  estado: 'draft' | 'submitted' | 'approved' | 'rejected' | 'processing' | 'dispatched' | 'closed';
  items: SolicitudItem[];
  creado_en: string;
  actualizado_en: string;
}

interface SolicitudItem {
  codigo_sap: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
}

// types/api.ts
interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
```

## Herramientas Utiles

- **ts-migrate:** Migracion automatica basica
- **typescript-eslint:** Linting para TS
- **Zustand:** Soporte nativo de TS

## Riesgos y Mitigacion

| Riesgo | Mitigacion |
|--------|------------|
| Breaking changes | Migracion gradual con `allowJs: true` |
| Tiempo de build | `skipLibCheck: true`, incremental builds |
| Curva de aprendizaje | Empezar con `strict: false` |

## Estimacion

| Fase | Archivos | Esfuerzo |
|------|----------|----------|
| Configuracion | - | 1-2h |
| Utils/Services | ~19 | 4-6h |
| Hooks/Store | ~11 | 2-3h |
| Components UI | ~33 | 6-8h |
| Components Feature | ~42 | 8-12h |
| Pages | ~46 | 10-15h |
| **Total** | **~151** | **31-46h** |

## Conclusion

La migracion a TypeScript es recomendable pero no urgente. El sistema funciona correctamente con JavaScript. Priorizar cuando:
- Se agreguen features complejas
- El equipo crezca
- Se requiera refactoring mayor
