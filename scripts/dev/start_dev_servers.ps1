# ============================================================================
# SPM Development Server Startup Script
# ============================================================================
# This script starts both the Flask backend and Vite frontend servers.
#
# IMPORTANT:
# - Backend will run on: http://localhost:5000 (Flask)
# - Frontend will run on: http://localhost:5173 (Vite)
# - Always access the app via: http://localhost:5173 (NOT 5000)
#
# Features:
# - Opens browser to correct URL automatically
# - Enables API proxy (port 5173 -> 5000)
# - Sets development environment
# ============================================================================

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "SPM Development Server Startup" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: package.json not found!" -ForegroundColor Red
    Write-Host "Please run this script from the SPM root directory" -ForegroundColor Red
    exit 1
}

# Check Python
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Write-Host "ERROR: Python not found in PATH" -ForegroundColor Red
    exit 1
}

# Check Node.js
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "ERROR: Node.js not found in PATH" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Python found: $(python --version)" -ForegroundColor Green
Write-Host "✓ Node.js found: $(node --version)" -ForegroundColor Green
Write-Host ""

# Set environment variables
$env:FLASK_APP = "wsgi.py"
$env:FLASK_ENV = "development"
$env:SPM_ENV = "development"
$env:SPM_DEBUG = "1"

Write-Host "Environment configured:" -ForegroundColor Cyan
Write-Host "  FLASK_ENV = development" -ForegroundColor White
Write-Host "  SPM_ENV = development" -ForegroundColor White
Write-Host "  SPM_DEBUG = 1" -ForegroundColor White
Write-Host ""

# Function to open browser
function Open-AppInBrowser {
    Start-Sleep -Seconds 3
    Write-Host "Opening browser to http://localhost:5173..." -ForegroundColor Yellow
    Start-Process "http://localhost:5173"
}

# Start backend in new terminal
Write-Host "Starting Flask backend (port 5000)..." -ForegroundColor Cyan
$backendJob = Start-Process powershell -ArgumentList "-Command", "cd '$pwd'; Write-Host 'Backend starting...' -ForegroundColor Cyan; python wsgi.py" -PassThru -NoNewWindow

# Wait for backend to start
Start-Sleep -Seconds 2

# Start frontend in new terminal
Write-Host "Starting Vite frontend (port 5173)..." -ForegroundColor Cyan
$frontendJob = Start-Process powershell -ArgumentList "-Command", "cd '$pwd'; Write-Host 'Frontend starting...' -ForegroundColor Cyan; npm run dev" -PassThru -NoNewWindow

# Open browser
Open-AppInBrowser

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "✓ SERVERS STARTED SUCCESSFULLY" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "📍 IMPORTANT ACCESS POINTS:" -ForegroundColor Yellow
Write-Host "   Frontend:  http://localhost:5173" -ForegroundColor White
Write-Host "   Backend:   http://localhost:5000" -ForegroundColor White
Write-Host "   API:       http://localhost:5000/api" -ForegroundColor White
Write-Host ""
Write-Host "🔗 USE THE FRONTEND URL: http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "To stop the servers, close both terminal windows or press Ctrl+C in this window." -ForegroundColor Yellow
Write-Host ""

# Wait for user to stop
Read-Host "Press Enter to stop all servers"

# Kill the jobs
if ($backendJob) { Stop-Process -Id $backendJob.Id -Force -ErrorAction SilentlyContinue }
if ($frontendJob) { Stop-Process -Id $frontendJob.Id -Force -ErrorAction SilentlyContinue }

Write-Host "Servers stopped." -ForegroundColor Cyan
