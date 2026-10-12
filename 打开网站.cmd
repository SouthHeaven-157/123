@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0启动预览.ps1"
if errorlevel 1 pause
