# FastAPI 패키지 자동 설치 스크립트
Write-Host "📦 FastAPI 패키지 자동 설치 스크립트" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Yellow

# FastAPI 폴더로 이동
cd "C:\Users\user\Desktop\창업동아리\food+health+clothes\services\api-fastapi"
Write-Host "현재 위치: $(Get-Location)" -ForegroundColor Blue

# 가상 환경 활성화
Write-Host "🔄 가상 환경 활성화..." -ForegroundColor Blue
try {
    .\venv\Scripts\Activate.ps1
    Write-Host "✅ 가상 환경 활성화 완료" -ForegroundColor Green
} catch {
    Write-Host "❌ 가상 환경 활성화 실패" -ForegroundColor Red
    Write-Host "   venv 폴더가 없을 수 있습니다. 가상 환경을 생성해주세요." -ForegroundColor Yellow
    pause
    exit 1
}

# pip 업데이트
Write-Host "⬆️  pip 업데이트..." -ForegroundColor Blue
python -m pip install --upgrade pip
Write-Host "✅ pip 업데이트 완료" -ForegroundColor Green

# requirements.txt 파일 확인
if (Test-Path "requirements.txt") {
    Write-Host "📦 requirements.txt 파일 확인" -ForegroundColor Green

    # requirements.txt 읽기
    $requirements = Get-Content "requirements.txt"
    Write-Host "📋 설치할 패키지 목록:" -ForegroundColor Cyan
    foreach ($line in $requirements) {
        if ($line -and -not $line.StartsWith("#")) {
            Write-Host "   $line" -ForegroundColor White
        }
    }

    # 패키지 설치
    Write-Host "🚀 패키지 설치 시작..." -ForegroundColor Yellow
    try {
        pip install -r requirements.txt
        Write-Host "✅ 모든 패키지 설치 완료" -ForegroundColor Green
    } catch {
        Write-Host "❌ 패키지 설치 중 오류 발생" -ForegroundColor Red
        Write-Host "   개별적으로 설치를 시도합니다..." -ForegroundColor Yellow

        # 기본 패키지 개별 설치
        $basicPackages = @(
            "fastapi==0.115.0",
            "uvicorn[standard]==0.30.6",
            "python-dotenv==1.0.1",
            "python-jose[cryptography]==3.3.0",
            "passlib[bcrypt]==1.7.4",
            "pydantic==2.9.2",
            "pydantic-settings==2.5.2",
            "httpx==0.27.2",
            "python-multipart==0.0.12"
        )

        foreach ($package in $basicPackages) {
            Write-Host "   설치 중: $package" -ForegroundColor Cyan
            pip install $package
        }
    }
} else {
    Write-Host "❌ requirements.txt 파일이 없습니다" -ForegroundColor Red
    pause
    exit 1
}

# 설치 확인
Write-Host "✅ 설치된 주요 패키지 확인:" -ForegroundColor Cyan
try {
    $fastapiVersion = python -c "import fastapi; print(fastapi.__version__)"
    Write-Host "   FastAPI: $fastapiVersion" -ForegroundColor Green
} catch {
    Write-Host "   FastAPI: 설치되지 않음" -ForegroundColor Red
}

try {
    $uvicornVersion = python -c "import uvicorn; print(uvicorn.__version__)"
    Write-Host "   Uvicorn: $uvicornVersion" -ForegroundColor Green
} catch {
    Write-Host "   Uvicorn: 설치되지 않음" -ForegroundColor Red
}

try {
    $joseVersion = python -c "import jose; print('jose installed')"
    Write-Host "   python-jose: 설치됨" -ForegroundColor Green
} catch {
    Write-Host "   python-jose: 설치되지 않음" -ForegroundColor Red
}

Write-Host ""
Write-Host "🚀 이제 FastAPI를 실행할 수 있습니다!" -ForegroundColor Green
Write-Host "   명령어: python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "   FastAPI 문서: http://localhost:8000/docs" -ForegroundColor Yellow

# 바로 실행 여부 확인
$answer = Read-Host "지금 바로 FastAPI를 실행하시겠습니까? (Y/N)"
if ($answer -eq 'Y' -or $answer -eq 'y') {
    Write-Host "🚀 FastAPI 실행 중..." -ForegroundColor Green
    python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
}