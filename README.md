# FitConnect MVP

FitConnect는 운동 코치 매칭, 식단 AI, 운동 종목별 의류 추천을 하나의 사용자 흐름으로 묶은 `food+health+clothes` MVP입니다. 저장소는 모바일 앱, 운영자 웹, FastAPI 코어 API, Node.js BFF, PostgreSQL, Redis, Ollama, Nginx를 한 번에 개발/시연/배포할 수 있도록 구성되어 있습니다.

기준일: 2026-06-04

## 현재 MVP 범위

- 사용자: 이메일 회원가입/로그인, 온보딩, 코치 탐색, 코치 상세, 예약 요청, 식단 챗, 식단 로그, 의류 추천, 프로필/로그아웃
- 코치/예약: 코치 목록, 추천 코치, 예약 생성, 예약 목록, 예약 상태 변경 API
- 식단 AI: 텍스트 상담, 이미지 업로드 분석 경로, 식단 로그 저장/조회
- 의류 추천: 운동 종목별 추천, 추천 클릭/구매 추적 API
- 운영 웹: 회원, 코치, 예약, 매출, 의류 추천 피드, 분석 차트
- 배포/증빙: Docker Compose, 릴리스 검증 스크립트, App Store 준비 문서, 저작권/기술자료 임치 준비 패키지

## 문서 지도

| 문서 | 용도 |
| --- | --- |
| [docs/service_plan_fitconnect.md](docs/service_plan_fitconnect.md) | 문제 정의, MVP 범위, 사용자 여정, BM, KPI |
| [docs/DEPLOYMENT_PRODUCT_PLAN.md](docs/DEPLOYMENT_PRODUCT_PLAN.md) | 제품/배포 계획, 아키텍처, 로드맵 |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Docker Compose 로컬 배포 절차 |
| [docs/QA_RELEASE_CHECKLIST.md](docs/QA_RELEASE_CHECKLIST.md) | 기능/보안/릴리스 체크리스트 |
| [docs/RELEASE_RUNBOOK.md](docs/RELEASE_RUNBOOK.md) | 스테이징/운영 릴리스 절차 |
| [docs/APP_STORE_READINESS.md](docs/APP_STORE_READINESS.md) | iOS/TestFlight/App Store 제출 준비 |
| [docs/IP_REGISTRATION_PACKAGE.md](docs/IP_REGISTRATION_PACKAGE.md) | 저작권 등록 및 기술자료 임치 준비 패키지 |
| [docs/design/README.md](docs/design/README.md) | UI/UX 토큰, 화면 목록, Stitch/Figma/Canva 핸드오프 |

## 빠른 시작

### 1. 환경 파일 준비

```powershell
Copy-Item .env.example .env -Force
```

로컬 MVP 시연은 기본값 그대로 실행할 수 있습니다. 이때 FastAPI는 `ENABLE_DEMO_FALLBACK=true`인 개발 모드에서 시연용 데이터를 제공합니다. 운영 배포에서는 반드시 실제 Supabase/PostgreSQL/Redis/API 도메인 값을 주입하고 `ENVIRONMENT=production`, `ENABLE_DEMO_FALLBACK=false`를 사용해야 합니다.

### 2. 전체 스택 실행

```powershell
.\deploy-local.ps1
docker compose ps
```

기본 접속 경로:

- 통합 게이트웨이/운영 웹: `http://localhost:8088/`
- FastAPI 문서: `http://localhost:8088/docs`
- FastAPI health: `http://localhost:8088/api/health/fastapi`
- Node BFF health: `http://localhost:8088/api/health/node`

### 3. 개별 개발 실행

```powershell
cd apps\web
npm install
npm run dev
```

```powershell
cd apps\mobile
npm install
npm run validate:env
npx expo start
```

모바일은 `apps/mobile/.env.example`을 기준으로 `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`을 실제 값으로 설정해야 합니다.

## 검증 명령

릴리스 전 로컬 검증:

```powershell
.\scripts\release\verify-local.ps1 -SkipInstall
```

실데이터 CSV dry-run:

```powershell
python scripts\data\import_real_data.py --dry-run
```

릴리스 패키지 생성:

```powershell
.\scripts\release\package-artifacts.ps1
```

저작권/기술자료 임치 증거 패키지 갱신:

```powershell
.\scripts\ip\Generate-IpEvidencePackage.ps1
```

## 지원금/중간평가 증빙 포인트

- 1단계: 아이템 구체화, BM, MVP 범위는 `docs/service_plan_fitconnect.md`와 `docs/DEPLOYMENT_PRODUCT_PLAN.md`로 설명
- 2단계: 시제품 제작은 Docker Compose 실행 화면, 모바일 화면, API 문서, 운영 웹 대시보드로 증빙
- 3단계: 사업화 성과는 사용자 테스트, 사업자등록, 지식재산권 출원/등록, 경진대회 제출, 시장검증 자료로 확장
- 지식재산권: `docs/IP_REGISTRATION_PACKAGE.md`와 `docs/legal/evidence/`의 해시/인벤토리로 제출 전 내부 증거 관리

## 운영 원칙

- 실제 비밀값은 커밋하지 않습니다.
- Supabase service role key는 서버에서만 사용합니다.
- 웹/모바일에는 Supabase anon key만 노출합니다.
- 운영 모드는 placeholder, localhost CORS, demo fallback을 허용하지 않습니다.
- 외부 제출 전 `docs/QA_RELEASE_CHECKLIST.md`와 `docs/legal/07_package_signoff_template.md`를 완료합니다.
