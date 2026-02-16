@echo off
REM ============================================================================
REM SPM System 2.0 - Inicio Rapido (sin verificaciones)
REM ============================================================================
REM Inicia Backend + Frontend directamente sin chequeos previos
REM ============================================================================

title SPM System 2.0 - Rapido

REM Cambiar al directorio raiz del proyecto
cd /d "%~dp0\.."

echo [1/2] Iniciando Backend Flask...
start "SPM Backend" cmd /k "cd /d "%cd%" && python wsgi.py"

timeout /t 1 /nobreak >nul

echo [2/2] Iniciando Frontend Vite...
start "SPM Frontend" cmd /k "cd /d "%cd%\frontend" && npm run dev"

echo.
echo  Backend:  http://localhost:5000
echo  Frontend: http://localhost:5173
echo.
