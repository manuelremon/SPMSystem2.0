@echo off
REM ============================================================================
REM SPM - Iniciador para GitHub Pages
REM ============================================================================
REM Doble click para iniciar:
REM   - Backend Flask
REM   - Cloudflare Tunnel
REM   - Deploy a GitHub Pages
REM ============================================================================

title SPM - Iniciando...

REM Cambiar al directorio del script
cd /d "%~dp0"

REM Ejecutar PowerShell script con bypass de politica
powershell -ExecutionPolicy Bypass -File ".\scripts\Start-SPM-GithubPages.ps1"

pause
