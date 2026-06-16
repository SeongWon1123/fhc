# Figma And Canva Fallback

Use this when Stitch is unavailable or when the team needs a collaborative artifact outside Stitch.

## Figma Fallback

Figma is the preferred fallback for production UI specs.

### Setup

- File name: `FitConnect UI UX Handoff`
- Pages:
  - `00 Cover`
  - `01 Foundations`
  - `02 Web Admin`
  - `03 Mobile App`
  - `04 Components And States`
  - `05 Review Notes`
- Frame sizes:
  - Web desktop: `1440x1024`
  - Web narrow: `390x844`
  - Mobile: `390x844`
  - Component board: `1440x1024`

### Foundation Styles

Create Figma local styles from `design-tokens.md`:

- Color styles for all semantic colors.
- Text styles for page title, section title, body, label, stat.
- Effect styles for card and overlay shadows.
- Variables for spacing and radius if the team's Figma plan supports variables.

### Components

Create reusable components for:

- Sidebar navigation item
- Mobile tab item
- Button variants
- Input/search input
- Badge variants
- Stat card
- Admin table header/body rows
- Coach card
- Booking card
- Diet log card
- Clothing card
- Empty/loading/error feedback

Name components by platform and role, for example:

```text
Web/Nav/SidebarItem
Web/Data/StatCard
Mobile/Card/Coach
Shared/Form/Button
Shared/Status/Badge
```

### Review Process

1. Build foundation styles first.
2. Create component board with all states.
3. Assemble priority screens from `screen-inventory.md`.
4. Check every frame against `ux-acceptance-criteria.md`.
5. Annotate unresolved product or engineering questions on `05 Review Notes`.

## Canva Fallback

Canva is acceptable for stakeholder review, concept presentation, or lightweight handoff notes. It should not replace Figma as the production source of truth for component specs.

Use Canva for:

- Executive summary deck of the design direction.
- Before/after comparison slides.
- Stakeholder review with screenshots and annotations.
- Moodboard for brand tone if a visual refresh is requested.

Avoid using Canva for:

- Precise component variants.
- Token naming and implementation specs.
- Responsive layout redlines.
- Accessibility annotation source of truth.

### Canva Structure

Create a presentation with:

1. Product context and goals.
2. Token palette and typography summary.
3. Web admin key screens.
4. Mobile app key screens.
5. Component/state examples.
6. Open questions and release checklist.

## Asset Export Notes

- Export UI specs as PNG only for review snapshots.
- Do not export text or icon assets from mockups unless they are final brand assets.
- Use lucide icons in implementation to match the current app stack.
- Keep screenshots dated and tied to route/screen names.

## Fallback Decision Rule

- Use Stitch when rapid AI-assisted frame generation is available.
- Use Figma when production implementation specs or collaborative review are needed.
- Use Canva when non-design stakeholders need a concise narrative review.
