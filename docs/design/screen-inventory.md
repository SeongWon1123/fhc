# Screen Inventory

This inventory reflects the current product surfaces in `apps/web` and `apps/mobile`. Use it to scope Stitch/Figma work and to prevent design drift between web admin and mobile user experiences.

## Web Admin App

| Route | Screen | Primary Jobs | Current Components | Required States |
| --- | --- | --- | --- | --- |
| `/dashboard` | Operations Overview | Monitor members, coaches, bookings, revenue, recent bookings, and clothing feed | Sidebar, StatsCard, BookingTable, clothing feed card, badges | Loading, demo-data indicator, empty recent bookings, responsive stacked grids |
| `/coaches` | Coach Management | Search coaches, review specialties/location/rating, approve or reject pending coach profiles | Search input, CoachTable, status badges, action buttons | Empty search, pending/verified states, approve/reject feedback, keyboard focus |
| `/bookings` | Bookings | Filter sessions by status and inspect member/coach/time/revenue | Status segmented buttons, BookingTable, badges | All/pending/confirmed/completed/cancelled filters, empty filtered result, horizontal overflow |
| `/members` | Member Directory | Search members and inspect onboarding goal, join date, active status | Search input, table, goal/date icon cells, badge | Empty search, long email/name wrapping behavior, mobile table scroll |
| `/analytics` | Analytics | Review KPI totals, growth velocity, ecosystem mix | StatsCard, Recharts bar chart, pie chart, legend rows | Empty chart data, tooltip accessibility, mobile chart sizing |

## Web Shared Components

| Component | Role | Notes |
| --- | --- | --- |
| `Sidebar` | Persistent admin navigation and product identity | Fixed desktop rail, full-width stacked mobile header at `900px` |
| `StatsCard` | KPI summary | Uses semantic tone props: primary, secondary, warning, danger |
| `BookingTable` | Booking data table | Currency and date locale currently use Korean formatting |
| `CoachTable` | Coach moderation table | Contains approve/reject actions for unverified coaches |
| Badges | Status and metadata | Success, warning, danger classes map to semantic tokens |
| Toolbar | Search/filter control row | Stacks vertically on narrow screens |

## Mobile App

| Navigator | Screen | Primary Jobs | Current Components | Required States |
| --- | --- | --- | --- | --- |
| Auth | Login | Authenticate a user and route to onboarding or main app | Input, Button, Supabase auth | Loading, auth error, invalid email/password, keyboard-safe layout |
| Auth | Onboarding | Capture goal, sports, and profile name | Option cards, sport tags, progress dots, Button/Input | Step validation, selected/unselected options, back/continue/finish loading |
| Main Tab | Home | Summarize today's plan and route to diet, coaches, and clothes | Summary card, CoachCard, action cards | API-driven coaches, loading, empty state, personalized greeting fallback |
| Coach Stack | Coach List | Search/filter available coaches and open details | Search input, CoachCard, pull-to-refresh | Loading, refreshing, empty results, API fallback |
| Coach Stack | Coach Detail | Review coach profile and book a session | Header, profile summary, detail cards, CTA buttons | Missing route params, loading, verified state, booking CTA |
| Coach Stack | Booking | Select date/time/session type and confirm | Calendar, time chips, session options, booking summary | Date/time validation, unavailable slots, submit loading, error/success |
| Coach Stack | Booking List | Review user's bookings | BookingCardComponent, list header, refresh | Loading, refreshing, empty bookings, cancelled/no-show status |
| Diet Stack | Diet Chat | Ask AI diet coach and save/review recommendations | ChatBubble, input composer, log CTA | Sending, empty chat, API failure fallback, keyboard-safe composer |
| Diet Stack | Diet Log | Browse and add diet logs by date | DietLogCard, date row, add buttons | Loading, refreshing, empty day, add meal action |
| Main Tab | Clothing | Browse training gear recommendations by category | ClothingCard, category filter chips, refresh | Loading, refreshing, empty category, external link state |
| Main Tab | Profile | Review user profile and account actions | Profile header, menu rows, Button | Missing profile fields, logout loading/error, safe-area layout |

## Mobile Shared Components

| Component | Role | Notes |
| --- | --- | --- |
| `Button` | Primary, secondary, outline, disabled, loading actions | Currently uses legacy blue; migrate future work to semantic primary |
| `Input` | Labeled form control with errors | Preserve visible label and error text |
| `Loading` | Activity indicator with optional message | Use for full-screen fetch states |
| `CoachCard` | Coach preview | Supports verified, rating, location, price metadata |
| `BookingCardComponent` | Booking preview | Covers pending, confirmed, completed, cancelled, no-show statuses |
| `DietLogCard` | Meal log preview | Meal type accent colors need token mapping before expansion |
| `ChatBubble` | User/assistant message display | Must handle long messages and multiline text |
| `ClothingCard` | Gear recommendation preview | Needs image/placeholder and external link affordance |

## Priority Handoff Frames

Create these first in Stitch/Figma:

1. Web dashboard desktop: `/dashboard`, 1440x1024.
2. Web coach moderation desktop: `/coaches`, 1440x1024.
3. Web bookings responsive narrow: `/bookings`, 390x844.
4. Mobile onboarding flow: three frames at 390x844.
5. Mobile home, coach detail, booking, diet chat, clothing, profile: 390x844.
6. Component/state board: buttons, inputs, badges, tables, cards, empty/loading/error states.

## Content And Locale Notes

- Current product copy is English with Korean locale formatting for date/currency.
- Currency displays KRW with no fractional digits.
- Time zone should remain Asia/Seoul for booking examples.
- If a Korean-language UI pass is requested later, treat it as a separate localization task and preserve line-length checks.
