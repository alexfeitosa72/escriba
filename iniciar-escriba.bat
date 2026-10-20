@echo off
setlocal
set "ESCRIBA_DIR=%~dp0"
netstat -an | findstr /C:"127.0.0.1:8765" | findstr /C:"LISTENING" >nul
if not errorlevel 1 (
  echo.
  echo A porta 8765 ja esta em uso: o agente Escriba provavelmente ja esta rodando.
  echo Feche a janela anterior do agente e execute este arquivo novamente.
  pause
  exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ESCRIBA_DIR%escriba-agent.ps1"
if errorlevel 1 (
  echo.
  echo O agente nao foi iniciado. Consulte README.md e SECURITY.md.
  pause
)
endlocal
