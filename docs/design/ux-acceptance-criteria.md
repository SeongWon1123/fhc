# UX Acceptance Criteria

Use these criteria to review implementation, Stitch outputs, Figma frames, and QA builds before release.

## Global Criteria

- Navigation exposes the user's current location on every screen.
- Primary tasks are reachable within one clear action from each top-level screen.
- All interactive controls have visible hover/focus/pressed/disabled/loading states where the platform supports them.
- Text never overlaps, clips, or requires viewport-scaled font sizes to fit.
- Color contrast meets WCAG AA for body text and controls.
- Web keyboard navigation reaches every interactive element in a logical order.
- Mobile touch targets are at least 44x44px.
- Loading, empty, error, and success states are designed for each async surface.
- Copy is action-oriented and avoids explaining obvious UI behavior.
- Icons support recognition but do not replace necessary labels for primary navigation.
- Charts remain legible at desktop and narrow widths, with tooltips and non-color-only interpretation where possible.
- Tables support horizontal overflow on narrow screens without breaking page layout.
- Dates, times, and KRW amounts are formatted consistently.
- Demo fallback data is visibly labeled when active in development or judging demos.

## Web Admin Criteria

### Operations Overview

- Four KPI cards are visible above the fold on desktop and stack cleanly on mobile.
- Recent bookings table preserves member, coach, time, status, and revenue columns.
- Clothing recommendation feed remains secondary and does not compete with KPI hierarchy.
- Demo-data badge is visible but not styled as an error or warning.

### Coach Management

- Search works by name, specialty, and city.
- Verified count reflects the current list state after approval actions.
- Pending coaches expose both approve and reject actions.
- Verified coaches show "No action" or equivalent non-interactive status.
- Empty search results include a clear empty state.

### Bookings

- Status filters clearly show the active filter.
- Filter labels match booking status values.
- Empty filtered results do not leave an ambiguous blank table.
- Long booking IDs remain readable through truncation or monospaced formatting.

### Member Directory

- Search covers name, email, and goal.
- Long names or emails do not break table layout.
- Fitness goals are visually distinct from account status.
- Join dates are formatted consistently.

### Analytics

- KPI totals match source data.
- Bar and pie charts use the chart token order.
- Charts preserve axis labels and tooltip readability at tablet widths.
- Ecosystem mix legend matches slice colors.

## Mobile Criteria

### Login

- Form fields remain visible when the keyboard is open.
- Authentication errors are user-readable and do not expose raw system details.
- Submit button shows loading and prevents duplicate submissions.

### Onboarding

- Progress indicator clearly maps to the three steps.
- Step 1 requires a goal.
- Step 2 requires at least one sport.
- Step 3 requires a non-empty profile name.
- Back and continue controls preserve selected values.

### Home

- Greeting handles missing user names.
- Today's summary card remains scannable before recommendations.
- Recommended coaches show loading and API fallback behavior.
- Diet and clothing action cards are visually balanced and tappable.

### Coach List And Detail

- Search/filter input remains accessible and does not obscure results.
- Coach cards include name, specialty, rating, location, verification, and price.
- Detail view handles missing coach data with a recoverable state.
- Booking CTA is prominent and visually distinct from secondary actions.

### Booking

- Date, time, and session type selection states are obvious.
- Confirm action is disabled or blocked until required selections are complete.
- Booking summary updates when selections change.
- Success and failure feedback clearly explain the next step.

### Diet Chat And Diet Log

- Chat bubbles wrap long messages and preserve sender distinction.
- Composer remains usable with the keyboard open.
- Sending state prevents duplicate messages.
- Diet logs have empty day and add meal states.

### Clothing

- Category filters are clear and horizontally usable.
- Product cards show item, sport/category context, price, and link affordance.
- Empty categories show a recovery path.

### Profile

- Missing profile fields use neutral fallback copy.
- Logout is visually destructive or clearly separated from ordinary menu actions.
- Menu rows preserve icon, label, detail, and chevron alignment.

## Design Handoff Done Criteria

- Token values are named and attached to every major color, spacing, radius, and type decision.
- Each frame references its route/screen name from `screen-inventory.md`.
- At least one desktop and one mobile responsive/narrow frame are reviewed.
- Component states include default, hover/pressed, focus, disabled, loading, empty, error, and success where relevant.
- Open questions and intentional deviations are listed in the handoff notes.
