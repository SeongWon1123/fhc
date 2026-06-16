# FitConnect 보안 정책

기준일: 2026-06-04
문서 상태: 초안. 운영 배포 전 보안 책임자, 개인정보 보호책임자, 인프라 담당자의 검토가 필요합니다.

## 지원 범위

| 대상 | 상태 |
| --- | --- |
| `apps/mobile` Expo 앱 | MVP 개발 중 |
| `apps/web` 운영자 웹 | MVP 개발 중 |
| `services/api-fastapi` Core API | MVP 개발 중 |
| `services/api-node` BFF, Auth, Socket.IO | MVP 개발 중 |
| `infra/supabase` DB/RLS 스키마 | MVP 개발 중 |
| `nginx` reverse proxy | MVP 개발 중 |

운영 배포 전에는 릴리스 태그, 배포 환경, 지원 기간을 별도로 명시해야 합니다.

## 취약점 신고

보안 취약점, 개인정보 노출, 인증 우회, 권한 상승, service role key 노출 가능성, 결제/예약 조작 가능성을 발견하면 공개 이슈로 올리지 말고 아래 채널로 신고해 주세요.

- 보안 이메일: [security@example.com]
- 개인정보 이메일: [privacy@example.com]
- 긴급 연락: [담당자/전화 입력]

신고 시 가능한 범위에서 다음 정보를 포함해 주세요.

- 영향받는 URL, API, 앱 화면, 버전
- 재현 절차와 기대 결과/실제 결과
- 계정 권한, 테스트 데이터 범위
- 스크린샷 또는 로그. 단, 실제 비밀번호, 토큰, 건강정보, 결제정보는 포함하지 마세요.

## 대응 목표

| 심각도 | 예시 | 1차 확인 목표 | 조치 목표 |
| --- | --- | --- | --- |
| Critical | service role key 노출, 인증 우회, 대량 개인정보 열람 | 24시간 | 즉시 차단 후 핫픽스 |
| High | RLS 우회, 타인 예약/식단 조회, 토큰 로그 노출 | 48시간 | 7일 이내 수정 |
| Medium | 제한적 정보 노출, rate limit 우회, 관리자 화면 노출 | 5영업일 | 다음 릴리스 |
| Low | 보안 헤더 누락, 문서 오류, 낮은 영향의 설정 문제 | 10영업일 | 우선순위에 따라 처리 |

실제 운영 SLA는 출시 전 확정합니다.

## 기본 보안 원칙

- service role key는 서버 전용입니다. 웹, 모바일, 앱 번들, 로그, 오류 리포트, 클라이언트 저장소에 포함하지 않습니다.
- 클라이언트에는 Supabase anon key만 포함할 수 있으며, DB 접근은 RLS 정책으로 제한합니다.
- 운영 환경에서는 `ENABLE_DEMO_FALLBACK=false`를 강제합니다.
- 운영 CORS는 실제 도메인만 허용합니다.
- DB, Redis, Ollama, pgAdmin은 인터넷에 직접 공개하지 않습니다.
- 모든 외부 트래픽은 HTTPS를 사용합니다.
- 로그에는 토큰, 비밀번호, OAuth access token, service key, 음식 이미지 원본, 건강 관련 대화 원문을 저장하지 않습니다.
- 관리자 기능은 역할 기반 접근제어와 서버 측 검증을 모두 적용합니다.

## 개인정보 사고 대응

개인정보 유출 등이 의심되면 다음 순서로 대응합니다.

1. 노출 경로를 차단하고 증거 보존을 시작합니다.
2. 노출된 개인정보 항목, 대상자 수, 시점, 원인을 파악합니다.
3. service key, JWT secret, OAuth client secret 등 관련 시크릿을 즉시 교체합니다.
4. 영향받은 사용자에게 필요한 조치를 안내합니다.
5. 법령상 요건에 해당하는 경우 관계기관 신고와 정보주체 통지를 진행합니다.
6. 재발 방지 조치와 사후 보고서를 작성합니다.

개인정보보호위원회 안내 기준상 일정 요건에 해당하는 개인정보 유출 등은 72시간 이내 신고가 필요할 수 있습니다.

## 관련 문서

- [docs/security/security_checklist.md](docs/security/security_checklist.md)
- [docs/security/production_secret_handling.md](docs/security/production_secret_handling.md)
- [docs/legal/data_retention_deletion_policy.md](docs/legal/data_retention_deletion_policy.md)
- [PRIVACY_POLICY_DRAFT.md](PRIVACY_POLICY_DRAFT.md)
