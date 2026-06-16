# FastAPI 전체 패키지 재설치 스크립트
Write-Host "🔄 FastAPI 전체 패키지 재설치 스크립트" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Yellow

# FastAPI 폴더로 이동
Set-Location "C:\Users\user\Desktop\창업동아리\food+health+clothes\services\api-fastapi"
Write-Host "현재 위치: $(Get-Location)" -ForegroundColor Blue

# 가상 환경 활성화 확인
Write-Host "🔄 가상 환경 활성화..." -ForegroundColor Blue
try {
    .\venv\Scripts\Activate.ps1
    Write-Host "✅ 가상 환경 활성화 완료" -ForegroundColor Green
} catch {
    Write-Host "❌ 가상 환경 활성화 실패" -ForegroundColor Red
    pause
    exit 1
}

# 현재 설치된 패키지 확인
Write-Host "📋 현재 설치된 패키지 확인..." -ForegroundColor Yellow
$installedPackages = pip list
Write-Host "   설치된 패키지 수: $($installedPackages.Count - 2)" -ForegroundColor Cyan

# pip 업데이트
Write-Host "⬆️  pip 업데이트..." -ForegroundColor Blue
python -m pip install --upgrade pip

# 문제가 되는 패키지들 먼저 설치
Write-Host "🔧 문제 패키지 먼저 설치..." -ForegroundColor Yellow
$problemPackages = @(
    "pydantic==2.9.2",
    "pydantic-settings==2.5.2",
    "python-jose[cryptography]==3.3.0",
    "passlib[bcrypt]==1.7.4"
)

foreach ($package in $problemPackages) {
    Write-Host "   설치 중: $package" -ForegroundColor Cyan
    pip install $package
}

# requirements.txt 설치
Write-Host "📦 requirements.txt 전체 설치..." -ForegroundColor Yellow
if (Test-Path "requirements.txt") {
    try {
        pip install -r requirements.txt
        Write-Host "✅ requirements.txt 설치 완료" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  일부 패키지 설치 실패" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ requirements.txt 파일 없음" -ForegroundColor Red
}

# pydantic-settings 재설치 (문제가 있는 경우)
Write-Host "🔍 pydantic-settings 재설치..." -ForegroundColor Blue
try {
    python -c "import pydantic_settings; print('pydantic_settings installed')"
    Write-Host "✅ pydantic_settings 정상 설치됨" -ForegroundColor Green
} catch {
    Write-Host "❌ pydantic_settings 설치 안됨 - 재설치" -ForegroundColor Red
    pip install pydantic-settings==2.5.2
}

# FastAPI 실행 테스트
Write-Host "🚀 FastAPI 실행 테스트..." -ForegroundColor Green
try {
    python -c "import fastapi, uvicorn, pydantic_settings, python_jose; print('모든 패키지 정상')"
    Write-Host "✅ 모든 필수 패키지 설치 완료" -ForegroundColor Green
} catch {
    Write-Host "❌ 일부 패키지 설치 안됨" -ForegroundColor Red
    $error = $_
    Write-Host "   오류: $error" -ForegroundColor Red
}

Write-Host ""
Write-Host "🚀 이제 FastAPI를 실행할 수 있습니다!" -ForegroundColor Green
Write-Host "   명령어: python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor Cyan

# 바로 실행
$answer = Read-Host "지금 바로 FastAPI를 실행하시겠습니까? (Y/N)"
if ($answer -eq 'Y' -or $answer -eq 'y') {
    Write-Host "🚀 FastAPI 실행 중..." -ForegroundColor Green
    python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
}