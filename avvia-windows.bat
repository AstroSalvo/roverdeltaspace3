@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRORE] Node.js non trovato. Scaricalo da https://nodejs.org/ e riprova.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Prima esecuzione: installo le dipendenze, puo' richiedere qualche minuto...
  call npm install
  if errorlevel 1 (
    echo [ERRORE] npm install fallito.
    pause
    exit /b 1
  )
)

if not exist "dev-launcher.mjs" (
  echo [ERRORE] Manca il file dev-launcher.mjs nella cartella del progetto.
  pause
  exit /b 1
)

echo Avvio RoverDeltaSpace3 su http://localhost:8080 ...
start "" http://localhost:8080
node dev-launcher.mjs

pause
