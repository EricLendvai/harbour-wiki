@echo off
setlocal
cd /d "%~dp0.."

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 tools\website_verify_local_assets.py
  exit /b %errorlevel%
)

where python >nul 2>nul
if %errorlevel%==0 (
  python tools\website_verify_local_assets.py
  exit /b %errorlevel%
)

echo ERROR: Python 3 was not found. Install Python or add it to PATH.
exit /b 1
