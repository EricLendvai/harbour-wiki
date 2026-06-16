@echo off
setlocal
cd /d "%~dp0.."

call scripts\Vendor-Website-Assets.cmd
if errorlevel 1 exit /b 1

call scripts\Localize-Website-Assets.cmd
if errorlevel 1 exit /b 1

call scripts\Verify-Local-Website-Assets.cmd
if errorlevel 1 exit /b 1

echo Offline website assets are prepared.
exit /b 0
