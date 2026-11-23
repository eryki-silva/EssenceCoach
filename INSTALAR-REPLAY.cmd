@echo off
cd /d "%~dp0"
title Dota Coach - Instalar leitor de replay
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-replay.ps1"
if errorlevel 1 echo Nao foi possivel concluir a instalacao. Confira a mensagem acima.
pause
