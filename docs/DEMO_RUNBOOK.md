# FitConnect 브라우저 데모 실행 가이드 (DEMO_RUNBOOK)

작성일: 2026-09-18
검증 환경: WSL2 Linux x64, node v24.20.0 / npm 11.19.0, Expo 54.0.26, Python 3 (FastAPI `.venv`)

## 목적

심사자가 브라우저에서 FitConnect 소비자 앱을 직접 걸어볼 수 있게 하는 재현 절차.

이 문서의 모든 명령은 이 머신에서 실제로 실행해 결과를 확인한 것이다. 화면 픽셀 확인만
예외이며, 그 사실은 아래 6절에 명시한다.

---

## 0. 필수 경고 — 주입 없이 빌드하면 실제 Supabase 키가 공개 번들에 박힌다

`apps/mobile/.env`에는 **실제 Supabase 프로젝트 URL과 실제 anon key**가 들어 있다(실제 프로젝트
ref와 키는 이 문서에 옮겨 적지 않는다 — `apps/mobile/.env`의 `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY`를 직접 확인할 것. 파일 자체는 `.env`라서 커밋되지 않는다).
따라서 주입 없이 평범하게 `npx expo export --platform web`을 실행하면 **실제 키가 공개 정적
번들에 그대로 박힌다.**

