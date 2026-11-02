# Supabase 연결 및 데이터베이스 상태 확인 스크립트
Write-Host "🔍 Supabase 연결 및 데이터베이스 상태 확인" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Yellow

# 현재 폴더 확인
Set-Location "C:\Users\user\Desktop\창업동아리\food+health+clothes\services\api-fastapi"
Write-Host "현재 위치: $(Get-Location)" -ForegroundColor Blue

# venv 활성화 확인
Write-Host "🔄 venv 활성화 상태 확인..." -ForegroundColor Blue
$venvPath = ".\venv\Scripts\Activate.ps1"
if (Test-Path $venvPath) {
    try {
        & $venvPath
        Write-Host "✅ venv 활성화 완료" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  venv 활성화 실패" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ venv 폴더 없음" -ForegroundColor Red
}

# .env 파일 내용 확인
Write-Host "📋 .env 파일 내용 확인..." -ForegroundColor Cyan
if (Test-Path ".env") {
    $envContent = Get-Content ".env"
    Write-Host "   .env 파일 내용:" -ForegroundColor Gray
    foreach ($line in $envContent) {
        if ($line -and -not $line.StartsWith("#")) {
            $key, $value = $line -split '=', 2
            if ($key -and $value) {
                if ($key -eq "SUPABASE_SERVICE_ROLE_KEY") {
                    $displayValue = $value.Substring(0, 30) + "..."
                } else {
                    $displayValue = $value
                }
                Write-Host "   $key = $displayValue" -ForegroundColor White
            }
        }
    }
} else {
    Write-Host "❌ .env 파일 없음" -ForegroundColor Red
}

# Python으로 Supabase 연결 테스트
Write-Host "🔗 Supabase 연결 테스트..." -ForegroundColor Green
$testCode = @"
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# .env 로드
load_dotenv()

# 환경 변수 확인
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
database_url = os.getenv('DATABASE_URL')

print(f'SUPABASE_URL: {supabase_url}')
print(f'DATABASE_URL: {database_url}')
print(f'SUPABASE_KEY: {supabase_key[:30]}...')

# 연결 테스트
try:
    # Supabase 클라이언트 생성
    supabase = create_client(supabase_url, supabase_key)

    # 간단한 쿼리 테스트
    result = supabase.table('users').select('count', count='exact').execute()

    print('✅ Supabase 연결 성공!')
    print(f'   Users 테이블 레코드 수: {result.count}')

    # 테이블 목록 확인
    tables = ['users', 'coaches', 'bookings', 'gyms', 'workout_routines', 'nutrition_logs', 'workout_logs', 'auth_tokens']

    print('   테이블 상태 확인:')
    for table in tables:
        try:
            result = supabase.table(table).select('count', count='exact').execute()
            status = '✅'
            count = result.count if result.count is not None else 0
        except Exception as e:
            status = '❌'
            count = str(e)[:50] + '...'

        print(f'   {status} {table}: {count}')

except Exception as e:
    print(f'❌ Supabase 연결 실패: {e}')
    print('   원인 분석:')
    if 'invalid' in str(e).lower() and 'url' in str(e).lower():
        print('   - SUPABASE_URL이 올바르지 않습니다')
    elif 'invalid' in str(e).lower() and 'key' in str(e).lower():
        print('   - SUPABASE_SERVICE_ROLE_KEY가 올바르지 않습니다')
    elif 'connection' in str(e).lower():
        print('   - 네트워크 연결 문제 또는 Supabase 프로젝트가 활성화되지 않았습니다')
    else:
        print('   - 기타 오류:', str(e))

print()
print('🎯 FastAPI 실행 테스트...')
try:
    from fastapi import FastAPI
    from app.config import settings
    print('✅ FastAPI 임포트 성공')
    print(f'   - SUPABASE_URL: {settings.supabase_url}')
    print(f'   - DATABASE_URL: {settings.database_url[:50]}...')
    print(f'   - ENVIRONMENT: {settings.environment}')
except Exception as e:
    print(f'❌ FastAPI 임포트 실패: {e}')
"@

# Python 테스트 실행
Write-Host "🐍 Python 테스트 실행..." -ForegroundColor Cyan
try {
    $output = python -c $testCode
    Write-Host $output
} catch {
    Write-Host "❌ Python 테스트 실행 실패: $_" -ForegroundColor Red
}

# FastAPI 실행 테스트
Write-Host "🚀 FastAPI 실행 테스트..." -ForegroundColor Green
$answer = Read-Host "FastAPI를 실행하시겠습니까? (Y/N)"
if ($answer -eq 'Y' -or $answer -eq 'y') {
    Write-Host "   FastAPI 실행 중..." -ForegroundColor Green
    Write-Host "   종료하려면 Ctrl+C를 누르세요" -ForegroundColor Yellow
    try {
        python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
    } catch {
        Write-Host "❌ FastAPI 실행 실패: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "📋 다음 단계:" -ForegroundColor Green
Write-Host "1. 위 테스트에서 모든 것이 '✅'로 표시되면 정상" -ForegroundColor Cyan
Write-Host "2. '❌'가 있다면 해당 문제를 해결해야 함" -ForegroundColor Cyan
Write-Host "3. FastAPI가 실행되면 브라우저에서 http://localhost:8000/docs 확인" -ForegroundColor Cyan

pause