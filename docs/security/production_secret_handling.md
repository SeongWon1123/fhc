# FitConnect 운영 시크릿 관리 지침

기준일: 2026-06-04
문서 상태: 운영 배포 전 적용 기준 초안

## 1. 핵심 원칙

- 운영 시크릿은 Git, Docker image, 앱 번들, 문서, 이슈, 채팅, 로그에 저장하지 않습니다.
- 환경별로 시크릿을 분리합니다. 개발, 스테이징, 운영은 서로 다른 값을 사용합니다.
- 공개 가능한 값과 비밀 값을 구분합니다. Supabase anon key는 공개 클라이언트 키이지만 service role key는 서버 전용 비밀입니다.
- 시크릿은 런타임에 주입합니다. Docker build arg, Vite/Expo public env, 정적 파일에 비밀 값을 넣지 않습니다.
- 유출이 의심되면 즉시 회전하고 영향 범위를 기록합니다.

## 2. 변수별 취급 기준

| 변수 | 등급 | 위치 | 처리 기준 |
| --- | --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Critical secret | FastAPI, Node BFF 서버 | 서버 전용. 클라이언트, 웹 빌드, 모바일 앱, 로그 포함 금지 |
| `SUPABASE_URL` | Public config | 서버/클라이언트 | 공개 가능하지만 환경별 값 관리 |
| `VITE_SUPABASE_URL` | Public config | 웹 | 공개 가능 |
| `VITE_SUPABASE_ANON_KEY` | Public client key | 웹 | 공개 가능. RLS 전제 필수 |
| `EXPO_PUBLIC_SUPABASE_URL` | Public config | 모바일 | 공개 가능 |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public client key | 모바일 | 공개 가능. RLS 전제 필수 |
| `JWT_SECRET` | Critical secret | 서버 | 운영마다 고유하게 생성. 32바이트 이상 랜덤 권장 |
| `POSTGRES_PASSWORD` | Critical secret | DB/server | URL 인코딩 문제 확인. DB 외부 공개 금지 |
| `DATABASE_URL` | Critical secret | 서버 | 로그와 오류 메시지 마스킹 |
| `REDIS_URL` | Secret | 서버 | 운영 Redis 인증과 내부망 제한 |
| `KAKAO_CLIENT_SECRET` | Secret | BFF | 도입 시 서버 전용 |
| `TOSS_SECRET_KEY` 또는 결제 secret | Critical secret | 서버 | 도입 시 서버 전용. 결제 로그 마스킹 |
| `FCM_SERVER_KEY` 또는 push secret | Secret | 서버 | 푸시 페이로드에 민감정보 금지 |
| `PGADMIN_DEFAULT_PASSWORD` | Secret | 운영 admin | 운영 공개 금지, VPN 또는 내부망 제한 |
| `OLLAMA_*_MODEL` | Config | 서버 | 비밀 아님. 외부 LLM API key 도입 시 secret으로 분류 |
| `ALLOWED_ORIGINS` | Security config | 서버 | 운영 도메인만 허용 |
| `ENABLE_DEMO_FALLBACK` | Security config | 서버 | 운영은 반드시 `false` |

## 3. 로컬 개발

- 루트 `.env`는 개발자 PC에서만 사용하고 커밋하지 않습니다.
- `.env.example`에는 placeholder와 보안 주의사항만 둡니다.
- 로컬 비밀번호라도 `change-me` 값 그대로 운영에 사용하지 않습니다.
- 개발용 Supabase 프로젝트와 운영 프로젝트를 분리합니다.
- 로컬 로그 공유 시 토큰, key, 이메일, 전화번호, 건강 관련 대화 원문을 제거합니다.

## 4. CI/CD

- CI secret store에 환경별 값을 등록합니다.
- pull request 빌드에는 운영 secret을 주입하지 않습니다.
- `npm run build`, Expo build, Docker build 단계에서 secret이 정적 산출물에 포함되지 않는지 검사합니다.
- 배포 로그는 secret masking을 켭니다.
- 테스트 실패 로그에 `.env` 전체가 출력되지 않도록 합니다.
- 컨테이너 이미지를 푸시하기 전 `docker history`와 build args를 점검합니다.

