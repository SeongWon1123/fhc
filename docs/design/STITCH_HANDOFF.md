# FitConnect Stitch UI/UX handoff

기준일: 2026-06-04

현재 Codex 세션에는 Stitch MCP/커넥터가 없습니다. 따라서 Stitch에 붙여 넣거나 가져갈 수 있는 화면 명세, 디자인 토큰, 프롬프트를 이 문서로 관리합니다.

## 1. 제품 톤

- 신뢰감 있는 Health & Fitness 운영 도구
- 의료 앱처럼 과도하게 임상적이지 않지만, 건강정보를 다루므로 차분하고 명확해야 함
- 과장된 AI 표현보다 코치/예약/식단 기록의 실용성을 우선

## 2. 디자인 토큰

```json
{
  "color": {
    "background": "#F6F7F9",
    "surface": "#FFFFFF",
    "border": "#D7DEE6",
    "text": "#17212B",
    "muted": "#667482",
    "primary": "#13795B",
    "secondary": "#335C99",
    "warning": "#B86B00",
    "danger": "#B42318"
  },
  "radius": {
    "card": 8,
    "control": 8,
    "pill": 999
  },
  "spacing": {
    "xs": 4,
    "sm": 8,
    "md": 16,
    "lg": 24,
    "xl": 32
  }
}
```

## 3. Stitch 프롬프트

```text
Design a production-ready FitConnect health and fitness app interface.
The product combines coach booking, AI nutrition logs, and sport-specific clothing recommendations.
Use a calm operational style, not a marketing landing page.
Primary color #13795B, secondary #335C99, 8px card radius, dense but readable layouts.
Screens: onboarding/login, home dashboard, coach list, coach detail, booking create, booking list, diet chat, diet log, clothing recommendation, profile/privacy settings.
Include empty, loading, error, and offline states.
Do not imply medical diagnosis. Add concise health disclaimer where nutrition AI appears.
```

## 4. UX acceptance checklist

- [ ] 로그인 전/후 상태가 명확하다.
- [ ] 네트워크 실패 시 사용자가 다음 행동을 알 수 있다.
- [ ] 식단 AI 화면에 의료 면책 문구가 있다.
- [ ] 예약 생성 전 가격, 시간, 코치, 취소 정책이 확인된다.
- [ ] 의류 추천은 광고/제휴 여부를 표시한다.
- [ ] 개인정보 삭제/문의 경로가 프로필에 있다.
- [ ] 작은 화면에서 테이블 대신 카드/리스트를 사용한다.
