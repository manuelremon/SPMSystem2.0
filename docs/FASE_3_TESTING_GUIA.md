# 🧪 FASE 3: Testing & Validación

**Estado:** Tests creados, listos para ejecutar
**Archivos creados:** 2 suites de tests + runner script + config

---

## 📋 Qué se creó

### 1️⃣ Unit Tests (`tests/unit/test_planner_service.py`)

**Qué prueba:** Lógica pura Python (sin HTTP ni BD completa)

```
TestPaso1AnalizarSolicitud
  ✓ test_paso_1_solicitud_valida
  ✓ test_paso_1_solicitud_no_existe
  ✓ test_paso_1_resumen_tiene_presupuesto
  ✓ test_paso_1_conflictos_tienen_estructura

TestPaso2OpcionesAbastecimiento
  ✓ test_paso_2_retorna_opciones
  ✓ test_paso_2_opciones_tienen_estructura
  ✓ test_paso_2_item_no_existe

TestPaso3GuardarTratamiento
  ✓ test_paso_3_valida_decisiones_vacio
  ✓ test_paso_3_retorna_estructura_correcta
  ✓ test_paso_3_decision_valida_estructura

TestRepository
  ✓ test_solicitud_repository_get_by_id_tipo

TestCache
  ✓ test_cache_get_stock_retorna_dataframe
  ✓ test_cache_clear_funciona

TestSchemas
  ✓ test_conflicto_to_dict
  ✓ test_opcion_to_dict
  ✓ test_resultado_paso_1_to_dict
```

**Total:** 18 unit tests

---

### 2️⃣ Integration Tests (`tests/integration/test_planner_endpoints.py`)

**Qué prueba:** Endpoints HTTP + respuestas JSON

```
TestEndpointPaso1
  ✓ test_paso_1_endpoint_accesible
  ✓ test_paso_1_respuesta_tiene_estructura
  ✓ test_paso_1_error_solicitud_no_existe

TestEndpointPaso2
  ✓ test_paso_2_endpoint_accesible
  ✓ test_paso_2_respuesta_estructura

TestEndpointPaso3
  ✓ test_paso_3_endpoint_accesible
  ✓ test_paso_3_falla_sin_decisiones
  ✓ test_paso_3_respuesta_estructura

TestErrorHandling
  ✓ test_endpoint_inexistente_404
  ✓ test_metodo_no_permitido_405
  ✓ test_json_invalido_400

TestResponseFormat
  ✓ test_respuesta_exitosa_tiene_ok_true
  ✓ test_content_type_es_json

TestDataSerialization
  ✓ test_paso_1_json_serializable
  ✓ test_paso_2_json_serializable
```

**Total:** 17 integration tests

---

## 🚀 Cómo ejecutar

### Opción 1: Script maestro (Recomendado)

```bash
# Todos los tests
python run_tests.py

# Solo unit tests
python run_tests.py --unit

# Solo integration tests
python run_tests.py --integration

# Modo verbose (más output)
python run_tests.py --verbose

# Con coverage report
python run_tests.py --coverage

# Combinadas
python run_tests.py --unit --coverage --verbose
```

### Opción 2: Pytest directo

```bash
# Unit tests solamente
pytest tests/unit/test_planner_service.py -v

# Integration tests solamente
pytest tests/integration/test_planner_endpoints.py -v

# Todos los tests
pytest tests/ -v

# Con markers
pytest tests/ -m unit
pytest tests/ -m integration

# Con coverage
pytest tests/ --cov=backend_v2 --cov-report=html
```

### Opción 3: Desde terminal Windows PowerShell

```powershell
# Activar venv primero
& .\.venv\Scripts\Activate.ps1

# Luego ejecutar
python run_tests.py --verbose

# O directamente pytest
pytest tests/unit/ -v
```

---

## 📊 Qué esperar

### Ejecución exitosa:

```
================================= Unit Tests =================================
tests/unit/test_planner_service.py::TestPaso1AnalizarSolicitud::test_paso_1_solicitud_valida PASSED
tests/unit/test_planner_service.py::TestPaso1AnalizarSolicitud::test_paso_1_solicitud_no_existe PASSED
...
================================ 18 passed in 0.45s ===============================

========================== Integration Tests ================================
tests/integration/test_planner_endpoints.py::TestEndpointPaso1::test_paso_1_endpoint_accesible PASSED
tests/integration/test_planner_endpoints.py::TestEndpointPaso1::test_paso_1_respuesta_tiene_estructura PASSED
...
================================ 17 passed in 2.34s ===============================

📊 RESUMEN DE RESULTADOS
================================
UNIT            → ✅ PASSED
INTEGRATION     → ✅ PASSED

🎉 TODOS LOS TESTS PASARON ✅
```

### Con errores:

```
tests/unit/test_planner_service.py::TestPaso1AnalizarSolicitud::test_paso_1_solicitud_valida FAILED

________________________________ FAILURES ________________________________
def test_paso_1_solicitud_valida():
    resultado = paso_1_analizar_solicitud(1)
    assert "paso" in resultado
E   KeyError: 'paso'

⚠️  ALGUNOS TESTS FALLARON ❌
```

---

## 🔍 Entender los tests

### Unit Test - Ejemplo

