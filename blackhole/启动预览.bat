@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ==========================================
echo   Black Hole Accretion Disk - 3D Preview
echo   Open: http://localhost:8123/
echo   (Server runs in this window. Ctrl+C to stop)
echo ==========================================
echo.

where python >nul 2>nul
if %errorlevel%==0 goto :use_python

echo [python not found] falling back to npx http-server ...
npx --yes http-server -p 8123
goto :end

:use_python
python -m http.server 8123
goto :end

:end
echo.
echo Server stopped.
pause
