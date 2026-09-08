@echo off
title Servidor de Reconhecimento Facial - Merenda
echo ===================================================================
echo   Verificando Ambiente de Reconhecimento Facial na Porta 8000
echo ===================================================================
cd /d "%~dp0backend"

:: 1. Detecta o comando Python do sistema
where py >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "PYTHON_CMD=py"
) else (
    where python >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        set "PYTHON_CMD=python"
    ) else (
        echo [ERRO] Python nao foi encontrado neste computador!
        echo Por favor, instale o Python 3.9 a 3.11 marcando Add Python to PATH.
        pause
        exit /b 1
    )
)

:: 2. Cria o ambiente virtual venv se ainda nao existir
if not exist "venv\Scripts\python.exe" (
    echo [1/3] Criando ambiente virtual em backend\venv
    %PYTHON_CMD% -m venv venv
    if %ERRORLEVEL% neq 0 (
        echo [ERRO] Falha ao criar o ambiente virtual venv.
        pause
        exit /b 1
    )
    echo [2/3] Instalando dependencias de IA (aguarde)
    venv\Scripts\python.exe -m pip install -r requirements.txt
)

:: 3. Garante que o modelo buffalo_s esteja baixado na maquina
if not exist "%USERPROFILE%\.insightface\models\buffalo_s" (
    echo [3/3] Baixando modelo de reconhecimento facial (buffalo_s)
    venv\Scripts\python.exe download_model.py
)

:: 4. Inicia a API FastAPI
echo ===================================================================
echo   Servidor de Reconhecimento Facial Ativo!
echo   Rodando em: http://127.0.0.1:8000
echo   Deixe esta janela aberta enquanto utiliza o sistema.
echo ===================================================================
venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
pause