아래 2절의 **더미 3변수**(`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
`EXPO_PUBLIC_API_URL`)를 반드시 함께 넘겨야 한다. 프로세스 환경변수는 `.env`보다 우선하므로
더미 값이 실값을 덮는다.

검증된 사실(2026-09-18 재확인):

- 더미 3변수를 주입한 번들 `apps/mobile/dist/_expo/static/js/web/index-*.js`(3,783,048 bytes)에는
  더미 `http://localhost:54321`이 1건, 더미 JWT `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy.dummy`가
  1건 들어 있다.
- 같은 번들에서 실제 프로젝트 ref 문자열과 `supabase.co`는 **각각 0건**이다(`apps/mobile/.env`의
  실제 ref를 패턴으로 grep해 확인했다. 패턴 자체는 문서·커밋에 남기지 않는다).
- 대조 증거로, 주입 없이 만들어진 기존 `apps/web/dist/assets/index-h7LzF-5T.js`에는 실제 ref가
  1건 박혀 있다. 주입을 빠뜨리면 같은 일이 모바일 번들에서 재발한다.

실제 키가 박힌 번들은 절대 배포하거나 커밋하지 말고, 즉시 `rm -rf apps/mobile/dist`로 지우고
더미 변수를 붙여 다시 빌드한다.

---

## 1. 데모 API 기동 (정확히 5개 변수)

데모 데이터(코치 3명·회원 3명·의류 4개)는 FastAPI 내장 폴백 데이터셋에서 나온다. 그런데
`ENABLE_DEMO_FALLBACK=true`만으로는 부족하다. 라우터는 Supabase 클라이언트가 `None`이거나
쿼리가 예외를 던질 때만 폴백 분기로 간다. 실 `.env` 자격증명이 살아 있으면 클라이언트가 생성되고
원격 쿼리가 **예외 없이 성공해 0행을 반환**하므로 폴백에 도달하지 못한다(`"source":"supabase"`,
`"total":0`).

따라서 자격증명 두 개를 **빈 값으로 덮어써서** 클라이언트를 `None`으로 만들어야 한다. 필요한
변수는 정확히 다음 5개다.

```bash
cd /home/administrator/projects/FHC/services/api-fastapi && ENVIRONMENT=development ENABLE_DEMO_FALLBACK=true ALLOWED_ORIGINS='http://localhost:8081,http://127.0.0.1:8081' SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= .venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

- `ENVIRONMENT=development` — production이면 `demo_fallback_enabled`가 강제로 false가 된다.
- `ENABLE_DEMO_FALLBACK=true` — 폴백 스위치.
- `ALLOWED_ORIGINS='http://localhost:8081,http://127.0.0.1:8081'` — 정적 서버 CORS 허용목록.
- `SUPABASE_URL=` / `SUPABASE_SERVICE_ROLE_KEY=` — 빈 값으로 덮어써 클라이언트를 끊는다.
  이 두 개를 빼면 폴백이 켜져 있어도 `"source":"supabase"`, `"total":0`이 나온다(대조 실험으로
  확인됨).

`.env` 파일은 수정하지 않는다. 값은 프로세스 환경변수로만 주입한다.

### 기동 검증

```bash
curl -s http://127.0.0.1:8000/health
```

`"demo_fallback":{"enabled":true}`와 `"supabase":{"configured":false,"mode":"demo-fallback"}`가
보여야 한다.

```bash
curl -s http://127.0.0.1:8000/api/v1/coaches/
```

`"source":"demo-fallback"`과 `"total":3`이 나와야 하고, 코치 3명은 `박민아`·`이준`·`김소라`다.

부가 확인:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/api/v1/clothing/recommendations
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/api/v1/diet/logs
```

둘 다 `200`이어야 한다.

---

## 2. 웹 번들 빌드 (더미 3변수 필수)

빌드 전에 이전 산출물을 지운다. `dist`가 이미 있으면 지우고 다시 만든다.

```bash
cd /home/administrator/projects/FHC/apps/mobile && rm -rf dist
```

```bash
cd /home/administrator/projects/FHC/apps/mobile && EXPO_PUBLIC_DEMO_MODE=true EXPO_PUBLIC_API_URL=http://localhost:8000 EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy.dummy npx expo export --platform web
```

- `EXPO_PUBLIC_DEMO_MODE=true` — 로그인 화면 없이 앱 본문으로 진입하는 데모 가드.
- `EXPO_PUBLIC_API_URL=http://localhost:8000` — 1절의 데모 API 주소.
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` — 형식만 유효한 더미 값.
  `createClient`는 형식만 보므로 실키가 필요 없다. 0절 경고 참조.

결과물은 `apps/mobile/dist`이며 gitignore 대상이다(`apps/mobile/.gitignore:8:dist/`).

```
dist/index.html                       1,216 bytes
dist/_expo/static/js/web/index-<hash>.js   3,783,048 bytes (3.78 MB)
dist/favicon.ico, dist/metadata.json, dist/assets/**
```

`"output": "single"` 설정 때문에 웹 번들은 1개만 생성된다. 빌드 판정은 expo의 진행 요약이 아니라
종료 코드(0)와 `dist` 안의 실제 파일로 한다.

---

## 3. 정적 서빙

```bash
cd /home/administrator/projects/FHC/apps/mobile && python3 -m http.server 8081 -d dist
```

브라우저에서 `http://localhost:8081`을 연다. (API는 `http://localhost:8000`에서 이미 떠 있어야 한다.)

서빙 확인:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8081/
```

`200`이어야 하고, HTML은 `/_expo/static/js/web/index-<hash>.js`를 참조해야 한다.

---

## 4. 주의 — 서버 수명

백그라운드로 띄운 서버는 오래 살아 있다고 가정하지 말 것. 상위 오케스트레이션 세션에서는 셸
세션이 끝나면서 프로세스가 함께 사라지는 것이 관측됐다(그래서 데모 재현용으로 남겨 두려면
포그라운드나 감독 프로세스로 띄우라는 지침이 계획에 남아 있다).

다만 이 문서 작성 시점의 재검증에서는 `setsid nohup ...`과 평범한 `... &` **둘 다** 셸 호출이
끝난 뒤에도 리스너로 남아 있었다(`ss -ltnp | grep 8000`으로 확인). 즉 "셸 호출 종료 = 즉시 종료"는
재현되지 않았다. 환경에 따라 프로세스 트리가 정리될 수 있으므로, 데모 중에는 포그라운드나 감독
프로세스(tmux, 별도 터미널, `wait` 루프)로 띄우고, 끝나면 직접 종료한다.

### 정리 — kill이 성공했다고 믿지 말고 포트로 확인한다

백그라운드로 띄운 프로세스를 `$!`로 죽이는 방식은 믿을 수 없다. 셸에서 `nohup ... &`를 쓰면
`$!`가 **중간 서브셸**을 가리킬 수 있어서, `kill $PID` 뒤 `kill -0 $PID`가 "죽었다"고 보고해도
실제 서버는 계속 떠 있는 경우가 있다. 이 함정을 겪으면 두 번째 기동이 `address already in use`로
실패하고, 남아 있던 이전 프로세스가 응답해서 검증 결과의 출처가 오염된다(어느 프로세스가 답했는지
알 수 없게 된다). 그래서 종료 여부는 kill의 반환값이 아니라 **리스너와 응답**으로 판정한다.

```bash
# 1) 먼저 무엇이 떠 있는지 읽는다 (죽이기 전에 매칭 목록을 반드시 확인한다)
pgrep -af 'uvicorn main:app|http.server 8081'
ss -ltnp | grep -E ':(8000|8081)'
```

```bash
# 2) 종료를 시도한다 (TERM → 살아 있으면 KILL)
kill <pid>
kill -9 <pid>
```

```bash
# 3) 정말 죽었는지 확인한다 — 둘 다 비어야 정리 완료다
ss -ltn | grep -E ':(8000|8081)'
curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:8000/health
```

`ss -ltn` 출력이 비어 있고 curl이 아무것도 출력하지 않거나 연결 오류를 내야 한다. 리스너가 남아
있으면 `kill -9 <pid>`로 올리고, 그래도 남으면 마지막 수단으로 패턴 정리를 쓴다.

```bash
pkill -f 'uvicorn main:app'
pkill -f 'http.server'
```

주의: `pgrep -f <패턴>`과 대괄호 없는 `pkill -f <패턴>`은 **검사하는 셸 자신의 명령줄도 매칭**할 수
있다(예: `pgrep -f 'http.server 8081'`이 자기 자신을 잡는다). 그래서 죽이기 전에 매칭된 목록을 읽고
진짜 서버인지 확인한다.

데모 중에는 백그라운드 프로세스가 살아 있으리라 가정하지 말고 포그라운드나 감독 프로세스(tmux,
별도 터미널, `wait` 루프)로 띄운다. 이는 위 4절 서두의 관측과 같은 이유다.

### 웹 콘솔 번들 주의 — `VITE_` 실값이 `dist`에 박힌다

운영자 콘솔 `apps/web`을 실제 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 값으로 빌드하면
**실제 Supabase 프로젝트 ref와 키가 `apps/web/dist`에 그대로 들어간다**(현재
`apps/web/dist/assets/index-h7LzF-5T.js`에 실제 ref가 1건 박혀 있는 것을 확인했다. 실값의 출처는
루트 `.env`이며, 값 자체는 이 문서에 옮겨 적지 않는다). `apps/web/dist`는 gitignore 대상이라
커밋되거나 푸시되지 않지만, 그 디렉터리를 배포하거나 압축해 제3자에게 전달하면 자격증명이 함께
나간다.

따라서 콘솔을 배포하거나 전달할 일이 있으면 다음 중 하나를 한다.

- 더미 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 값으로 다시 빌드한 산출물을 배포한다.
- 또는 배포·압축 대상에서 `apps/web/dist`를 제외한다.

`apps/web/dist`는 삭제하지 않는다(재생성 가능한 산출물이므로 경고로만 남긴다).

---

## 5. 심사자 화면 순서

데모 모드에서는 로그인 화면 없이 앱 본문이 바로 뜨고, 로그아웃을 눌러도 로그인 화면으로 튕기지
않는다(데모 사용자가 재주입됨). 아래 순서로 걸어본다.

1. 홈
2. 코치 (목록: 박민아·이준·김소라 3명)
3. 코치 상세
4. 예약 (예약 완료 후 화면 이동이 대화상자 버튼 콜백으로 이뤄진다 — 웹에서는 `window.confirm` 시그니처로 대체됨)
5. 식단
6. 의류
7. 내 정보 (로그아웃 확인 대화상자도 웹에서는 `window.confirm`으로 동작)

---

## 6. 이 머신에서 검증 불가한 것

- **픽셀/브라우저 렌더링**: docker가 없고, headless Chromium은 `libnspr4` 부재로 기동에 실패한다.
  화면이 실제로 어떻게 그려지는지는 이 머신에서 확인할 수 없다.
- **docker-compose 경로**: WSL에 docker 데몬이 없다(CLI는 Windows Desktop 셰림). `docker-compose.yml`
  기반 기동은 여기서 재현할 수 없다.
- CORS 헤더·HTTP 200·번들 문자열·데모 데이터 3명까지는 curl/grep으로 검증됐지만, 그 위의 시각적
  완성도는 검증 범위 밖이다.

---

## 7. 검증 원칙

스크린샷과 시각 확인은 **사람의 몫**이다. 에이전트는 시각 검증을 수행하거나 주장하지 않는다.
이 문서에 적힌 "검증됨"은 curl 응답, 종료 코드, 파일 크기, 번들 grep처럼 기계적으로 재현 가능한
근거만을 뜻한다.
