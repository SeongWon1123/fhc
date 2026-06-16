# FitConnect MVP 제품 및 배포 계획

기준일: 2026-06-02
대상 저장소: `food+health+clothes`

## 1. 제품 목표

FitConnect MVP의 목표는 운동 사용자와 검증된 코치를 연결하고, 식단 AI와 운동 종목별 의류 추천을 붙여 반복 사용 이유를 만드는 것입니다. 첫 릴리스는 모든 기능을 완성형으로 넓히기보다, 아래 세 가지 질문을 검증하는 데 집중합니다.

1. 사용자가 AI 식단/운동 보조 기능을 통해 앱을 반복 방문하는가.
2. 코치 매칭과 예약 흐름이 실제 상담 또는 PT 전환으로 이어지는가.
3. 운동 종목별 의류 추천이 부가 매출 또는 제휴 검증 지표를 만드는가.

## 2. MVP 범위

### 포함

| 영역 | MVP 산출물 | 완료 기준 |
| --- | --- | --- |
| 인증/프로필 | Supabase 기반 가입, 로그인, 역할 구분 | 사용자, 코치, 관리자 역할로 주요 화면 접근 가능 |
| 코치 매칭 | 코치 목록, 필터, 상세, AI 매칭 API | 사용자가 코치를 탐색하고 추천 결과를 확인 |
| 예약 | 예약 생성, 내 예약 조회, 예약 상태 변경 | 중복 시간 방지와 상태 변경 검증 |
| 식단 AI | 텍스트 챗, 이미지 분석, 식단 로그 | 대화 저장, 이미지 크기 제한, 로그 조회 가능 |
| 의류 추천 | 운동 종목별 추천, 클릭 추적 | 추천 결과와 클릭 이벤트 저장 |
| 운영 웹 | 회원, 코치, 예약, 분석 대시보드 | 운영자가 MVP 상태를 빠르게 확인 |
| 배포 | Docker Compose 기반 로컬/개발/운영 배포 절차 | 새 환경에서 문서만 보고 실행 가능 |

### 제외 또는 다음 단계

- 실결제와 정산 자동화는 MVP 후반 또는 베타 이후로 분리한다.
- 온디바이스 자세 추정, 웨어러블 연동, 커뮤니티 기능은 Phase 2 이후로 둔다.
- 완전 자동 의료/영양 진단 표현은 금지한다. 답변은 참고 정보와 코치 상담 보조로 제한한다.
- 대규모 추천 모델 학습은 베타 데이터 확보 이후 진행한다.

## 3. 시스템 아키텍처

```mermaid
flowchart LR
  Mobile["Expo Mobile App"] --> Nginx["Nginx Reverse Proxy"]
  Web["React Vite Admin"] --> Nginx
  Nginx --> FastAPI["FastAPI Core API"]
  Nginx --> BFF["Node.js BFF and Socket.IO"]
  BFF --> FastAPI
  FastAPI --> Supabase["Supabase/PostgreSQL"]
  BFF --> Supabase
  FastAPI --> Redis["Redis Cache"]
  BFF --> Redis
  FastAPI --> Ollama["Ollama Local LLM"]
  Supabase --> Pgvector["pgvector RAG Documents"]
```

### 컴포넌트 책임

| 컴포넌트 | 책임 | 주요 파일 |
| --- | --- | --- |
| Expo Mobile | 사용자 온보딩, 홈, 코치 탐색, 예약, 식단, 의류 추천 화면 | `apps/mobile` |
| React/Vite Web | 운영자 대시보드, 회원/코치/예약/분석 관리 | `apps/web` |
| FastAPI Core | 코치, 예약, 식단 AI, 이미지 분석, 의류 추천 API | `services/api-fastapi` |
| Node.js BFF | 카카오/일반 인증, 알림, Socket.IO 실시간 이벤트 | `services/api-node` |
| Supabase/PostgreSQL | 인증 연동, 프로필, 코치, 예약, 식단, 알림, RAG 문서 | `infra/supabase/init.sql` |
| Redis | 캐시와 실시간 이벤트 보조 | `docker-compose.yml` |
| Ollama | 로컬 LLM, 임베딩, 비전 모델 실행 | `docker-compose.yml` |
| Nginx | 외부 라우팅, rate limit, WebSocket 프록시, 헬스체크 | `nginx/nginx.conf` |

