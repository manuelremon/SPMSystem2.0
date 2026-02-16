@echo off
REM ============================================================================
REM SPM System 2.0 - Iniciar Backend + Frontend
REM ============================================================================
REM Doble click para iniciar:
REM   - Backend Flask (http://localhost:5000)
REM   - Frontend Vite  (http://localhost:5173)
REM ============================================================================

title SPM System 2.0

REM Cambiar al directorio raiz del proyecto
cd /d "%~dp0\.."

REM Verificar que Python existe
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python no encontrado. Instala Python 3.10+
    pause
    exit /b 1
)

REM Verificar que Node existe
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no encontrado. Instala Node.js 18+
    pause
    exit /b 1
)

echo ============================================
echo  SPM System 2.0 - Iniciando servicios...
echo ============================================

REM Iniciar Backend Flask en nueva ventana
echo [1/2] Iniciando Backend Flask...
start "SPM Backend" cmd /k "cd /d "%cd%" && python wsgi.py"

REM Esperar 2 segundos para que el backend arranque
timeout /t 2 /nobreak >nul

REM Iniciar Frontend Vite en nueva ventana
echo [2/2] Iniciando Frontend Vite...
start "SPM Frontend" cmd /k "cd /d "%cd%\frontend" && npm run dev"

echo.
echo ============================================
echo  Backend:  http://localhost:5000
echo  Frontend: http://localhost:5173
echo ============================================
echo.
echo Presiona cualquier tecla para cerrar esta ventana.
echo Los servicios seguiran corriendo en sus ventanas.
pause >nul
