# Stitch Handoff Guide

The Stitch MCP is not available in this session. Use this document for manual Stitch setup and prompt handoff.

## What To Import

Provide Stitch with:

- `docs/design/design-tokens.md`
- `docs/design/screen-inventory.md`
- `docs/design/ux-acceptance-criteria.md`
- Current app screenshots when available
- Route names and screen names exactly as listed in the inventory

Do not ask Stitch to replace production code directly. Use Stitch output as a visual and interaction spec, then implement manually in the repo with scoped changes.

## Manual Stitch Workflow

1. Create a new Stitch project named `FitConnect UI UX Handoff`.
2. Add the canonical product context from the prompt below.
3. Generate web admin frames first, then mobile app frames, then a component/state board.
4. Compare output against the tokens and acceptance criteria.
5. Export frames or specs into Figma if the team needs collaborative review.
6. Record any deviations in the handoff notes before implementation.

## Base Context Prompt

```text
Design a production UI/UX system for FitConnect, a food, health, and clothes platform. The product has a web admin dashboard for operations and a mobile app for users. The web surface should feel calm, data-dense, trustworthy, and operational. The mobile surface should feel personal, clear, and task-forward.

Use these semantic tokens:
- background #f6f7f9, mobileBackground #f9fafb
- surface #ffffff, surfaceMuted #eef2f5, border #d7dee6
- text #17212b, mobileText #111827, textMuted #667482, mobileTextMuted #6b7280
- primary #13795b, primarySoft #e1f4ed
- secondary #335c99, secondarySoft #e5edf8
- warning #b86b00, warningSoft #fff1d6
- danger #b42318, dangerSoft #fee4e2
- chartPurple #7a4b9f

Use Inter/system sans typography, 8px spacing grid, 8px radius for web admin cards and controls, 12-14px radius for mobile cards, and subtle card borders. Avoid decorative gradients, background blobs, marketing hero layouts, and nested cards. Use icons in controls where helpful, but keep primary navigation labeled.
```

## Web Admin Prompt

```text
Create web admin dashboard frames for FitConnect at 1440x1024 and a responsive 390x844 version.

Screens:
1. Operations Overview route /dashboard: fixed desktop sidebar with FitConnect identity, KPI cards for Members, Coaches, Bookings, Revenue, recent bookings table, clothing recommendation feed, and a source badge for Supabase live data, demo fallback source, or no connected data.
2. Coach Management route /coaches: search by name/specialty/city, verified count badge, coach table with name, specialty, location, rating, bookings, price, status, and approve/reject actions for pending coaches.
3. Bookings route /bookings: status filter segmented buttons for all/pending/confirmed/completed/cancelled, booking table with ID, member, coach, scheduled time, session type, status, and revenue.
4. Member Directory route /members: member search, table with member/email, goal, join date, active status.
5. Analytics route /analytics: KPI cards, growth velocity bar chart, ecosystem mix pie chart and legend.

Use the semantic tokens from the base prompt. Keep the experience dense and operational, not decorative. Show loading, empty, and error examples in a separate state board.
```

## Mobile App Prompt

```text
Create mobile app frames for FitConnect at 390x844.

Screens:
1. Login: email/password form, loading submit, readable auth error state.
2. Onboarding: three-step flow for fitness goal, preferred sports, and profile name with progress dots.
3. Home: greeting, Today summary card with booking/meals/plan fit, primary "Ask diet coach" action, recommended coach cards, diet log and training gear action cards.
4. Coach List: searchable coach results with coach cards, loading, empty, and pull-to-refresh states.
5. Coach Detail: coach profile header, rating, location, verification, specialty, price, booking CTA, and secondary share action.
6. Booking: date selector, time chips, session type options, booking summary, confirm CTA, validation and success/error states.
7. Booking List: user bookings with pending/confirmed/completed/cancelled/no-show states.
8. Diet Chat: assistant/user bubbles, composer, camera icon, send state, recommendation log CTA.
9. Diet Log: date selector, meal log cards, empty day state, add meal CTA.
10. Clothing: category filters, gear recommendation cards with item, sport/category, price, and external link affordance.
11. Profile: avatar/profile summary, goal/sports metadata, menu rows, logout action.

Use the same semantic token names as web. If using the current mobile blue accent, label it as a legacy alias and keep it consistent within the mobile frames. Ensure 44px minimum touch targets and keyboard-safe form/composer layouts.
```

## Component And State Board Prompt

```text
Create a FitConnect component/state board covering:
- Primary, secondary, outline, destructive, disabled, and loading buttons
- Text input default, focused, error, disabled
- Search input with icon
- Status badges: success, warning, danger, neutral
- KPI stat card with icon and trend badge
- Coach card, booking card, diet log card, clothing card
- Admin data table row states and empty table state
- Mobile bottom tab navigation active/inactive
- Loading, empty, error, and success feedback patterns

Label each component with the semantic tokens used. Use 8px grid spacing and ensure text fits inside every component.
```

## Stitch Review Checklist

- Every generated color maps back to a documented token or a recorded exception.
- Web dashboard has no marketing hero section and no decorative background effects.
- Mobile screens preserve safe areas, bottom tabs, and keyboard-safe inputs.
- Data tables remain readable and horizontally manageable on narrow screens.
- Empty/loading/error states are present, not implied.
- Component state board covers web and mobile variants.
- Any use of legacy mobile blue is intentional and documented.

## Handoff Output Format

For each Stitch-generated set, capture:

- Project/frame URL
- Generated date
- Prompt version used
- Screens included
- Token deviations
- Open product questions
- Implementation notes for web
- Implementation notes for mobile