### 주요 API 표면

| 서비스 | 엔드포인트 | 목적 |
| --- | --- | --- |
| FastAPI | `GET /health` | 코어 API 헬스체크 |
| FastAPI | `GET /api/v1/coaches` | 코치 목록 조회 |
| FastAPI | `GET /api/v1/coaches/matched` | 로그인 사용자 기준 AI 매칭 |
| FastAPI | `POST /api/v1/bookings` | 예약 생성 |
| FastAPI | `GET /api/v1/bookings/my` | 내 예약 조회 |
| FastAPI | `PATCH /api/v1/bookings/{booking_id}/status` | 예약 상태 변경 |
| FastAPI | `POST /api/v1/diet/chat` | 식단 챗봇 |
| FastAPI | `POST /api/v1/diet/analyze-image` | 음식 이미지 분석 |
| FastAPI | `POST /api/v1/diet/logs`, `GET /api/v1/diet/logs` | 식단 로그 저장/조회 |
| FastAPI | `GET /api/v1/clothing/recommendations` | 운동 종목별 의류 추천 |
| FastAPI | `POST /api/v1/clothing/click/{recommendation_id}` | 추천 클릭 추적 |
| BFF | `GET /health` | BFF 헬스체크 |
| BFF | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/kakao` | 인증 |
| BFF | `GET /api/notifications`, `PATCH /api/notifications/{id}/read` | 알림 |
| BFF | `POST /api/realtime/trigger-update` | 실시간 이벤트 트리거 |

## 4. 환경 변수

### Docker Compose 로컬 변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `COMPOSE_PROJECT_NAME` | `fitconnect` | Docker Compose 프로젝트 이름 |
| `BIND_ADDR` | `127.0.0.1` | 로컬 published port 바인딩 주소 |
| `NGINX_PORT` | `8088` | Nginx gateway 포트 |
| `WEB_PORT` | `8081` | 웹 관리자 direct 포트 |
| `API_PORT` | `8000` | FastAPI direct 포트 |
| `BFF_PORT` | `3000` | Node BFF direct 포트 |
| `POSTGRES_PORT` | `5432` | PostgreSQL local 포트 |
| `REDIS_PORT` | `6379` | Redis local 포트 |
| `OLLAMA_PORT` | `11434` | Ollama local 포트 |
| `PGADMIN_PORT` | `8080` | admin profile에서 pgAdmin 포트 |
| `POSTGRES_USER` | `postgres` | 로컬 DB 사용자 |
| `POSTGRES_PASSWORD` | `change-me-local-password` | 로컬 DB 비밀번호 |
| `POSTGRES_DB` | `fitconnect` | 로컬 DB 이름 |

Compose의 FastAPI 서비스는 `POSTGRES_*` 값으로 내부 `DATABASE_URL`을 생성합니다. FastAPI를 Docker 밖에서 단독 실행할 때는 `DATABASE_URL`을 별도로 둘 수 있습니다.

### 서버 공통

| 변수 | 사용처 | 필수 | 예시 | 주의 |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | FastAPI 단독 실행 | 조건부 | `postgresql://postgres:password@localhost:5432/fitconnect` | Compose에서는 `POSTGRES_*`로 자동 생성 |
| `REDIS_URL` | FastAPI, BFF | 예 | `redis://redis:6379/0` | 운영 Redis는 인증/네트워크 제한 필요 |
| `SUPABASE_URL` | FastAPI, BFF | 예 | `https://project.supabase.co` | 서버와 웹 모두 프로젝트 URL 필요 |
| `SUPABASE_SERVICE_ROLE_KEY` | FastAPI, BFF | 예 | `ey...` | 서버 전용, 클라이언트 노출 금지 |
| `JWT_SECRET` | BFF/API 인증 | 예 | `openssl rand -base64 32` | 운영마다 별도 생성 |
| `ALLOWED_ORIGINS` | FastAPI, BFF CORS | 예 | `https://app.example.com,https://admin.example.com` | 쉼표로 구분 |
| `ENVIRONMENT` | 전체 | 예 | `development`, `staging`, `production` | 로그와 보안 정책 분기 기준 |

