#!/bin/bash
# 🧪 TESTING SCRIPT PARA PLANIFICACIÓN

echo "🔍 VALIDACIÓN RÁPIDA DEL MÓDULO PLANIFICACIÓN"
echo "=============================================="
echo ""

# 1. Verificar que home.html está presente
echo "✓ Verificando home.html..."
if grep -q 'id="page-planner"' src/frontend/home.html; then
    echo "  ✅ page-planner section encontrada"
else
    echo "  ❌ page-planner section NO encontrada"
fi

# 2. Verificar que nav item existe
echo ""
echo "✓ Verificando navegación..."
if grep -q 'data-page="planner"' src/frontend/home.html; then
    echo "  ✅ Nav item con data-page='planner' encontrada"
else
    echo "  ❌ Nav item NO encontrada"
fi

# 3. Verificar IDs de elementos
echo ""
echo "✓ Verificando IDs de elementos HTML..."
for ID in "statPending" "statInProcess" "statOptimized" "statCompleted" "solicitudesTable" "detailPanel" "detailMateriales" "btnRefresh" "btnCloseDetail" "btnOptimize"; do
    if grep -q "id=\"$ID\"" src/frontend/home.html; then
        echo "  ✅ id='$ID' encontrada"
    else
        echo "  ❌ id='$ID' NO encontrada"
    fi
done

# 4. Verificar funciones JavaScript
echo ""
echo "✓ Verificando funciones JavaScript..."
for FUNC in "initPlannerPage" "checkPlannerAccess" "loadPlannerSolicitudes" "renderPlannerSolicitudes" "showPlannerDetail" "updatePlannerStats"; do
    if grep -q "function $FUNC\|async function $FUNC" src/frontend/home.html; then
        echo "  ✅ function '$FUNC' encontrada"
    else
        echo "  ❌ function '$FUNC' NO encontrada"
    fi
done

# 5. Verificar que backend tiene rutas
echo ""
echo "✓ Verificando rutas del backend..."
if [ -f "src/backend/routes/planner_routes.py" ]; then
    echo "  ✅ planner_routes.py existe"
    if grep -q "@app.route.*planner.*dashboard" src/backend/routes/planner_routes.py; then
        echo "  ✅ Route /api/planner/dashboard encontrada"
    fi
    if grep -q "@app.route.*planner.*solicitudes" src/backend/routes/planner_routes.py; then
        echo "  ✅ Route /api/planner/solicitudes encontrada"
    fi
else
    echo "  ❌ planner_routes.py NO existe"
fi

# 6. Resumen
echo ""
echo "=============================================="
echo "✅ VALIDACIÓN COMPLETADA"
echo ""
echo "Estado: LISTO PARA TESTING MANUAL"
echo ""
echo "Próximos pasos:"
echo "1. Abrir http://localhost:5000/home.html"
echo "2. Iniciar sesión con usuario 'Planificador'"
echo "3. Hacer click en '🗂️ Planificación' del menú"
echo "4. Verificar que:"
echo "   - Página carga sin cambiar de URL"
echo "   - Menú lateral permanece visible"
echo "   - Estadísticas muestran números"
echo "   - Tabla se completa con datos"
echo "5. Hacer click en 'Ver' para expandir detalles"
echo ""
