# Dependency Audit Notes

Generated: 2026-06-04

## Current Gate

The MVP release gate is `npm audit --omit=dev --audit-level=high` for JavaScript production dependencies.

- Web admin: passes with 0 vulnerabilities after updating `react-router-dom`/`vite` via `npm audit fix`.
- Node BFF: passes the high-severity gate after `npm audit fix`.
- Mobile app: passes the high-severity gate.

## Residual Moderate Findings

These findings remain below the current release-blocking threshold and require breaking dependency upgrades:

- Node BFF: transitive `uuid` findings through `firebase-admin` / Google Cloud packages. `npm audit fix --force` would install `firebase-admin@10.3.0`, which is a breaking downgrade from the current major line.
- Mobile app: Expo transitive findings in `postcss`, `uuid`, `ws`, `yaml`, and `brace-expansion`. Full forced remediation requires an Expo major upgrade, currently reported as `expo@56.0.8`.

## Remediation Plan

1. Keep high-severity audit failure as the release blocker.
2. Upgrade Expo and Firebase/Admin dependency chains in a dedicated compatibility branch.
3. Re-run mobile typecheck, native prebuild checks, BFF syntax checks, and Docker smoke tests before promoting those upgrades.
