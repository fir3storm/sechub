@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "MARKER=.sechub-ready"
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

title SecHub Launcher

if /i "%~1"=="setup" (
  if exist "%MARKER%" del /f /q "%MARKER%"
  echo Forcing first-time setup on next step...
  echo.
)

echo.
echo  SecHub
echo  ======
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not installed. Install Node.js 20+ from https://nodejs.org
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm is not available in PATH.
  pause
  exit /b 1
)

if exist "%MARKER%" if exist "node_modules\" (
  echo Environment ready ^(marker: %MARKER%^). Starting services...
  echo.
  goto :RUN
)

echo First-time setup ^(or environment not ready yet^)...
echo.

call :SETUP
if errorlevel 1 (
  echo.
  echo [ERROR] Setup failed. Fix the issue above and run start.bat again.
  echo        To retry setup: start.bat setup
  pause
  exit /b 1
)

echo.
echo Setup complete. Marker saved to %MARKER%
echo.

:RUN
echo [run] Ensuring super admin account ...
call npm run db:ensure-admin
if errorlevel 1 (
  echo [WARN] Could not verify admin account. Is PostgreSQL running?
  echo.
)

call :START_SERVICES
echo.
echo  SecHub is running:
echo    Web     http://localhost:3001
echo    Worker  scheduled feed refresh
echo.
echo  Login: admin@sechub.local / admin123
echo.
echo  Close the "SecHub - Web" and "SecHub - Worker" windows to stop.
echo.
pause
exit /b 0

:SETUP
echo [setup] Checking .env ...
if not exist ".env" (
  if exist ".env.example" (
    copy /y ".env.example" ".env" >nul
    echo         Created .env from .env.example
  ) else (
    echo [ERROR] .env missing and no .env.example found.
    exit /b 1
  )
) else (
  echo         .env OK
)

echo [setup] Installing npm packages ...
call npm install
if errorlevel 1 exit /b 1

echo [setup] Generating Prisma client ...
call npm run db:generate
if errorlevel 1 exit /b 1

echo [setup] Applying database schema ...
echo         ^(PostgreSQL must be running — see .env DATABASE_URL^)
call npm run db:push
if errorlevel 1 exit /b 1

echo [setup] Seeding database ...
call npm run db:seed
if errorlevel 1 exit /b 1

echo [setup] Enabling full-text search ...
call npm run db:fts
if errorlevel 1 exit /b 1

echo installed=%DATE% %TIME%> "%MARKER%"
for /f "delims=" %%v in ('node -v 2^>nul') do echo node=%%v>> "%MARKER%"
echo root=%ROOT%>> "%MARKER%"

exit /b 0

:START_SERVICES
echo [run] Starting Next.js on port 3001 ...
start "SecHub - Web" cmd /k "cd /d "%ROOT%" && npm run dev"

timeout /t 2 /nobreak >nul

echo [run] Starting ingest worker ...
start "SecHub - Worker" cmd /k "cd /d "%ROOT%" && npm run worker"

exit /b 0
