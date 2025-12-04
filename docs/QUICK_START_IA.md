# 🚀 QUICK START - Prueba el Sistema IA en 5 minutos

## ✅ Prerequisitos

- [ ] Python 3.8+
- [ ] Flask corriendo en puerto 5000
- [ ] Browser moderno (Chrome, Firefox, Edge)

---

## 🎬 PASO 1: Iniciar el servidor

```powershell
cd "d:\GitHub\SPM version robusta no anda login 2 dias\SPM\SPM"
python wsgi.py
```

✅ Debe ver: `Running on http://127.0.0.1:5000`

---

## 📖 PASO 2: Abrir la aplicación

Abre en tu browser:
```
http://127.0.0.1:5000/home.html
```

---

## 🧪 TEST 1: Widget Flotante (1 min)

### Acción:
1. Mira abajo a la derecha → Debe haber botón 🤖 pulsando
2. Clica el botón

### Resultado esperado:
✅ Panel se abre con animación suave
✅ Muestra "Hola, soy tu asistente..."
✅ Ve 4 sugerencias iniciales (Consumo, Stock, Solicitudes, MRP)
✅ Input text "Pregunta sobre materiales..."

### Si NO funciona:
- [ ] Abre DevTools (F12) → Console
- [ ] Busca errores en rojo
- [ ] Verifica que home.html se cargó completamente

---

## 🧪 TEST 2: Chat Contextual (2 min)

### Acción:
1. Panel abierto ✅
2. Clica sobre "📊 Consumo histórico"

### Resultado esperado:
✅ Tu pregunta aparece alineada a derecha (violeta)
✅ Muestra "🤖 Analizando" con 3 puntitos animados
✅ Recibe respuesta del servidor
✅ Respuesta aparece con borde violeta izquierda

### Prueba custom:
1. Input: "¿Cuál es el consumo promedio?"
2. Presiona **ENTER**
3. Debe enviar (no presionar botón 📤)

### Si recibe error:
```
POST http://127.0.0.1:5000/api/form-intelligence/chat 404
```

Significa que el blueprint no se registró. Verifica:
- [ ] `app.py` línea 19: `from .routes.form_intelligence_routes import bp as form_intelligence_bp`
- [ ] `app.py` línea 197: `app.register_blueprint(form_intelligence_bp)`
- [ ] Restart Flask (`Ctrl+C` y `python wsgi.py`)

---

## 🧪 TEST 3: Búsqueda de Materiales (1 min)

### Acción:
1. Ve a "Nueva Solicitud" (si no estás)
2. Paso 2: "Agregar Materiales"
3. En dropdown "Selecciona un material"
4. Empieza a escribir: "acero"

### Resultado esperado:
✅ Dropdown filtra opciones automáticamente
✅ Solo muestra materiales con "acero" en nombre/descripción
✅ Filtrado en tiempo real (sin lag)

---

## 🧪 TEST 4: Análisis Automático (1 min)

### Acción:
1. Selecciona un material del dropdown
2. (Por ejemplo: "Acero inoxidable" o similar)

### Resultado esperado:
✅ NO debe mostrar error
✅ En Console (F12) debe ver `console.log`:
   ```
   Material Intelligence Analysis: {
     material_codigo: "...",
     consumo_historico: {...},
     stock_actual: {...},
     ...
   }
   ```

### Si no hay análisis:
- [ ] Abre DevTools → Console
- [ ] Verifica errores en red (Network tab)
- [ ] Busca llamada a `/api/form-intelligence/analyze`

---

## 🧪 TEST 5: Cantidad + Validación (1 min)

### Acción:
1. Material seleccionado ✅
2. Ingresa cantidad: `1000`
3. Clica afuera del campo (blur)

### Resultado esperado:
✅ Si cantidad es muy alta vs histórico:
   - Muestra toast naranja: "⚠️ Cantidad muy alta vs histórico"
✅ Si cantidad es normal:
   - Sin aviso (comportamiento correcto)

### Si no funciona:
- [ ] Abre DevTools → Network
- [ ] Busca llamada a `/api/form-intelligence/suggest`
- [ ] ¿Recibe 200? ✅ / ¿404? ❌ Revisa blueprint

---

## 📊 TEST 6: Responsive (Mobile)

### En DevTools:
1. Presiona `Ctrl+Shift+M` (Toggle device toolbar)
2. Selecciona "iPhone 12" o similar

### Resultado esperado:
✅ Widget botón sigue visible
✅ Panel se reduce a 320px
✅ Texto sigue legible
✅ Input y botón funcionales

