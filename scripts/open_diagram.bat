@echo off
REM Script para abrir el diagrama de arquitectura SPMv3.0
REM Uso: scripts/open_diagram.bat

setlocal enabledelayedexpansion
cd /d "%~dp0\.."

REM Obtener la ruta del diagrama
set DIAGRAM_PATH=%cd%\docs\diagrams\SPMv3.0_Architecture.drawio

REM Verificar que el archivo existe
if not exist "%DIAGRAM_PATH%" (
    echo Error: Archivo no encontrado: %DIAGRAM_PATH%
    pause
    exit /b 1
)

echo.
echo ======================================
echo SPMv3.0 - Architecture Diagram Opener
echo ======================================
echo.
echo Opciones:
echo.
echo 1 - Abrir en navegador (draw.io online)
echo 2 - Mostrar ruta del archivo
echo 3 - Salir
echo.

set /p choice="Selecciona una opcion (1-3): "

if "%choice%"=="1" (
    echo.
    echo Abriendo draw.io online...
    start https://app.diagrams.net
    echo.
    echo Una vez en draw.io:
    echo   1. Click en File ^> Open
    echo   2. Selecciona "%DIAGRAM_PATH%"
    echo   3. O arrastra el archivo al navegador
    echo.
    pause
) else if "%choice%"=="2" (
    echo.
    echo Ruta del archivo:
    echo %DIAGRAM_PATH%
    echo.
    echo Puedes:
    echo   - Arrastrar el archivo a draw.io
    echo   - Abrirlo con VS Code (extensión Draw.io)
    echo   - Abrirlo con draw.io Desktop
    echo.
    pause
) else if "%choice%"=="3" (
    exit /b 0
) else (
    echo Opcion invalida
    pause
    exit /b 1
)