### Ollama/AI

| 변수 | 사용처 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `OLLAMA_BASE_URL` | FastAPI | `http://ollama:11434` | Docker 내부 Ollama 주소 |
| `OLLAMA_CHAT_MODEL` | FastAPI | `gemma4:e4b` | 식단/운동 답변 모델 |
| `OLLAMA_EMBED_MODEL` | FastAPI | `nomic-embed-text` | RAG 임베딩 모델 |
| `OLLAMA_VISION_MODEL` | FastAPI | `llava:7b` | 음식 이미지 분석 모델 |

### BFF

| 변수 | 사용처 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `PORT` | Node.js BFF | `3000` | BFF listen port |
| `API_URL` | Node.js BFF | `http://api:8000` | FastAPI 내부 주소 |
| `NODE_ENV` | Node.js BFF | `production` | Docker 로컬에서도 production runtime으로 실행 |

### 웹/모바일

| 변수 | 사용처 | 필수 | 설명 |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | `apps/web` | 예 | Vite 웹 관리자 Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | `apps/web` | 예 | 웹 클라이언트용 anon key |
| `EXPO_PUBLIC_SUPABASE_URL` | `apps/mobile`, 추가 예정 | 권장 | 모바일 클라이언트에서 Supabase를 직접 쓸 때 사용 |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/mobile`, 추가 예정 | 권장 | 모바일 클라이언트용 anon key |
| `EXPO_PUBLIC_API_URL` | `apps/mobile` | 필수 | 모바일에서 FastAPI/Nginx API를 호출할 때 사용 |
| `EXPO_PUBLIC_BFF_URL` | `apps/mobile` | 권장 | 모바일에서 BFF/Nginx 실시간·인증 보조 API를 호출할 때 사용 |

현재 모바일 코드에는 환경 변수 참조가 고정되어 있지 않습니다. API 클라이언트를 추가할 때는 Expo의 `EXPO_PUBLIC_` 접두사를 사용하고, service role key는 절대 포함하지 않습니다.

## 5. 로컬 배포

### 사전 조건

- Docker Desktop
- Node.js 18 이상
- Python 3.11 이상
- Expo Go 또는 Android/iOS 시뮬레이터
- Supabase 프로젝트 또는 로컬 Supabase 대체 환경

### 절차

```powershell
Copy-Item .env.example .env -Force
docker compose config --quiet
.\deploy-local.ps1
```

모델을 함께 받을 때:

```powershell
.\deploy-local.ps1 -WithModels
```

pgAdmin을 함께 띄울 때:

```powershell
.\deploy-local.ps1 -WithAdmin
```

Ollama 모델 준비 확인:

```powershell
docker compose --profile models logs ollama-setup
docker compose exec ollama ollama list
```

API 헬스체크:

```powershell
Invoke-WebRequest http://localhost:8088/
Invoke-WebRequest http://localhost:8081/health
Invoke-WebRequest http://localhost:8000/health
Invoke-WebRequest http://localhost:3000/health
Invoke-WebRequest http://localhost:8088/health
Invoke-WebRequest http://localhost:8088/api/health/fastapi
Invoke-WebRequest http://localhost:8088/api/health/node
```

Compose 기준 `http://localhost:8088/`는 웹 관리자 대시보드, `http://localhost:8088/docs`는 FastAPI 문서입니다.

