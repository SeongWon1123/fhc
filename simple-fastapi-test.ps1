# 가장 간단한 FastAPI 테스트 스크립트
Write-Host "🚀 가장 간단한 FastAPI 실행 테스트" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Yellow

# FastAPI 디렉토리로 이동
cd "C:\Users\user\Desktop\창업동아리\food+health+clothes\services\api-fastapi"
Write-Host "현재 위치: $(Get-Location)" -ForegroundColor Blue

# Python 설치 확인
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python 버전: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python이 설치되지 않았습니다" -ForegroundColor Red
    Write-Host "   https://python.org/downloads/ 에서 Python 설치해주세요" -ForegroundColor Yellow
    pause
    exit 1
}

# venv 존재 확인
if (Test-Path "venv") {
    Write-Host "✅ 가상 환경 존재" -ForegroundColor Green
} else {
    Write-Host "🆕 가상 환경 생성 중..." -ForegroundColor Yellow
    python -m venv venv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 가상 환경 생성 실패" -ForegroundColor Red
        pause
        exit 1
    }
    Write-Host "✅ 가상 환경 생성 완료" -ForegroundColor Green
}

# venv 활성화
Write-Host "🔄 가상 환경 활성화..." -ForegroundColor Yellow
try {
    .\venv\Scripts\Activate.ps1
    Write-Host "✅ 가상 환경 활성화 완료" -ForegroundColor Green
} catch {
    Write-Host "❌ 가상 환경 활성화 실패" -ForegroundColor Red
    pause
    exit 1
}

# pip 업데이트
Write-Host "⬆️  pip 업데이트..." -ForegroundColor Yellow
python -m pip install --upgrade pip

# 최소한의 패키지만 설치
Write-Host "📦 필수 패키지만 설치 중..." -ForegroundColor Yellow
pip install fastapi uvicorn python-dotenv

# requirements.txt가 있다면 추가 설치
if (Test-Path "requirements.txt") {
    Write-Host "📦 requirements.txt 설치 중..." -ForegroundColor Yellow
    pip install -r requirements.txt
}

# FastAPI 실행 테스트
Write-Host "🚀 FastAPI 실행 테스트 시작..." -ForegroundColor Green
Write-Host "   http://localhost:8000 에서 접속 가능" -ForegroundColor Cyan
Write-Host "   종료하려면 Ctrl+C 누르세요" -ForegroundColor Yellow

try {
    python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
} catch {
    Write-Host "❌ FastAPI 실행 실패" -ForegroundColor Red
    Write-Host "   오류 메시지: $_" -ForegroundColor Red
    pause
}