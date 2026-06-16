# Web And Mobile Consistency Checklist

Use this checklist before approving new UI work, Stitch output, Figma frames, or implementation PRs.

## Foundations

- [ ] New colors map to `design-tokens.md`.
- [ ] New spacing follows the 8px grid.
- [ ] Border radii follow the platform rules: 8px web admin, 12-14px mobile cards, pill only for badges/tags.
- [ ] Typography uses documented sizes and weights.
- [ ] Letter spacing remains `0`.
- [ ] Shadows are subtle and limited to cards/overlays.
- [ ] No decorative gradients, blobs, or one-off background effects were added.

## Web Admin

- [ ] Sidebar navigation clearly marks the active route.
- [ ] Desktop layout preserves the 248px sidebar and 32px main padding.
- [ ] Responsive layout stacks at narrow widths without overlapping controls.
- [ ] KPI cards, tables, filters, and charts use consistent header hierarchy.
- [ ] Tables support horizontal overflow instead of squeezing columns.
- [ ] Badges use success/warning/danger semantics consistently.
- [ ] Search and filter controls have clear focus states.
- [ ] Empty states exist for filtered or missing data.

## Mobile

- [ ] Top-level screens respect safe areas.
- [ ] Bottom tabs preserve active/inactive tint consistency.
- [ ] Touch targets are at least 44x44px.
- [ ] Forms and chat composers remain usable with the keyboard open.
- [ ] Cards do not nest inside other cards.
- [ ] Pull-to-refresh, loading, empty, error, and success states are covered where async data appears.
- [ ] Legacy blue accents are not expanded without an explicit exception.
- [ ] Profile, booking, diet, coach, and clothing flows use consistent card spacing and metadata hierarchy.

## Cross-Platform Behavior

- [ ] Food, health, and clothes loops use consistent naming across web and mobile.
- [ ] Booking status labels match across web and mobile: pending, confirmed, completed, cancelled, no-show where supported.
- [ ] KRW currency formatting is consistent.
- [ ] Asia/Seoul date/time expectations are preserved for examples and booking flows.
- [ ] Icon metaphors match current lucide icon usage.
- [ ] Critical actions use the same semantic tone across platforms.
- [ ] Destructive actions are clearly separated or styled as danger.
- [ ] Copy uses plain action language and avoids explaining obvious controls.

## Accessibility

- [ ] Web focus order follows visual order.
- [ ] Web buttons and icon buttons have accessible names.
- [ ] Color is not the only way status is communicated.
- [ ] Text contrast meets WCAG AA.
- [ ] Chart information is available through tooltip, label, legend, or summary.
- [ ] Mobile screen reader labels are planned for icon-only controls.
- [ ] Error messages describe recovery steps.

## Handoff

- [ ] Every design frame is named with its route or screen from `screen-inventory.md`.
- [ ] Component variants include default, active, hover/pressed, focus, disabled, loading, empty, error, and success states where relevant.
- [ ] Token exceptions are recorded.
- [ ] Implementation notes are scoped to specific files or components.
- [ ] Review blockers are listed separately from nice-to-have improvements.
