# FastAPI 오류 해결 스크립트
Write-Host "🔧 FastAPI 'fatal error in launcher' 해결 스크립트" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Yellow

# 현재 디렉토리 확인
$currentDir = Get-Location
Write-Host "현재 위치: $currentDir" -ForegroundColor Blue

# FastAPI 디렉토리로 이동
$fastapiDir = "C:\Users\user\Desktop\창업동아리\food+health+clothes\services\api-fastapi"
if (-not (Test-Path $fastapiDir)) {
    Write-Host "❌ FastAPI 디렉토리가 존재하지 않습니다: $fastapiDir" -ForegroundColor Red
    exit 1
}

Set-Location $fastapiDir
Write-Host "FastAPI 디렉토리로 이동: $(Get-Location)" -ForegroundColor Green

# Python 버전 확인
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python 버전: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python이 설치되어 있지 않거나 PATH에 없습니다." -ForegroundColor Red
    Write-Host "   Python을 설치하고 PATH에 추가해주세요." -ForegroundColor Yellow
    exit 1
}

# 기존 가상 환경 삭제
if (Test-Path "venv") {
    Write-Host "🗑️  기존 가상 환경 삭제 중..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "venv" -ErrorAction SilentlyContinue
    Write-Host "✅ 기존 가상 환경 삭제 완료" -ForegroundColor Green
}

# 새 가상 환경 생성
Write-Host "🆕 새 가상 환경 생성 중..." -ForegroundColor Yellow
try {
    python -m venv venv
    Write-Host "✅ 가상 환경 생성 완료" -ForegroundColor Green
} catch {
    Write-Host "❌ 가상 환경 생성 실패" -ForegroundColor Red
    exit 1
}

# 가상 환경 활성화
Write-Host "🔄 가상 환경 활성화 중..." -ForegroundColor Yellow
try {
    .\venv\Scripts\Activate.ps1
    Write-Host "✅ 가상 환경 활성화 완료" -ForegroundColor Green
} catch {
    Write-Host "❌ 가상 환경 활성화 실패" -ForegroundColor Red
    exit 1
}

# pip 업데이트
Write-Host "⬆️  pip 업데이트 중..." -ForegroundColor Yellow
try {
    python -m pip install --upgrade pip
    Write-Host "✅ pip 업데이트 완료" -ForegroundColor Green
} catch {
    Write-Host "⚠️  pip 업데이트 실패 (무시하고 진행)" -ForegroundColor Yellow
}

# 패키지 설치
Write-Host "📦 패키지 설치 중..." -ForegroundColor Yellow
if (Test-Path "requirements.txt") {
    try {
        pip install -r requirements.txt
        Write-Host "✅ 패키지 설치 완료" -ForegroundColor Green
    } catch {
        Write-Host "❌ 패키지 설치 실패" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ requirements.txt 파일이 없습니다" -ForegroundColor Red
    exit 1
}

# FastAPI 실행 테스트
Write-Host "🚀 FastAPI 실행 테스트 중..." -ForegroundColor Yellow
Write-Host "   아래 명령어로 FastAPI를 실행해보세요:" -ForegroundColor Cyan
Write-Host "   uvicorn main:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor White

Write-Host ""
Write-Host "✅ 모든 설정이 완료되었습니다!" -ForegroundColor Green
Write-Host "   이제 FastAPI를 실행할 수 있습니다." -ForegroundColor Green