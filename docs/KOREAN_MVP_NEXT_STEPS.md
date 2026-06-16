# 한국어판 MVP 다음 단계

작성일: 2026-06-04

## 현재 상태

- 웹 관리자와 모바일 핵심 화면은 한국어 기본 UI로 전환한다.
- 브랜드명 `FitConnect`, API 경로, 내부 enum, 개발 로그는 기술 식별자로 유지한다.
- 로컬 Docker 배포 진입점은 `http://localhost:8088`이다.
- Supabase 실데이터가 없을 때는 화면에 `시연용 대체 데이터`로 명확히 표시한다.

## 1단계: 지원금 제출 패키지

1. 한국어 시연 계정 2개를 준비한다.
   - 일반 회원 계정
   - 운영 관리자 또는 시연용 관리자 계정
2. 시연 시나리오를 5분 흐름으로 고정한다.
   - 회원 온보딩
   - 코치 탐색
   - 예약 요청
   - 식단 코치 대화
   - 의류 추천 확인
   - 웹 관리자에서 예약/회원/코치/의류 피드 확인
3. 제출 자료에 아래 파일을 첨부한다.
   - `dist/release/*-staging.zip`
   - `docs/QA_RELEASE_CHECKLIST.md`
   - `docs/RELEASE_RUNBOOK.md`
   - `docs/IP_REGISTRATION_PACKAGE.md`
   - `docs/legal/evidence/filing_snapshot.md`
   - `artifacts/mvp-browser-check.png`

## 2단계: Supabase 실데이터 전환

1. Supabase 프로젝트를 production/staging으로 분리한다.
2. `.env`에는 실제 값만 넣고, `.env.example`은 placeholder만 유지한다.
3. CSV 템플릿에 실제 데이터 또는 검증 가능한 파일럿 데이터를 넣는다.
   - `infra/data/templates/profiles.csv`
   - `infra/data/templates/coaches.csv`
   - `infra/data/templates/coach_details.csv`
   - `infra/data/templates/bookings.csv`
   - `infra/data/templates/clothing_recommendations.csv`
4. `python scripts/data/import_real_data.py --dry-run`으로 먼저 검증한 뒤 실제 import를 실행한다.
5. 웹 대시보드 배지가 `Supabase 실데이터`로 바뀌는지 확인한다.

## 3단계: 앱스토어/테스트 배포

1. 앱 이름, 부제, 설명, 키워드, 스크린샷을 한국어로 작성한다.
2. 개인정보처리방침과 이용약관 URL을 공개 도메인에 배포한다.
3. iOS/Android 번들 식별자와 서명 인증서를 확정한다.
4. TestFlight 또는 내부 테스트 트랙으로 먼저 배포한다.
5. 실제 심사 전 점검:
   - 영어 placeholder 없음
   - 로그인/회원가입 성공
   - 개인정보 삭제 요청 경로 명시
   - 데모 계정 정보 제출 가능
   - 카메라/사진 권한 설명 한국어 확인

## 4단계: 저작권 및 소프트웨어 등록

1. `docs/legal/evidence/hash_manifest.sha256`를 최신 상태로 생성한다.
2. `docs/legal/evidence/source_package_inventory.csv`로 소스 목록을 확인한다.
3. `docs/security/audit-notes.md`로 dependency audit 잔여 리스크를 설명한다.
4. 한국저작권위원회 프로그램 등록용 제출물을 준비한다.
   - 프로그램 명칭
   - 창작 연월일
   - 개발자/권리자 정보
   - 주요 기능 요약
   - 소스 일부 또는 전체 제출 범위
   - 해시/산출물 증빙

## 5단계: 운영 준비

1. 배포 도메인과 HTTPS를 연결한다.
2. Sentry 또는 유사한 오류 모니터링을 연결한다.
3. Supabase RLS 정책을 production 기준으로 재점검한다.
4. 관리자 API key를 production에서 필수로 설정한다.
5. 백업/복구 절차를 `docs/RELEASE_RUNBOOK.md`에 맞춰 리허설한다.

## 우선순위 결론

지금 바로 해야 할 순서는 다음과 같다.

1. 한국어 UI 최종 검수
2. Supabase production/staging 실데이터 연결
3. 지원금 제출용 5분 시연 영상 녹화
4. TestFlight 또는 내부 테스트 배포
5. 저작권/프로그램 등록 증빙 제출