웹 관리자:

```powershell
cd apps\web
npm install
npm run dev
```

모바일:

```powershell
cd apps\mobile
npm install
npx expo start
```

## 6. 개발 환경 배포

개발 환경은 운영과 같은 구조를 쓰되, 도메인과 시크릿을 분리합니다.

1. `dev.fitconnect.example` 같은 별도 도메인을 준비한다.
2. Supabase 개발 프로젝트를 별도로 만든다.
3. `ENVIRONMENT=development` 또는 `staging`을 사용한다.
4. `ALLOWED_ORIGINS`에 개발 웹 도메인, Expo 개발 URL, 로컬 QA URL을 등록한다.
5. Docker 이미지는 `dev` 태그로 빌드한다.
6. DB 스키마는 `infra/supabase/init.sql`, seed는 `infra/supabase/seed.sql`, RAG seed는 `infra/supabase/rag_seed.sql`을 순서대로 적용한다.
7. 배포 후 QA 체크리스트의 Smoke, Auth, Booking, Diet, Clothing 섹션을 실행한다.

권장 개발 배포 명령:

```powershell
docker compose config --quiet
docker compose pull
docker compose up -d --build
docker compose logs -f api bff nginx
```

## 7. 운영 배포

운영은 로컬 Compose를 그대로 공개 서버에 올리는 방식으로 시작할 수 있지만, 아래 조건을 만족해야 합니다.

### 필수 조건

- HTTPS 종단 처리: Nginx 앞단 또는 클라우드 로드밸런서에서 TLS 적용
- 시크릿 주입: 운영에서는 로컬 `.env` 파일 대신 CI/CD secret 또는 secret manager 사용
- 이미지 안전성: 서비스별 `.dockerignore`를 추가해 `venv`, `node_modules`, 서비스 `.env`가 Docker build context에 들어가지 않게 한다.
- 데이터베이스 백업: Supabase 자동 백업 또는 PostgreSQL 스냅샷
- 로그/모니터링: API 오류, 5xx, 응답 시간, 예약 실패, AI 응답 실패 알림
- 접근 제어: DB, Redis, Ollama는 외부 공개 금지
- CORS 제한: 운영 도메인만 `ALLOWED_ORIGINS`에 허용
- 배포 순서: DB 마이그레이션, FastAPI, BFF, Nginx, Web, Mobile 순서

### 운영 배포 절차

1. 릴리스 태그를 생성한다.
2. 환경별 시크릿을 검증한다.
3. Supabase 스키마 변경을 백업 후 적용한다.
4. Docker 이미지를 빌드하고 registry에 푸시한다.
5. 운영 서버에서 이미지를 갱신한다.
6. 헬스체크가 통과할 때까지 트래픽 전환을 보류한다.
7. Smoke test를 통과하면 릴리스를 완료한다.
8. 실패 시 이전 이미지와 이전 DB migration 상태로 롤백한다.

운영 Smoke test:

```powershell
Invoke-WebRequest https://api.example.com/health
Invoke-WebRequest https://api.example.com/api/health/fastapi
Invoke-WebRequest https://api.example.com/api/health/node
```

## 8. 테스트 체크리스트

자세한 체크리스트는 [QA_RELEASE_CHECKLIST.md](QA_RELEASE_CHECKLIST.md)를 기준으로 합니다.

최소 배포 전 확인:

- `apps/web`: `npm install`, `npm run lint`, `npm run build`
- `apps/mobile`: `npm install`, `npx expo start --web` 또는 실제 기기 실행
- `services/api-node`: `npm install`, `npm start`, `/health` 확인
- `services/api-fastapi`: `pip install -r requirements.txt`, `python -m compileall .`, `/health` 확인
- Docker: `docker compose up -d --build`, API/Nginx 헬스체크 확인
- Supabase: RLS 정책, seed 데이터, service role key 서버 전용 사용 확인
- 수동 E2E: 가입, 로그인, 코치 목록, 예약 생성, 식단 챗, 이미지 분석, 의류 추천, 알림

