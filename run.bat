@echo off
title PharmAI Startup Controller
echo ========================================================
echo               PharmAI ML Bio-Platform
echo          Final Year Project Startup Controller
echo ========================================================
echo.

:: Detect if virtual environment exists
set USE_VENV=0
if exist "venv\Scripts\python.exe" (
    echo [INFO] Local virtual environment (venv) detected.
    set USE_VENV=1
)

:: Check for model cache folder
if not exist "backend\models\COVID-19_Mpro.joblib" (
    echo [INFO] ML models not found. Running training pipeline first...
    if %USE_VENV%==1 (
        venv\Scripts\python.exe backend\train_models.py
    ) else (
        python backend\train_models.py
    )
    if %errorlevel% neq 0 (
        echo [ERROR] Model training failed. Exiting.
        pause
        exit /b %errorlevel%
    )
) else (
    echo [INFO] Pre-trained models found. Skipping training.
)

echo.
echo [INFO] Starting FastAPI backend server on http://127.0.0.1:8000...
if %USE_VENV%==1 (
    start "PharmAI Backend Server" cmd /k "cd backend && ..\venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000"
) else (
    start "PharmAI Backend Server" cmd /k "cd backend && python -m uvicorn app:app --host 127.0.0.1 --port 8000"
)

echo [INFO] Starting local Web HTTP server for frontend on http://127.0.0.1:3000...
if %USE_VENV%==1 (
    start "PharmAI Web Frontend" cmd /k "venv\Scripts\python.exe -m http.server 3000 --directory frontend"
) else (
    start "PharmAI Web Frontend" cmd /k "python -m http.server 3000 --directory frontend"
)

echo.
echo [INFO] Launching browser interface...
timeout /t 2 >nul
explorer "http://127.0.0.1:3000"

echo ========================================================
echo PharmAI is running! Keep this window open or close it.
echo Backend logs are available in the spawned command window.
echo ========================================================
pause
