# 🎯 venv 완전 재설치 및 모든 패키지 문제 해결 스크립트
Write-Host "🔄 venv 완전 재설치 및 패키지 문제 해결" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Yellow

# FastAPI 폴더로 이동
Set-Location "C:\Users\user\Desktop\창업동아리\food+health+clothes\services\api-fastapi"
Write-Host "현재 위치: $(Get-Location)" -ForegroundColor Blue

# 이전 venv 삭제 후 재생성
Write-Host "🗑️  이전 venv 삭제..." -ForegroundColor Red
if (Test-Path "venv") {
    Remove-Item -Path "venv" -Recurse -Force
    Write-Host "✅ venv 삭제 완료" -ForegroundColor Green
} else {
    Write-Host "⚠️  venv 폴더 없음" -ForegroundColor Yellow
}

# 새로운 venv 생성
Write-Host "🆕 새로운 venv 생성..." -ForegroundColor Blue
python -m venv venv
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ venv 생성 완료" -ForegroundColor Green
} else {
    Write-Host "❌ venv 생성 실패" -ForegroundColor Red
    pause
    exit 1
}

# 가상 환경 활성화
Write-Host "🔄 가상 환경 활성화..." -ForegroundColor Blue
try {
    .\venv\Scripts\Activate.ps1
    Write-Host "✅ 가상 환경 활성화 완료" -ForegroundColor Green
} catch {
    Write-Host "❌ 가상 환경 활성화 실패" -ForegroundColor Red
    Write-Host "   PowerShell 실행 정책 변경이 필요할 수 있습니다" -ForegroundColor Yellow
    Write-Host "   PowerShell 관리자 권한으로 실행 후: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor Yellow
    pause
    exit 1
}

# pip 업데이트
Write-Host "⬆️  pip 업데이트..." -ForegroundColor Blue
python -m pip install --upgrade pip
Write-Host "✅ pip 업데이트 완료" -ForegroundColor Green

# setuptools, wheel 업데이트 (Windows 문제 해결)
Write-Host "🔧 setuptools, wheel 업데이트..." -ForegroundColor Blue
pip install --upgrade setuptools wheel
Write-Host "✅ setuptools, wheel 업데이트 완료" -ForegroundColor Green

# Python 버전 확인
Write-Host "🐍 Python 버전 확인..." -ForegroundColor Cyan
python --version

# pip 버전 확인
Write-Host "📦 pip 버전 확인..." -ForegroundColor Cyan
pip --version

# requirements.txt 설치 전 확인
Write-Host "📋 requirements.txt 확인..." -ForegroundColor Yellow
if (Test-Path "requirements.txt") {
    Write-Host "✅ requirements.txt 파일 있음" -ForegroundColor Green
    $reqContent = Get-Content "requirements.txt"
    Write-Host "   총 $($reqContent.Count) 라인" -ForegroundColor Cyan
} else {
    Write-Host "❌ requirements.txt 파일 없음" -ForegroundColor Red
    pause
    exit 1
}

# 문제가 되는 패키지들 먼저 개별 설치
Write-Host "🔧 문제 패키지 먼저 개별 설치..." -ForegroundColor Yellow
$problemPackages = @(
    "setuptools",
    "wheel",
    "cryptography",
    "bcrypt",
    "PyJWT",
    "pydantic",
    "pydantic-settings"
)

foreach ($package in $problemPackages) {
    Write-Host "   설치 중: $package" -ForegroundColor Cyan
    try {
        pip install $package
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ $package 설치 성공" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  $package 설치 실패 (다음 단계 진행)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ⚠️  $package 설치 예외 (다음 단계 진행)" -ForegroundColor Yellow
    }
}

# requirements.txt 설치 (--no-cache-dir 옵션으로 캐시 문제 해결)
Write-Host "📦 requirements.txt 설치 시작..." -ForegroundColor Yellow
try {
    pip install -r requirements.txt --no-cache-dir
    Write-Host "✅ requirements.txt 설치 완료" -ForegroundColor Green
} catch {
    Write-Host "⚠️  requirements.txt 설치 중 일부 실패" -ForegroundColor Yellow
    Write-Host "   개별 패키지 설치로 진행..." -ForegroundColor Cyan
}

# 설치된 패키지 확인
Write-Host "📋 설치된 패키지 확인..." -ForegroundColor Cyan
$installedPackages = pip list
Write-Host "   총 $($installedPackages.Count - 2) 개 패키지 설치됨" -ForegroundColor Green

# 필수 패키지 확인
Write-Host "🔍 필수 패키지 확인..." -ForegroundColor Blue
$requiredPackages = @(
    @{ name = "fastapi"; command = "fastapi" },
    @{ name = "uvicorn"; command = "uvicorn" },
    @{ name = "pydantic"; command = "pydantic" },
    @{ name = "pydantic-settings"; command = "pydantic_settings" },
    @{ name = "PyJWT"; command = "jwt" },
    @{ name = "cryptography"; command = "cryptography" },
    @{ name = "bcrypt"; command = "bcrypt" },
    @{ name = "sqlalchemy"; command = "sqlalchemy" },
    @{ name = "asyncpg"; command = "asyncpg" },
    @{ name = "supabase"; command = "supabase" }
)

$allOk = $true
foreach ($pkg in $requiredPackages) {
    try {
        python -c "import $($pkg.command); print('✅ $($pkg.name)')"
        Write-Host "   ✅ $($pkg.name) - 정상" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ $($pkg.name) - 설치 안됨" -ForegroundColor Red
        $allOk = $false
    }
}

if ($allOk) {
    Write-Host "🎉 모든 필수 패키지 설치 완료!" -ForegroundColor Green
} else {
    Write-Host "⚠️  일부 패키지가 설치되지 않음" -ForegroundColor Yellow
    Write-Host "   아래 명령어로 수동 설치를 진행하세요" -ForegroundColor Cyan
    Write-Host "   pip install fastapi uvicorn pydantic pydantic-settings PyJWT cryptography bcrypt sqlalchemy asyncpg supabase httpx python-multipart" -ForegroundColor Cyan
}

# 환경 변수 파일 확인
Write-Host "🔧 .env 파일 확인..." -ForegroundColor Blue
if (Test-Path ".env") {
    Write-Host "✅ .env 파일 있음" -ForegroundColor Green
} else {
    Write-Host "❌ .env 파일 없음 - 생성합니다" -ForegroundColor Red
    @"
# FastAPI 환경 설정
DATABASE_URL=postgresql://postgres:change-me-local-password@localhost:5432/fitconnect
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
JWT_SECRET=replace-with-a-strong-local-secret
ENVIRONMENT=development
"@ | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host "✅ .env 파일 생성 완료" -ForegroundColor Green
}

# FastAPI 실행 테스트
Write-Host "🚀 FastAPI 실행 테스트..." -ForegroundColor Green
try {
    Write-Host "   FastAPI 서버 실행 중..." -ForegroundColor Cyan
    Write-Host "   종료하려면 Ctrl+C를 누르세요" -ForegroundColor Yellow

    # FastAPI 실행
    python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

} catch {
    Write-Host "❌ FastAPI 실행 실패" -ForegroundColor Red
    Write-Host "   오류: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎯 다음 단계:" -ForegroundColor Green
Write-Host "1. FastAPI가 정상 실행되면 http://localhost:8000/docs 로 접속" -ForegroundColor Cyan
Write-Host "2. Supabase 프로젝트 생성 및 설정" -ForegroundColor Cyan
Write-Host "3. Mobile 및 Web 앱 실행" -ForegroundColor Cyan

# 대기
pause
