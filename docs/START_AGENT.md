# 새 작업자 시작 가이드

기준일: 2026-06-02

## 1. 먼저 읽을 문서

1. [../README.md](../README.md)
2. [DEPLOYMENT_PRODUCT_PLAN.md](DEPLOYMENT_PRODUCT_PLAN.md)
3. [QA_RELEASE_CHECKLIST.md](QA_RELEASE_CHECKLIST.md)
4. 맡은 기능과 관련된 코드 파일

## 2. 시작 절차

```powershell
git status --short
if (Get-Command rg -ErrorAction SilentlyContinue) { rg --files } else { Get-ChildItem -Recurse -File }
```

확인할 것:

- 현재 작업 범위
- 이미 변경된 파일
- 실행해야 할 테스트
- 필요한 환경 변수
- 건드리면 안 되는 파일

## 3. 환경 준비

루트 `.env`가 없으면 템플릿을 복사한 뒤 실제 값을 채웁니다.

```powershell
Copy-Item .env.example .env -Force
```

웹 관리자:

```powershell
Set-Content apps\web\.env.local "VITE_SUPABASE_URL=https://your-project.supabase.co`nVITE_SUPABASE_ANON_KEY=your_supabase_anon_key"
```

전체 실행:

```powershell
.\deploy-local.ps1
```

헬스체크:

```powershell
Invoke-WebRequest http://localhost:8000/health
Invoke-WebRequest http://localhost:3000/health
Invoke-WebRequest http://localhost:8088/health
```

## 4. 작업 범위별 기준

| 맡은 영역 | 우선 확인 | 변경 후 검증 |
| --- | --- | --- |
| 모바일 | `apps/mobile`, API 호출 방식, 화면 이동 | Expo 실행, 주요 화면 수동 QA |
| 웹 | `apps/web`, Supabase client, 라우팅 | `npm run lint`, `npm run build` |
| FastAPI | routers, models, services, DB schema | `python -m compileall .`, `/health`, API smoke |
| BFF | routes, middleware, Socket.IO | `npm start`, `/health`, 인증 smoke |
| 인프라 | Compose, Nginx, Supabase SQL | `docker compose up -d --build`, proxy health |
| 문서 | README, docs | 링크, 명령, 체크리스트 최신화 |

## 5. 보고 형식

작업 완료 보고에는 아래 항목을 포함합니다.

- 변경 요약
- 정확한 변경 파일
- 실행한 명령
- 통과/실패한 검증
- 남은 blocker 또는 후속 작업

## 6. 금지 사항

- 맡은 범위 밖 파일을 임의 수정하지 않는다.
- 다른 작업자의 변경을 되돌리지 않는다.
- 실제 `.env` 값을 출력하거나 문서에 적지 않는다.
- 운영 service role key를 웹/모바일 코드에 넣지 않는다.
- QA 없이 배포 가능하다고 말하지 않는다.
