# 로컬 Docker 배포 가이드

기준일: 2026-06-02

이 문서는 현재 `docker-compose.yml` 기준의 로컬 배포 절차입니다. Compose는 published port를 기본적으로 `127.0.0.1`에만 바인딩하고, 모델 다운로드와 pgAdmin은 profile로 분리되어 있습니다.

## 1. 첫 실행

```powershell
Copy-Item .env.example .env -Force
docker compose config --quiet
docker compose up -d --build
```

헬퍼 스크립트를 사용할 수도 있습니다.

```powershell
.\deploy-local.ps1
```

## 2. 기본 엔드포인트

| 서비스 | URL |
| --- | --- |
| Nginx gateway / web admin | `http://localhost:8088` |
| Web admin direct | `http://localhost:8081` |
| FastAPI docs through gateway | `http://localhost:8088/docs` |
| FastAPI direct | `http://localhost:8000` |
| Node BFF direct | `http://localhost:3000` |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| Ollama | `http://localhost:11434` |
| pgAdmin, optional | `http://localhost:8080` |

## 3. 선택 서비스

Ollama 모델 다운로드:

```powershell
docker compose --profile models up ollama-setup
```

헬퍼 스크립트:

```powershell
.\deploy-local.ps1 -WithModels
```

pgAdmin 실행:

```powershell
docker compose --profile admin up -d pgadmin
```

헬퍼 스크립트:

```powershell
.\deploy-local.ps1 -WithAdmin
```

## 4. 헬스체크

```powershell
docker compose ps
curl.exe http://localhost:8088/
curl.exe http://localhost:8081/health
curl.exe http://localhost:8088/health
curl.exe http://localhost:8088/api/health/fastapi
curl.exe http://localhost:8088/api/health/node
curl.exe http://localhost:8000/health
curl.exe http://localhost:3000/health
```

## 5. 로그와 종료

```powershell
docker compose logs -f api bff nginx
docker compose down
```

로컬 데이터 볼륨까지 삭제할 때:

```powershell
docker compose down -v
```

## 6. 운영 전환 메모

- `.env`의 placeholder를 실제 값으로 바꾸기 전에는 인증과 Supabase 연동 라우트를 신뢰하지 않는다.
- 루트 `.env`의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`는 웹 관리자 Docker 빌드에 주입된다. 값이 없으면 웹은 데모 데이터 모드로 실행된다.
- 운영 배포에서는 `.env` 파일 대신 CI/CD secret, Docker secret, 클라우드 secret manager를 사용한다.
- 운영 override는 로컬 Compose 파일과 분리한다.
- 서비스 Docker build context에 `venv`, `node_modules`, 서비스 `.env`가 들어가지 않도록 서비스별 `.dockerignore`를 추가한다.
- 운영 환경에서는 DB, Redis, Ollama를 외부에 직접 공개하지 않는다.