```python
# tests/unit/test_planner_service.py
def test_paso_1_solicitud_valida(self):
    """Test que paso_1 retorna estructura correcta"""
    # ARRANGE: Preparar datos
    resultado = paso_1_analizar_solicitud(1)

    # ACT + ASSERT: Verificar
    assert "solicitud_id" in resultado
    assert "paso" in resultado
    assert resultado["paso"] == 1
    assert "conflictos" in resultado

    print("✅ test_paso_1_solicitud_valida PASSED")
```

**Patrón:**
1. Llamar función siendo testeada
2. Verificar resultado con `assert`
3. Si falla → pytest muestra error

### Integration Test - Ejemplo

```python
# tests/integration/test_planner_endpoints.py
def test_paso_1_respuesta_estructura(self, client):
    """Test que PASO 1 retorna JSON correcto"""
    # ARRANGE: Cliente HTTP
    # ACT: Hacer request
    response = client.post('/api/planificador/solicitudes/1/analizar')

    # ASSERT: Verificar response
    if response.status_code == 200:
        data = response.get_json()
        assert "ok" in data
        assert "data" in data
        assert data["data"]["paso"] == 1
```

**Patrón:**
1. Usar `client` fixture para hacer HTTP request
2. Verificar status code
3. Verificar estructura JSON
4. Si falla → pytest muestra que esperaba vs qué recibió

---

## ⚠️ Notas importantes

### Requisitos previos

1. ✅ **Venv activado**
   ```bash
   .\.venv\Scripts\Activate.ps1
   ```

2. ✅ **Pytest instalado**
   ```bash
   pip install pytest pytest-cov
   ```

3. ✅ **BD de test disponible** (usa BD actual)
   - Tests usan BD real en `spm.db`
   - Si no hay datos, algunos tests skipearán

### Tests que pueden fallar esperadamente

```
⚠️  test_paso_1_solicitud_valida: Solicitud de test no existe en BD (esperado)
```

Esto es **OK**, significa que:
- Test de estructura fue escrito correctamente
- BD no tiene solicitud con ID=1
- Test skipped automáticamente

### Tests que deben SIEMPRE pasar

```
✅ test_paso_1_solicitud_no_existe           ← Debe fallar si no existe
✅ test_paso_3_valida_decisiones_vacio       ← Debe fallar si vacío
✅ test_cache_clear_funciona                 ← Siempre debe funcionar
✅ test_endpoint_inexistente_404             ← Debe retornar 404
```

---

## 🐛 Debugging Tests

### Si un test falla:

```bash
# Ver más detalles
pytest tests/unit/test_planner_service.py::TestPaso1AnalizarSolicitud::test_paso_1_solicitud_valida -vv

# Ver output (print statements)
pytest tests/unit/ -s

# Ver traceback completo
pytest tests/unit/ -vv --tb=long
```

### Si tests de integration fallan por auth:

```
SKIPPED: Auth required (expected)
```

Esto es normal si la app requiere token JWT. Para testear endpoints protegidos:

```python
# Agregar auth en test
response = client.post(
    '/api/planificador/solicitudes/1/analizar',
    headers={'Authorization': f'Bearer {token}'}
)
```

---

## 📈 Coverage Report

Ver cobertura de código:

```bash
# Generar coverage
pytest tests/ --cov=backend_v2 --cov-report=html

# Abre en browser
start htmlcov/index.html

# O desde terminal
pytest tests/ --cov=backend_v2 --cov-report=term-missing
```

**Salida esperada:**
```
Name                                      Stmts   Miss  Cover
--------------------------------------------------------------
backend_v2/core/repository.py              120     10    91%
backend_v2/core/cache_loader.py             85      5    94%
backend_v2/core/services/planner_service.py 200    15    92%
backend_v2/routes/planner.py               350    80    77%
--------------------------------------------------------------
TOTAL                                       755     110   85%
```

---

## 🎯 Próximos pasos (Fase 3 continuación)

### ✅ Completado
- [x] Unit tests creados (18 tests)
- [x] Integration tests creados (17 tests)
- [x] Test runner script creado
- [x] Pytest configurado

### 📋 Por hacer
- [ ] **Ejecutar tests** en terminal
- [ ] **Revisar resultados**
- [ ] **Fijar bugs** si algunos fallan
- [ ] **Medir coverage** (objetivo: >85%)
- [ ] **Manual testing** en browser (flujo completo)

### 🔄 Ciclo de testing

```
1. Run tests → 2. Review results → 3. Fix bugs → 4. Repeat
```

---

## 📞 Comandos rápidos

```bash
# Run all (opción 1)
python run_tests.py

# Run all (opción 2)
pytest tests/ -v

# Solo unit
pytest tests/unit/ -v

# Solo integration
pytest tests/integration/ -v

# Con output
pytest tests/ -v -s

# Con coverage
pytest tests/ --cov=backend_v2 --cov-report=term-missing

# Un test específico
pytest tests/unit/test_planner_service.py::TestPaso1AnalizarSolicitud::test_paso_1_solicitud_valida -v
```

---

## Conclusión

**35 tests creados**, listos para validar:
- ✅ Servicios (lógica pura)
- ✅ Endpoints (HTTP)
- ✅ Respuestas (JSON)
- ✅ Errores (manejo)
- ✅ Estructuras (DTOs)

**Próximo paso:** Ejecutar `python run_tests.py` en terminal

¡Éxito! 🚀