## 9. 릴리스 체크리스트

- 릴리스 범위와 제외 범위를 문서화했다.
- DB schema 변경과 rollback plan이 있다.
- 환경 변수와 시크릿이 운영 값으로 주입된다.
- 모든 health endpoint가 통과한다.
- 운영 도메인의 CORS, HTTPS, rate limit이 설정된다.
- 관리자 계정과 테스트 사용자 계정을 준비했다.
- 베타 사용자에게 공지할 변경사항, 알려진 제한, 문의 채널을 준비했다.
- 배포 후 30분 동안 API error rate, latency, 예약 실패율, AI 실패율을 모니터링한다.

## 10. 로드맵

| 단계 | 기간 | 목표 | 주요 산출물 |
| --- | --- | --- | --- |
| Phase 0 안정화 | 1주 | 실행 환경과 문서 정상화 | env 정리, Docker 실행, 깨진 문서 교체, QA 기준 확정 |
| Phase 1 MVP 완성 | 2-4주 | 핵심 사용자 여정 완주 | 인증, 코치 탐색, 예약, 식단 챗, 의류 추천, 관리자 지표 |
| Phase 2 클로즈드 베타 | 4-8주 | 실제 사용자/코치 검증 | 베타 코치 10-30명, 사용자 100-300명, 피드백 루프 |
| Phase 3 파일럿 영업 | 8-12주 | B2B 센터와 제휴 검증 | 헬스장 파일럿, 의류 제휴 링크, 리텐션/전환 지표 |
| Phase 4 운영 고도화 | 베타 이후 | 자동화와 수익화 | 결제/정산, 추천 개선, A/B 테스트, 모니터링 강화 |

## 11. 핵심 KPI

| 영역 | MVP 목표 |
| --- | --- |
| 활성 사용자 | 베타 MAU 300명 |
| 코치 공급 | 검증 코치 30명 |
| 예약 | 베타 기간 예약 요청 100건 |
| AI 사용 | 사용자당 주 2회 이상 식단/운동 AI 사용 |
| 리텐션 | D7 25% 이상 |
| 품질 | API 5xx 1% 미만, 주요 여정 실패율 3% 미만 |
| 의류 추천 | 추천 클릭률 5% 이상 |

## 12. 주요 리스크와 대응

| 리스크 | 영향 | 대응 |
| --- | --- | --- |
| 환경 변수 누락 | API/BFF 부팅 실패 | `.env.example`과 문서 기준으로 배포 전 검증 |
| service role key 노출 | 보안 사고 | 서버 전용 사용, 클라이언트는 anon key만 사용 |
| AI 응답 지연 | 사용자 이탈 | timeout, fallback 답변, 캐시, 모델 경량화 |
| 식단/건강 오해 | 법적/신뢰 리스크 | 의료 진단 표현 금지, 코치 상담 보조 문구 적용 |
| 예약 중복 | 사용자 불만 | DB 제약과 API 중복 검증 강화 |
| Supabase RLS 오류 | 데이터 노출 또는 접근 실패 | 역할별 RLS QA 필수화 |
| Docker/Ollama 리소스 부족 | 로컬/운영 장애 | 모델 크기와 CPU/GPU 요구사항 명시, 필요 시 외부 LLM 옵션 검토 |

## 13. 지금 바로 해야 할 일

1. 서비스별 `.env` 파일을 실제 값으로 준비한다.
2. `docker compose up -d --build`로 전체 스택을 실행한다.
3. API health와 Nginx proxy health를 확인한다.
4. Supabase 스키마와 seed 적용 상태를 확인한다.
5. `QA_RELEASE_CHECKLIST.md`의 MVP 필수 시나리오를 완료한다.
6. 실패 항목은 릴리스 전 Blocker, Major, Minor로 분류해 처리한다.
