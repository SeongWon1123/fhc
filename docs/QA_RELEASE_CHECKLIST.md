# FitConnect MVP QA 및 릴리스 체크리스트

기준일: 2026-06-02

## 1. 사전 준비

- [ ] 테스트 Supabase 프로젝트가 운영과 분리되어 있다.
- [ ] 루트 `.env`와 `apps/web/.env.local`이 준비되어 있다.
- [ ] service role key가 웹/모바일 번들에 포함되지 않는다.
- [ ] `ALLOWED_ORIGINS`에 실제 테스트 도메인만 들어 있다.
- [ ] 테스트 사용자, 테스트 코치, 관리자 계정이 준비되어 있다.
- [ ] seed 데이터와 RAG seed 적용 여부를 기록했다.

## 2. 빌드 및 정적 검증

### 웹 관리자

```powershell
cd apps\web
npm install
npm run lint
npm run build
```

- [ ] TypeScript 빌드가 성공한다.
- [ ] ESLint 오류가 없다.
- [ ] 관리자 화면이 `npm run dev`에서 열린다.

### 모바일

```powershell
cd apps\mobile
npm install
npx expo start
```

- [ ] Expo 앱이 실제 기기 또는 시뮬레이터에서 열린다.
- [ ] 주요 탭 이동이 동작한다.
- [ ] 모바일 API base URL 전략이 릴리스 환경에 맞다.

### FastAPI

```powershell
cd services\api-fastapi
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m compileall .
uvicorn main:app --reload --port 8000
```

- [ ] Python import/compile 오류가 없다.
- [ ] `GET /health`가 200을 반환한다.
- [ ] OpenAPI 문서가 `/docs`에서 열린다.

### Node.js BFF

```powershell
cd services\api-node
npm install
npm start
```

- [ ] 서버가 `PORT=3000`에서 실행된다.
- [ ] `GET /health`가 200을 반환한다.
- [ ] Socket.IO 연결이 생성된다.

### Docker Compose

```powershell
docker compose up -d --build
docker compose ps
docker compose logs --tail 100 web api bff nginx
```

- [ ] `web`, `db`, `redis`, `ollama`, `api`, `bff`, `nginx`가 healthy 또는 running 상태다.
- [ ] `ollama-setup`이 필요한 모델을 pull했다.
- [ ] `http://localhost:8088/`에서 웹 관리자 대시보드가 열린다.
- [ ] `http://localhost:8088/docs`에서 FastAPI 문서가 열린다.
- [ ] Nginx health endpoint가 200을 반환한다.

## 3. API Smoke Test

```powershell
Invoke-WebRequest http://localhost:8000/health
Invoke-WebRequest http://localhost:3000/health
Invoke-WebRequest http://localhost:8081/health
Invoke-WebRequest http://localhost:8088/health
Invoke-WebRequest http://localhost:8088/api/health/fastapi
Invoke-WebRequest http://localhost:8088/api/health/node
```

- [ ] Web direct health 통과
- [ ] FastAPI direct health 통과
- [ ] BFF direct health 통과
- [ ] Nginx to FastAPI health 통과
- [ ] Nginx to BFF health 통과

## 4. 인증 QA

- [ ] 일반 회원 가입이 성공한다.
- [ ] 일반 로그인 후 JWT 또는 세션이 발급된다.
- [ ] 카카오 로그인 API 실패 시 안전한 오류를 반환한다.
- [ ] 잘못된 토큰으로 보호 API 호출 시 401 또는 403을 반환한다.
- [ ] 로그아웃 또는 토큰 만료 후 보호 화면 접근이 차단된다.
- [ ] 사용자, 코치, 관리자 역할별 접근 권한이 분리된다.

## 5. 코치/예약 QA

- [ ] 코치 목록 조회가 200을 반환한다.
- [ ] specialty, location, rating, price 필터가 기대대로 동작한다.
- [ ] 코치 상세 조회가 프로필과 coach details를 함께 반환한다.
- [ ] 로그인 사용자가 AI 매칭 API를 호출할 수 있다.
- [ ] 예약 생성 시 가격, 시간, 세션 타입이 저장된다.
- [ ] 이미 확정된 시간에는 중복 예약이 막힌다.
- [ ] 사용자는 본인 예약만 조회한다.
- [ ] 코치는 본인에게 배정된 예약만 조회한다.
- [ ] 코치가 예약을 승인/취소할 수 있다.
- [ ] 권한 없는 사용자의 예약 상태 변경이 차단된다.
- [ ] 예약 탭에서 회원은 본인 활성 예약만 취소하고 코치는 받은 예약을 승인/취소/완료/노쇼 처리한다.
- [ ] 코치 메모는 허용된 상태 변경과 함께 저장되고 회원 조작에는 포함되지 않는다.
- [ ] 상태 변경 전 확인과 돌아가기, 중복 제출 차단, HTTP 409 이후 재조회가 동작한다.
- [ ] 아래쪽 예약에서 변경이 실패해도 해당 예약 옆에 원인과 재조회 버튼이 표시된다.
- [ ] 회원과 코치를 서로 다른 세션으로 열고 예약 생성/변경 후 상대방 알림과 목록 갱신을 확인한다.
- [ ] 토큰 갱신/로그아웃 시 실시간 연결이 갱신/종료되고 다른 계정의 알림이 남지 않는다.
- [ ] 실시간 연결 복구/앱 재진입 후 놓친 예약 상태를 다시 조회한다.
- [ ] 기존 예약 알림이 남아 있어도 나중에 발생한 연결 끊김 안내가 함께 표시된다.
- [ ] 알림 전송 실패에도 저장 성공이 유지되고 재예약을 유도하지 않는 안내가 표시된다.

