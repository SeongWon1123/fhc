# Design Tokens

These tokens normalize the existing web dashboard system and provide a target for future mobile cleanup. The web app already implements most core values as CSS variables in `apps/web/src/index.css`. The optional TypeScript mirror is available in `apps/web/src/design-tokens.ts`.

## Principles

- Prefer semantic roles over raw color names: `primary`, `surface`, `text-muted`, `danger`.
- Keep web admin surfaces calm and scan-friendly. Use green for FitConnect primary actions and health success, blue for secondary analytics/navigation accents.
- Keep mobile personal surfaces clear and energetic, but migrate new work to the same semantic token names.
- Use 8px radius for dense admin cards and 12-14px radius for consumer mobile cards when touch comfort matters.
- Do not introduce decorative gradients, floating background shapes, or one-off palettes.

## Color Tokens

| Token | Value | Usage |
| --- | --- | --- |
| `background` | `#f6f7f9` | Web app page background |
| `mobileBackground` | `#f9fafb` | Mobile screen background target |
| `surface` | `#ffffff` | Cards, tables, sidebars, modals |
| `surfaceMuted` | `#eef2f5` | Secondary buttons, subtle fills |
| `surfaceStrong` | `#dde7ee` | Stronger dividers or disabled fills |
| `border` | `#d7dee6` | Web borders |
| `mobileBorder` | `#e5e7eb` | Mobile borders |
| `text` | `#17212b` | Web primary text |
| `mobileText` | `#111827` | Mobile primary text |
| `textMuted` | `#667482` | Web secondary text |
| `mobileTextMuted` | `#6b7280` | Mobile secondary text |
| `primary` | `#13795b` | Canonical brand action, success, health |
| `primarySoft` | `#e1f4ed` | Primary selected state and soft badge |
| `secondary` | `#335c99` | Analytics, support metrics, secondary accent |
| `secondarySoft` | `#e5edf8` | Secondary selected state |
| `warning` | `#b86b00` | Pending states, caution |
| `warningSoft` | `#fff1d6` | Warning badge fill |
| `danger` | `#b42318` | Destructive states, failed status |
| `dangerSoft` | `#fee4e2` | Danger badge fill |
| `chartPurple` | `#7a4b9f` | Limited chart category accent |

## Legacy Mobile Alias

Mobile currently uses `#2563eb` and `#3b82f6` as primary blue interaction colors. Treat these as legacy aliases while migrating:

| Alias | Current Value | Target Role |
| --- | --- | --- |
| `legacyMobilePrimary` | `#2563eb` | Prefer `primary` for new brand actions; keep only where existing screens are untouched |
| `legacyMobilePrimaryAlt` | `#3b82f6` | Same as above |
| `legacyMobilePrimarySoft` | `#eff6ff` | Prefer `primarySoft` or `secondarySoft` by semantic role |

Do not add new raw `#2563eb` instances unless the work is explicitly preserving a legacy mobile screen.

## Typography

| Token | Web | Mobile | Usage |
| --- | --- | --- | --- |
| `fontFamily` | `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | system default | All app text |
| `pageTitle` | `30px / 1.2 / 700-800` | `26-28px / 1.2 / 800` | Top-level screen titles |
| `sectionTitle` | `18px / 1.3 / 700` | `18px / 1.3 / 800` | Section headings |
| `body` | `14-16px / 1.5-1.6 / 400` | `14-15px / 1.45 / 400` | Main content |
| `label` | `12-13px / 1.3 / 600-700` | `12-13px / 1.3 / 700` | Badges, labels, metadata |
| `stat` | `28px / 1.1 / 750` | `22px / 1.1 / 800` | KPI numbers |

Letter spacing should remain `0`. Do not scale type with viewport width.

## Spacing

Use an 8px base grid.

| Token | Value | Usage |
| --- | --- | --- |
| `space.1` | `4px` | Tight icon/text gaps |
| `space.2` | `8px` | Inline gaps, small stacks |
| `space.3` | `12px` | Button gaps, mobile chips |
| `space.4` | `16px` | Card padding, grid gaps |
| `space.5` | `20px` | Dense desktop panel padding |
| `space.6` | `24px` | Sidebar/header padding |
| `space.8` | `32px` | Desktop page padding |
| `space.10` | `40px` | Large vertical separation |
| `space.12` | `48px` | Empty states |

## Radius

| Token | Value | Usage |
| --- | --- | --- |
| `radius.sm` | `4px` | Chart bars, small indicators |
| `radius.md` | `8px` | Web cards, inputs, nav buttons |
| `radius.lg` | `12px` | Mobile option cards, forms |
| `radius.xl` | `14px` | Mobile summary/action cards |
| `radius.pill` | `999px` | Badges, tags, progress dots |

## Elevation

| Token | Value | Usage |
| --- | --- | --- |
| `shadow.card` | `0 1px 2px rgba(16, 24, 40, 0.05)` | Web cards and tables |
| `shadow.overlay` | `0 16px 40px rgba(16, 24, 40, 0.18)` | Future modal/dialog surfaces |

Keep shadows subtle. Do not use glow effects.

## Breakpoints And Layout

| Token | Value | Usage |
| --- | --- | --- |
| `breakpoint.mobile` | `600px` | Single-column content and compact controls |
| `breakpoint.tablet` | `900px` | Current web sidebar collapse and grid stack |
| `breakpoint.desktop` | `1200px` | Comfortable admin dashboard width |

Web admin layout:

- Sidebar width: `248px`.
- Desktop main padding: `32px`.
- Tablet/mobile main padding: `20px`.
- Stats grid: four columns on desktop, one column at `max-width: 900px`.
- Content grid: `1.4fr / 0.8fr`, stack at `max-width: 900px`.

Mobile layout:

- Screen horizontal padding: `16-24px` depending on density.
- Minimum touch target: `44px`.
- Bottom tab height: `64px` minimum.
- Cards should not be nested inside other cards.

## Component Tokens

| Component | Token Rule |
| --- | --- |
| Primary button | `primary` background, white text, `radius.md` web or `radius.lg` mobile, minimum height `40px` web / `44px` mobile |
| Secondary button | `surfaceMuted` or white background, text color `text`, visible border when grouped |
| Input | `surface` background, `border`, `radius.md`, focus outline using `primarySoft` and border `primary` |
| Badge success | `primary` text on `primarySoft` |
| Badge warning | `warning` text on `warningSoft` |
| Badge danger | `danger` text on `dangerSoft` |
| Card | `surface`, 1px `border`, `radius.md` web or `radius.xl` mobile, subtle card shadow on web |
| Table | Header uppercase labels, body `14px`, horizontal scroll on narrow screens |
| Navigation | Active item uses soft fill plus semantic accent text; inactive items use muted text |

## Chart Tokens

Use the chart order below for dashboards:

1. `primary` for bookings, health, completed, or main series.
2. `secondary` for users, coach supply, or comparison series.
3. `warning` for pending or revenue caution.
4. `chartPurple` only for extra categories when the first three are exhausted.

Charts should include tooltips, readable axes, and no decorative 3D effects.

## Implementation Notes

- Web: existing CSS variables are accepted implementation tokens.
- Web TypeScript: use `apps/web/src/design-tokens.ts` for future component-local style constants, chart colors, or shared docs tooling.
- Mobile: add a future `apps/mobile/src/theme/tokens.ts` before broad refactors. New mobile screens should consume the same semantic names from this document.
- Any token exception must be documented in the relevant screen or component PR.
