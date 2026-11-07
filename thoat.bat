@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-old.ps1"
exit 0
