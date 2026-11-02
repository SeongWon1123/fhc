// Canonical mobile subset of docs/design/design-tokens.md.
export const tokens = {
  color: {
    background: '#f9fafb', surface: '#ffffff', mutedSurface: '#eef2f5',
    border: '#e5e7eb', text: '#111827', mutedText: '#667482',
    primary: '#13795b', primarySoft: '#e1f4ed', secondary: '#335c99',
    secondarySoft: '#e5edf8', warning: '#b86b00', warningSoft: '#fff1d6',
    danger: '#b42318', dangerSoft: '#fee4e2',
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, section: 32 },
  radius: { input: 8, card: 14, pill: 999 },
  font: { title: 28, section: 18, body: 17, secondary: 15, label: 13 },
} as const;
