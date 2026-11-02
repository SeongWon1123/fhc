# 권한 및 예약 무결성 수정 적용

이 변경은 서버와 클라이언트 코드뿐 아니라 `infra/supabase/init.sql`의 DB 변경도 필요하다.
코드 배포만으로 기존 Supabase 프로젝트의 정책이 바뀌지는 않는다.

## 적용 전

1. 운영 DB를 백업하고 테스트 프로젝트에서 먼저 검증한다.
2. 기존 활성 예약의 시간 겹침을 확인한다. 아래 결과가 있으면 담당자가 예약을 조정하거나 취소한다.
   스키마 적용은 중복 데이터를 자동 삭제하지 않고 실패하도록 되어 있다.

```sql
SELECT a.id AS booking_a, b.id AS booking_b, a.coach_id
FROM public.bookings a
JOIN public.bookings b ON a.coach_id = b.coach_id AND a.id < b.id
WHERE a.status IN ('pending', 'confirmed')
  AND b.status IN ('pending', 'confirmed')
  AND tsrange(
      a.scheduled_at AT TIME ZONE 'UTC',
      (a.scheduled_at AT TIME ZONE 'UTC') + a.duration_minutes * INTERVAL '1 minute', '[)'
  ) && tsrange(
      b.scheduled_at AT TIME ZONE 'UTC',
      (b.scheduled_at AT TIME ZONE 'UTC') + b.duration_minutes * INTERVAL '1 minute', '[)'
  );
```

## DB와 서버 적용

- 새 빈 Supabase 프로젝트는 SQL Editor의 새 쿼리에 `infra/supabase/init.sql`
  **전체 내용**을 붙여넣고 전체를 실행한다. 테이블 생성, RLS, 명시적 권한이
  모두 포함되어 있으므로 별도 GRANT 조각이나 BEGIN/COMMIT을 덧붙이지 않는다.
  권한 부분만 선택 실행하면 `42P01: relation "public.profiles" does not exist`가
  발생할 수 있다. 실행 후 Table Editor에서 `profiles`, `bookings` 등을 확인한다.
- 예약 쓰기를 중지한 유지보수 구간에 `infra/supabase/init.sql`을 트랜잭션으로 적용한다.
  `btree_gist` 확장 생성 권한이 필요하다.
- CLI 사용 시 DB 연결은 비밀 관리 경로로 제공하고 `psql --single-transaction --set ON_ERROR_STOP=on --file infra/supabase/init.sql`을 실행한다.
- `profiles`의 `role`, `gym_id`는 신뢰된 서버/DB 관리자만 지정한다.
  `gym_owner` 계정은 `gyms.owner_id`와 연결하고, 회원은 `profiles.gym_id`,
  코치는 `coach_details.gym_id`를 실제 소속으로 지정한다. 기존 회원 소속은 추측해 자동 배정하지 않는다.
- 기존 예약의 `gym_id`는 코치의 현재 소속에서 최초 보완된다. 소속 이력이 다른 예약은 관리자 확인이 필요하다.
- FastAPI와 BFF를 재시작하고 웹·모바일을 새 번들로 배포한다.

## 변경된 계약

- `/api/v1/admin/access`, `/api/v1/admin/overview`는 모든 환경에서 Supabase Bearer JWT를 요구한다.
  서버가 DB 프로필의 `admin` / `gym_owner` 역할을 검사한다. `X-Admin-Key`는 운영자 인증으로 사용하지 않는다.
- 관리자는 전체 범위, 원장은 본인이 소유한 활성 헬스장 범위만 조회한다.
  원장에게 활성 헬스장이 없으면 빈 범위이며 전체 조회로 확장하지 않는다.
- 운영자 웹은 직접 Supabase 데이터 조회로 우회하지 않는다.
- 일반 클라이언트는 결제·RAG·예약·코치 상세를 직접 쓰지 못한다.
  공개 코치 정보는 FastAPI의 제한된 필드 응답을 사용하고, 전체 프로필 행은 본인만 조회한다.
- 회원은 대기/확정 예약 취소만, 코치는 대기 예약 확정/취소 및 확정 예약 완료/취소/노쇼 처리만 가능하다.
  최종 상태를 되돌릴 수 없고 코치 메모는 코치만 기록한다.
- 활성 예약은 `[시작, 종료)` 범위가 겹칠 수 없다. 인접한 예약은 가능하다.
  동시 생성과 DB 직접 쓰기도 제약을 통과해야 한다.
- Socket.IO는 `handshake.auth.token`을 검증한다. 사용자 입력으로 방이나 예약 상태를 결정하지 않는다.
  REST 실시간 트리거는 저장된 예약의 참여자·상태를 읽어 알림만 보낸다.
- 식단 채팅 `session_id`는 UUID이며 대화 조회는 사용자와 세션을 모두 제한한다.
  사진 분석 후 식사 종류를 선택하고 저장해야 식단 기록에 추가된다.
  분석의 소수 칼로리는 미리보기에서 정수 kcal로 반올림하며 영양소의 소수 g 값은 유지한다.

## 회귀 검증

외부 Supabase 대신 별도 로컬 PostgreSQL 클러스터를 지정한다. 테스트가 임시 DB를 만들고 삭제하므로
운영 DB를 지정하지 않는다. 로컬 호스트 이외 주소는 테스트가 거부한다.

```bash
cd services/api-fastapi
FITCONNECT_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:15433/postgres python -m pytest
```

DB 환경 변수가 없으면 DB 통합 검사만 제외된다. 배포 검증에서는 DB 통합 검사까지 실행해야 한다.
웹은 `npm run lint && npm run build && npm test`, 모바일은 `npm run typecheck`와 `bun test tests`,
BFF는 `npm run syntax && npm test`로 검사한다. BFF 실시간 테스트는 Node 24의 WebSocket을 사용한다.

적용 후 두 헬스장 원장 계정으로 데이터 격리를 확인하고, 일반 회원의 운영자 API 거부,
중복 예약 HTTP 409, 사진 분석→저장→기록 재진입을 수동 확인한다.

## 예약 화면 및 실시간 알림 연결

- API의 `BFF_INTERNAL_URL`은 API 서버에서 접근 가능한 BFF 주소다.
  Compose 기본값은 `http://bff:3000`, 단독 실행 기본값은 `http://localhost:3000`이다.
- 모바일 `EXPO_PUBLIC_BFF_URL`은 기기/브라우저에서 접근 가능한 BFF 주소다.
  외부 게이트웨이를 사용할 때는 `/socket.io/`의 WebSocket/HTTP polling 경로도 전달해야 한다.
- 예약 생성/변경을 DB에 저장한 뒤 API가 참여자의 Bearer 토큰으로 BFF 발행 API를 호출한다.
  응답의 `X-Booking-Notification`은 `delivered`, `unavailable`, 시연 모드의 `skipped` 중 하나다.
  `delivered`는 BFF가 발행을 수락했다는 뜻이지 기기 수신 확인이나 푸시 전송 보장은 아니다.
- BFF가 중단돼도 예약 저장 성공은 유지한다. 모바일은 알림 실패를 별도로 안내한다.
  연결 복구, 화면 재진입, 앱 활성화 때 목록을 다시 조회해 누락된 상태를 보완한다.
- 이 기능은 앱 실행 중 실시간 알림이다. OS 푸시 알림이나 영구 알림함은 포함하지 않는다.
