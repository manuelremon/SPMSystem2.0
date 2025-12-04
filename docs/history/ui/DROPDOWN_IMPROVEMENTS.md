# Centro & Almacén Dropdowns - Access Control Improvements

## Commit
**Hash**: `07b7823`
**Date**: 2025-01-16
**Author**: GitHub Copilot
**Branch**: `main`

## Summary
Improved the Centro and Almacén dropdowns in the "Nueva Solicitud" form to provide better access control visualization and user experience.

## Changes Made

### 1. **Show ALL System Items**
- Previously: Dropdowns only showed items the user had access to
- Now: Dropdowns show ALL Centros and Almacenes from the system
- **Implementation**:
  - Fetch both permitted items from `/api/auth/mi-acceso`
  - Fetch all items from `/api/catalogos`
  - Combine and sort the results

### 2. **Visual Hierarchy - Permitted Items First**
- **Permitted items** (user has access):
  - Displayed FIRST in the list
  - Marked with 🟢 (green circle) and 🔓 (open lock)
  - Format: `🟢 🔓 [ID] - [Name]`
  - Clearly visible as available

- **Non-permitted items** (user does NOT have access):
  - Displayed AFTER permitted items
  - Marked with 🔴 (red circle) and 🔒 (closed lock)
  - Format: `🔴 🔒 [ID] - [Name]`
  - Clearly visible as restricted

### 3. **Warning Toasts on Selection**
- When a user selects a restricted item, a warning toast is displayed:
  - `⚠️ No tienes acceso al Centro "[name]"`
  - `⚠️ No tienes acceso al Almacén "[name]"`
- Toast type: `warning` (yellow/orange styling)
- Uses existing `showToast()` system function

### 4. **Dual Dropdown Implementation**
Applied the same sorting and warning logic to:
- **Centro dropdown** (`#newReqCentro`)
- **Almacén dropdown** (`#newReqAlmacen`)

## Code Structure

### New `loadFormCatalogs()` Function
```javascript
window.loadFormCatalogs = async function() {
    // 1. Fetch user permissions
    const accessRes = await fetch('/api/auth/mi-acceso');
    const centrosPermitidos = access.centros_permitidos || [];
    const almacenesPermitidos = access.almacenes_permitidos || [];

    // 2. Fetch all items
    const catalogRes = await fetch('/api/catalogos');
    const catalogs = catalogRes.json();

    // 3. Separate items into permitted and denied
    const centrosPermitidosList = [];
    const centrosNegadosList = [];

    catalogs.centros.forEach(c => {
        const hasAccess = centrosPermitidos.includes(c.id);
        if (hasAccess) {
            centrosPermitidosList.push(c);
        } else {
            centrosNegadosList.push(c);
        }
    });

    // 4. Add permitted items FIRST (🟢🔓)
    centrosPermitidosList.forEach(c => {
        opt.textContent = `🟢 🔓 ${c.id} - ${c.nombre}`;
        centroSelect.appendChild(opt);
    });

    // 5. Add denied items AFTER (🔴🔒)
    centrosNegadosList.forEach(c => {
        opt.textContent = `🔴 🔒 ${c.id} - ${c.nombre}`;
        centroSelect.appendChild(opt);
    });

    // 6. Add warning listeners
    centroSelect.addEventListener('change', (e) => {
        const centro = JSON.parse(e.target.value);
        if (!centro.hasAccess) {
            showToast(`⚠️ No tienes acceso...`, 'warning');
        }
    });
}
```

## Files Modified
- `src/frontend/home.html`
  - Function: `window.loadFormCatalogs()`
  - Lines: ~3939-4050 (approximately 112 insertions, 87 deletions)

## Technical Details

### Data Flow
1. **User loads form** → calls `loadFormCatalogs()`
2. **Fetch permissions** → `/api/auth/mi-acceso`
   - Returns: `centros_permitidos: []`, `almacenes_permitidos: []`
3. **Fetch all items** → `/api/catalogos`
   - Returns: `centros: []`, `almacenes: []`
4. **Process & Sort**
   - Split items into two arrays
   - Add permitted items first
   - Add denied items after
   - Attach change listeners
5. **User interaction**
   - Selects item from dropdown
   - If denied: warning toast appears
   - If permitted: normal behavior (autoFillSector for Centro)

### Key Functions Used
- `showToast(message, type)` - Existing notification system
- `autoFillSector()` - Auto-fills sector when Centro changes
- `JSON.stringify()` / `JSON.parse()` - Option value serialization

## User Experience Improvements

### Before
```
Centro Dropdown:
- Seleccione un Centro
- ✅ CENTRO-001 - Centro Principal
- ✅ CENTRO-002 - Centro Secundario
[Missing restricted items, no visual distinction]
```

### After
```
Centro Dropdown:
- Seleccione un Centro
  🟢 🔓 CENTRO-001 - Centro Principal    [Permitted]
  🟢 🔓 CENTRO-002 - Centro Secundario   [Permitted]
  🔴 🔒 CENTRO-003 - Centro Restringido  [Denied - Now visible!]
  🔴 🔒 CENTRO-004 - Centro Bloqueado    [Denied - Now visible!]

[When selecting restricted:] ⚠️ No tienes acceso al Centro "Centro Restringido"
```

## Testing Checklist
- [x] Dropdowns populate all items correctly
- [x] Permitted items appear first with 🟢🔓 icon
- [x] Denied items appear after with 🔴🔒 icon
- [x] Warning toast displays when selecting denied item
- [x] Warning toast displays correct item name
- [x] autoFillSector still works for Centro changes
- [x] Almacén dropdown has same behavior
- [x] No console errors
- [x] Git commit completed
- [x] Changes pushed to origin/main

## Future Enhancements
1. **Disable denied items** - Prevent selection entirely
2. **Styling** - Add CSS classes for denied items (gray out)
3. **Tooltips** - Show "Not Permitted" tooltip on hover
4. **Admin Interface** - Allow users to request access
5. **Audit Log** - Track when users view/attempt restricted items

## Rollback Instructions
If needed to revert this change:
```bash
git revert 07b7823
```

Or manually restore from previous commit:
```bash
git checkout 7e6062c -- src/frontend/home.html
git commit -m "Revert: Undo dropdown access control improvements"
```

## Notes
- Change is backward compatible
- No breaking changes to API or other components
- Existing event listeners preserved (autoFillSector)
- Uses existing notification system (showToast)
- Follows established coding patterns in codebase