---

## 🐛 DEBUGGING

Si algo no funciona:

### 1. Verifica Backend
```powershell
# Revisa que esté corriendo
curl http://127.0.0.1:5000/api/form-intelligence/status

# Debe responder:
# {"status": "operacional", "version": "1.0", ...}
```

### 2. Verifica Frontend
```javascript
// En DevTools Console
fetch('/api/form-intelligence/status').then(r => r.json()).then(console.log)

// Debe responder:
// {status: "operacional", version: "1.0", ...}
```

### 3. Verifica que HTML cargó
```javascript
// En DevTools Console
document.getElementById('aiPanel')  // ¿Existe?
window.toggleAIPanel              // ¿Existe función?
window.sendAIMessage              // ¿Existe función?
```

### 4. Ver errores de red
```
DevTools → Network tab
Filtra por XHR
Ejecuta una acción
Busca llamadas a /api/form-intelligence/*
```

---

## 📝 NOTAS IMPORTANTES

### Simulación vs Real
```
Actualmente: Datos SIMULADOS (demo)
├─ Stock: Simulado (150 UN)
├─ MRP: Simulado (STOCK_OK)
├─ Consumo: Desde BD (si hay datos)
└─ IA: Respuestas template (simples)

Para PRODUCCIÓN, conectar:
├─ Stock real: SAP connector
├─ MRP real: SAP MRP connector
└─ IA real: Ollama o OpenAI API
```

### Dark Mode Premium
El widget usa:
- 🟣 Violeta #7c3aed (primario)
- ⬛ Oscuro #262d48 (fondo)
- ⚪ Blanco #f3f4f6 (texto)

Todo integrado con tema existente.

### Base de Datos
- ✅ Consumo histórico lee de `solicitudes` table
- ⏳ Stock, MRP, Solicitudes: Simulados (listos para conectar)

---

## ✨ NEXT: Personalización

### Cambiar emojis del widget:
```javascript
// Línea ~1055 en home.html
<button class="ai-widget-button" onclick="toggleAIPanel()" title="Asistente IA">
  🤖  ← Cambiar este emoji
</button>
```

### Cambiar sugerencias iniciales:
```html
<!-- Línea ~1066 en home.html -->
<div class="ai-suggestion-chip" onclick="askAI('Tu pregunta aquí')">
  📊 Tu texto aquí
</div>
```

### Cambiar colores:
```css
/* Línea ~23 en home.html dentro de :root */
--primary: #7c3aed;  ← Cambiar a otro color
--primary-light: #a78bfa;
--primary-dark: #5b21b6;
```

---

## 🎓 Flujo Completo de Usuario (5 min demo)

```
1. Abre home.html                        (1 min)
2. Clica Nueva Solicitud → Paso 2        (30 seg)
3. Clica botón 🤖 arriba a la derecha   (10 seg)
4. Clica "📊 Consumo histórico"         (5 seg)
5. Espera respuesta IA                   (5 seg)
6. Cierra panel                          (1 seg)
7. Busca material en dropdown            (30 seg)
8. Selecciona un material                (5 seg)
9. Observa análisis automático en Console (10 seg)
10. Ingresa cantidad y blur              (10 seg)
11. Observa validation warning           (5 seg)
12. Listo! Sistema funcionando ✅       (Total: 5 min)
```

---

## 📞 SOPORTE

Si hay problemas:

1. **Endpoint 404**
   - Solución: Restart Flask (paso 1)
   - Verifica: app.py importa y registra blueprint

2. **Widget no aparece**
   - Solución: F12 → Console → Busca errores
   - Verifica: CSS cargó, HTML visible en DOM

3. **Chat no responde**
   - Solución: Network tab → XHR → Ver respuesta
   - Verifica: Endpoint retorna 200 (no 500)

4. **Stock/MRP no muestran data**
   - Esperado: Actualmente simulado
   - Próximo: Conectar SAP real

---

## ✅ Checklist Final

- [ ] Widget 🤖 visible (bottom-right)
- [ ] Panel abre con animación
- [ ] Chat funciona (Enter key)
- [ ] Búsqueda material filtra
- [ ] Análisis se ejecuta (Console log)
- [ ] Validación cantidad muestra toasts
- [ ] Responsive funciona (mobile)
- [ ] Sin errores críticos (Console)

**Si todo ✅ → Sistema IA OPERACIONAL** 🎉

---

**Última actualización:** 26 de octubre 2025
**Version:** 1.0
**Status:** ✅ TESTING READY