## 5. 운영 런타임 주입

권장 우선순위:

1. 클라우드 secret manager 또는 플랫폼 secret store
2. Docker secrets 또는 Kubernetes secrets와 외부 secret operator
3. CI/CD가 서버 환경 변수로 주입
4. 제한된 권한의 운영 `.env` 파일. 이 방식은 임시 또는 소규모 배포에서만 사용

운영 `.env` 파일을 사용할 경우:

- 파일 권한을 최소화합니다.
- 백업, 스냅샷, 공유 폴더에서 제외합니다.
- 서버 접속 권한을 제한합니다.
- 변경 이력을 별도 secret manager 또는 vault로 관리합니다.

## 6. 빌드 산출물 검증

웹 빌드 후:

```powershell
cd apps\web
npm run build
rg -n "SUPABASE_SERVICE_ROLE_KEY|JWT_SECRET|service_role|postgres://|eyJ" dist
```

모바일 빌드 전:

```powershell
cd apps\mobile
rg -n "SUPABASE_SERVICE_ROLE_KEY|JWT_SECRET|service_role|TOSS_SECRET|KAKAO_CLIENT_SECRET" .
```

서버 로그 점검:

```powershell
docker compose logs --tail 500 api bff nginx | rg -n "SUPABASE_SERVICE_ROLE_KEY|JWT_SECRET|Bearer |refresh_token|access_token|password"
```

검색 결과가 실제 secret 또는 토큰이면 배포를 중단하고 회전합니다.

## 7. 회전 절차

### service role key 유출 의심

1. Supabase에서 새 service role key를 발급합니다.
2. 운영 secret store 값을 교체합니다.
3. FastAPI와 Node BFF를 재시작합니다.
4. 이전 key를 폐기합니다.
5. 노출 가능 로그와 접근 기록을 확인합니다.
6. RLS 우회 또는 데이터 변경 흔적을 점검합니다.

### JWT secret 유출 의심

1. 새 `JWT_SECRET`을 생성합니다.
2. 서버를 재시작합니다.
3. 기존 세션과 refresh token 무효화 범위를 결정합니다.
4. 사용자 재로그인 안내가 필요한지 판단합니다.

### DB 비밀번호 유출 의심

1. DB 사용자 비밀번호를 변경합니다.
2. `DATABASE_URL`, `POSTGRES_PASSWORD`를 교체합니다.
3. 연결 풀과 서버를 재시작합니다.
4. 외부 접속 로그와 비정상 쿼리를 점검합니다.

### OAuth/결제 secret 유출 의심

1. 제공자 콘솔에서 secret을 회전합니다.
2. redirect URI, webhook 서명 키, 허용 도메인을 재검토합니다.
3. 비정상 로그인, 결제 요청, webhook 호출을 점검합니다.

## 8. 배포 전 게이트

- [ ] 운영 secret이 `.env.example` 또는 문서에 포함되어 있지 않다.
- [ ] 운영 secret이 Git history에 포함되어 있지 않다.
- [ ] 웹/모바일 빌드 산출물 secret 검색이 통과했다.
- [ ] Docker image history에 secret build arg가 없다.
- [ ] 운영 `ENABLE_DEMO_FALLBACK=false`
- [ ] 운영 `ALLOWED_ORIGINS`가 wildcard가 아니다.
- [ ] Supabase anon key로 RLS 테스트가 통과했다.
- [ ] service role key 사용 API는 서버 측 권한 검증이 있다.
- [ ] secret 회전 담당자와 절차가 지정되어 있다.

## 9. 생성 명령 예시

JWT secret:

```powershell
openssl rand -base64 32
```

PowerShell 대체:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

운영에서는 생성된 값을 secret manager에 직접 저장하고 터미널 히스토리, 스크린샷, 채팅에 남기지 않습니다.
