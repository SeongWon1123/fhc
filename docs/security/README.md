# FitConnect 보안 문서

기준일: 2026-06-04

| 문서 | 목적 |
| --- | --- |
| [../../SECURITY.md](../../SECURITY.md) | 보안 정책, 취약점 신고, 사고 대응 기준 |
| [security_checklist.md](security_checklist.md) | MVP 출시 전 보안 체크리스트 |
| [production_secret_handling.md](production_secret_handling.md) | 운영 시크릿 관리와 회전 지침 |

## 출시 전 P0

- [ ] 운영 `ENABLE_DEMO_FALLBACK=false`
- [ ] service role key 클라이언트 번들 미포함 검증
- [ ] Supabase RLS 역할별 테스트 통과
- [ ] 관리자 화면 서버 측 권한 검증
- [ ] HTTPS, CORS, rate limit 운영 설정 완료
- [ ] 개인정보 유출 대응 담당자와 72시간 신고 판단 절차 확정
