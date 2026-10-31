@echo off
title Clip27 - Motor FFmpeg Combinatorio Nativo
color 0b

echo =====================================================================
echo           CLIP27 IA - MOTOR COMBINATORIO FFMPEG NATIVO
echo =====================================================================
echo.
echo [*] Verificando ambiente Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Python nao foi encontrado no PATH do Windows!
    echo Instale o Python 3.10+ e marque a opcao "Add Python to PATH".
    pause
    exit /b 1
)

echo [*] Verificando instalacao do FFmpeg...
ffmpeg -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [AVISO] FFmpeg nao encontrado no PATH do Windows!
    echo Certifique-se de que o ffmpeg.exe esta no PATH ou na pasta do projeto.
)

echo [*] Iniciando API do Servidor FFmpeg na porta 5050...
echo Acesse o Studio Clip27 no navegador: o motor sera detectado automaticamente!
echo Pressione Ctrl+C para encerrar o servidor.
echo.

python server_ffmpeg.py

pause