## 6. 식단 AI QA

- [ ] 식단 챗 요청이 `chat_messages`에 사용자/AI 메시지를 저장한다.
- [ ] 최근 대화 히스토리가 다음 응답에 반영된다.
- [ ] 사용자 목표 정보가 있으면 답변에 반영된다.
- [ ] RAG 문서가 없을 때도 fallback 답변을 반환한다.
- [ ] 5MB 이하 이미지 업로드가 분석된다.
- [ ] 5MB 초과 파일은 413을 반환한다.
- [ ] 이미지가 아닌 파일은 400을 반환한다.
- [ ] 식단 로그 저장과 조회가 본인 데이터만 대상으로 동작한다.
- [ ] 건강/의료 확정 진단 표현이 노출되지 않는다.

## 7. 의류 추천 QA

- [ ] 운동 종목 필수 파라미터가 없으면 422를 반환한다.
- [ ] 유효한 운동 종목으로 추천 목록이 반환된다.
- [ ] 추천 아이템에 이름, 카테고리, 링크 또는 추적 식별자가 포함된다.
- [ ] 클릭 추적 API가 본인 추천 데이터만 갱신한다.
- [ ] 외부 제휴 링크가 새 창 또는 외부 브라우저로 안전하게 열린다.

## 8. 웹 관리자 QA

- [ ] 대시보드 주요 통계가 빈 데이터와 seed 데이터에서 모두 깨지지 않는다.
- [ ] 회원 목록이 페이지 이탈 없이 조회된다.
- [ ] 코치 목록과 상태 표시가 정상이다.
- [ ] 예약 목록에서 상태, 날짜, 사용자/코치 정보가 읽힌다.
- [ ] 분석 화면에서 차트가 빈 데이터에서도 오류 없이 표시된다.
- [ ] 관리자 권한이 아닌 계정은 관리자 화면 접근이 차단된다.

## 9. 모바일 QA

- [ ] 온보딩에서 로그인 화면까지 이동한다.
- [ ] 홈 화면이 초기 데이터 없음 상태를 처리한다.
- [ ] 코치 목록, 상세, 예약 화면 이동이 동작한다.
- [ ] 식단 기록 화면에서 빈 상태와 입력 상태가 모두 정상이다.
- [ ] 의류 추천 화면에서 종목 선택 후 결과가 표시된다.
- [ ] 네트워크 오류 때 사용자에게 복구 가능한 메시지를 보여준다.
- [ ] Android와 iOS에서 주요 화면 레이아웃이 깨지지 않는다.

## 10. 보안 QA

- [ ] service role key가 클라이언트 번들에 없다.
- [ ] Supabase RLS가 사용자별 데이터 접근을 제한한다.
- [ ] 관리자 API 또는 화면은 관리자 권한만 접근한다.
- [ ] 인증 API rate limit이 동작한다.
- [ ] CORS가 허용 도메인 외 요청을 차단한다.
- [ ] 업로드 파일 크기와 타입 검증이 동작한다.
- [ ] 로그에 토큰, key, 개인정보 원문이 남지 않는다.
- [ ] 운영 Nginx 또는 로드밸런서가 HTTPS를 강제한다.

## 11. 성능 QA

- [ ] health endpoint 평균 응답 시간이 300ms 이하이다.
- [ ] 코치 목록 조회 평균 응답 시간이 1초 이하이다.
- [ ] 식단 챗 평균 응답 시간이 MVP 기준 10초 이하이다.
- [ ] 이미지 분석은 timeout과 사용자 안내가 있다.
- [ ] 동시 사용자 20명 수준의 기본 smoke 부하에서 5xx가 1% 미만이다.
- [ ] Redis/Ollama/DB 리소스 사용률을 배포 후 관찰한다.

## 12. 릴리스 전 체크

- [ ] 릴리스 버전, 커밋, 배포 대상 환경이 기록되어 있다.
- [ ] DB 변경 사항과 rollback SQL 또는 복구 절차가 있다.
- [ ] 운영 시크릿이 모두 주입되었다.
- [ ] 운영 `ALLOWED_ORIGINS`가 실제 도메인으로 제한된다.
- [ ] 운영 DB 백업 또는 스냅샷을 생성했다.
- [ ] 운영 배포 전 사용자 공지 문구를 준비했다.
- [ ] 알려진 제한 사항과 문의 채널을 준비했다.
- [ ] 배포 담당자와 롤백 담당자가 명확하다.

## 13. 배포 후 체크

- [ ] `/health`, `/api/health/fastapi`, `/api/health/node`가 200이다.
- [ ] 가입, 로그인, 코치 목록, 예약 생성, 식단 챗, 의류 추천 smoke test가 통과한다.
- [ ] API 5xx, latency, DB connection, memory, disk 사용량을 30분 이상 모니터링한다.
- [ ] 오류가 급증하면 이전 이미지로 롤백한다.
- [ ] 배포 결과와 남은 이슈를 릴리스 노트에 기록한다.

## 14. 릴리스 판정 기준

| 등급 | 기준 | 판정 |
| --- | --- | --- |
| Blocker | 가입/로그인/예약/데이터 접근이 실패하거나 보안 노출이 있음 | 릴리스 금지 |
| Major | 핵심 기능 일부 실패, 수동 우회 가능 | 담당자 승인 후 제한 릴리스 |
| Minor | UI 문구, 낮은 빈도 오류, 운영 영향 작음 | 릴리스 가능, 후속 처리 |

Blocker가 0개이고 Major가 명시적으로 승인되면 MVP 릴리스를 진행합니다.
