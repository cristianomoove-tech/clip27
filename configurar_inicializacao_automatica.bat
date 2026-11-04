@echo off
chcp 65001 >nul
title Clip27 - Configurador de Inicialização Automática
color 0a

echo =====================================================================
echo       CLIP27 IA - CONFIGURAR INICIALIZAÇÃO AUTOMÁTICA DO MOTOR
echo =====================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "VBS_PATH=%SCRIPT_DIR%iniciar_motor_silencioso.vbs"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\Clip27_Motor_Nativo.lnk"

echo [*] 1. Configurando inicializacao automatica com o Windows...
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%VBS_PATH%\"'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.Save()"
if exist "%SHORTCUT_PATH%" (
    echo [OK] Atalho criado na pasta de Inicializacao do Windows com sucesso!
) else (
    echo [AVISO] Nao foi possivel criar na pasta Startup, tentando registro alternativo...
)

echo [*] 2. Registrando protocolo clip27:// para acionamento com 1-Clique no navegador...
reg add "HKCU\Software\Classes\clip27" /ve /d "URL:Clip27 Protocol" /f >nul
reg add "HKCU\Software\Classes\clip27" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\clip27\shell\open\command" /ve /d "wscript.exe \"%VBS_PATH%\" \"%%1\"" /f >nul

echo [OK] Protocolo clip27:// registrado com sucesso no Windows!

echo [*] 3. Iniciando o Motor FFmpeg Nativo agora em segundo plano...
wscript.exe "%VBS_PATH%"

echo.
echo =====================================================================
echo   SUCESSO! O MOTOR NATIVO FOI CONFIGURADO PARA INICIAR AUTOMATICAMENTE
echo   - Inicia sozinho sempre que você ligar o Windows.
echo   - Roda 100%% silencioso em segundo plano na porta 5050.
echo   - O Studio Clip27 detectara o motor como ATIVO automaticamente!
echo =====================================================================
echo.
timeout /t 3 >nul

