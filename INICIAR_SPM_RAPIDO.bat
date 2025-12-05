@echo off
REM ============================================================================
REM SPM - Inicio Rapido (sin deploy)
REM ============================================================================
REM Solo inicia Backend + Tunnel
REM Usa este si ya hiciste deploy antes y solo necesitas reconectar
REM ============================================================================

title SPM - Inicio Rapido

cd /d "%~dp0"

powershell -ExecutionPolicy Bypass -File ".\scripts\Start-SPM-GithubPages.ps1" -SkipDeploy

pause
