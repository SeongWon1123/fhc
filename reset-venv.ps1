# venv 완전 재설정 스크립트
Write-Host "🔄 venv 완전 재설정 스크립트" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Yellow

# 현재 위치 확인
$currentDir = Get-Location
Write-Host "현재 위치: $currentDir" -ForegroundColor Blue

# FastAPI 폴더로 이동
$fastapiDir = "C:\Users\user\Desktop\창업동아리\food+health+clothes\services\api-fastapi"
Set-Location $fastapiDir
Write-Host "FastAPI 폴더로 이동: $(Get-Location)" -ForegroundColor Green

# Python 설치 확인
try {
    $pythonOutput = python --version 2>&1
    if ($pythonOutput -like "*Python*") {
        Write-Host "✅ Python 설치됨: $pythonOutput" -ForegroundColor Green
    } else {
        throw "Python not found"
    }
} catch {
    Write-Host "❌ Python이 설치되지 않았거나 PATH에 없습니다" -ForegroundColor Red
    Write-Host "   https://python.org/downloads/ 에서 Python 설치하세요" -ForegroundColor Yellow
    Write-Host "   설치 시 반드시 'Add Python to PATH' 체크하세요" -ForegroundColor Yellow
    pause
    exit 1
}

# 기존 venv 삭제
Write-Host "🗑️  기존 venv 삭제 중..." -ForegroundColor Yellow
if (Test-Path "venv") {
    try {
        Remove-Item -Recurse -Force "venv" -ErrorAction Stop
        Write-Host "✅ 기존 venv 삭제 완료" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  venv 삭제 실패 (권한 문제일 수 있음)" -ForegroundColor Yellow
        Write-Host "   수동으로 venv 폴더를 삭제해주세요" -ForegroundColor Red
    }
}

# 새로운 venv 생성
Write-Host "🆕 새로운 venv 생성 중..." -ForegroundColor Yellow
try {
    python -m venv venv
    Write-Host "✅ venv 생성 완료" -ForegroundColor Green
} catch {
    Write-Host "❌ venv 생성 실패" -ForegroundColor Red
    Write-Host "   Python이 제대로 설치되지 않았을 수 있습니다" -ForegroundColor Red
    pause
    exit 1
}

# venv 구조 확인
Write-Host "🔍 venv 구조 확인 중..." -ForegroundColor Blue
$venvPaths = @("Scripts", "Lib", "Include")
foreach ($path in $venvPaths) {
    if (Test-Path "venv\$path") {
        Write-Host "   ✅ venv\$path 존재" -ForegroundColor Green
    } else {
        Write-Host "   ❌ venv\$path 없음" -ForegroundColor Red
    }
}

# pip 업데이트
Write-Host "⬆️  pip 업데이트 중..." -ForegroundColor Blue
try {
    & .\venv\Scripts\python.exe -m pip install --upgrade pip
    Write-Host "✅ pip 업데이트 완료" -ForegroundColor Green
} catch {
    Write-Host "❌ pip 업데이트 실패" -ForegroundColor Red
}

# 기본 패키지 설치 테스트
Write-Host "📦 기본 패키지 설치 테스트 중..." -ForegroundColor Blue
try {
    & .\venv\Scripts\pip.exe install fastapi uvicorn
    Write-Host "✅ 기본 패키지 설치 완료" -ForegroundColor Green
} catch {
    Write-Host "❌ 기본 패키지 설치 실패" -ForegroundColor Red
}

# FastAPI 실행 테스트
Write-Host "🚀 FastAPI 실행 테스트 중..." -ForegroundColor Green
Write-Host "   아래 명령어로 FastAPI를 실행할 수 있습니다:" -ForegroundColor Cyan
Write-Host "   .\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000" -ForegroundColor White

Write-Host ""
Write-Host "✅ venv 재설정 완료!" -ForegroundColor Green
Write-Host "   이제 FastAPI를 실행할 수 있습니다." -ForegroundColor Green

# 바로 실행 여부
$answer = Read-Host "지금 바로 FastAPI를 실행하시겠습니까? (Y/N)"
if ($answer -eq 'Y' -or $answer -eq 'y') {
    Write-Host "🚀 FastAPI 실행 중..." -ForegroundColor Green
    & .\venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
}