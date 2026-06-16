# FitConnect MVP 간단 실행 스크립트
Write-Host "🚀 FitConnect MVP 시작!" -ForegroundColor Green

# 현재 위치 확인
Write-Host "현재 위치: $(Get-Location)" -ForegroundColor Yellow

# FastAPI 확인
if (Test-Path "services\api-fastapi") {
    Write-Host "✅ FastAPI 폴더 존재" -ForegroundColor Green
} else {
    Write-Host "❌ FastAPI 폴더 없음" -ForegroundColor Red
}

# 모바일 앱 확인
if (Test-Path "apps\mobile") {
    Write-Host "✅ 모바일 앱 폴더 존재" -ForegroundColor Green
} else {
    Write-Host "❌ 모바일 앱 폴더 없음" -ForegroundColor Red
}

# 웹 앱 확인
if (Test-Path "apps\web") {
    Write-Host "✅ 웹 앱 폴더 존재" -ForegroundColor Green
} else {
    Write-Host "❌ 웹 앱 폴더 없음" -ForegroundColor Red
}

Write-Host ""
Write-Host "수동으로 실행하려면 각각의 PowerShell 창에서 아래 명령어를 실행하세요:" -ForegroundColor Yellow
Write-Host "1. FastAPI: cd services\api-fastapi; .\venv\Scripts\activate; uvicorn main:app --reload" -ForegroundColor White
Write-Host "2. Mobile: cd apps\mobile; npx expo start" -ForegroundColor White
Write-Host "3. Web: cd apps\web; npm run dev" -ForegroundColor White