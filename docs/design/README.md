# FitConnect UI/UX Handoff Package

Last updated: 2026-06-04

This folder is the production UI/UX package for FitConnect across web admin and mobile consumer surfaces. It is designed to work without the Stitch MCP in this session: the docs provide canonical tokens, screen inventory, acceptance criteria, manual Stitch prompts, Figma/Canva fallback steps, and cross-platform consistency checks.

## Package Map

- [design-tokens.md](./design-tokens.md) defines the canonical visual system, semantic roles, component rules, and platform migration notes.
- [screen-inventory.md](./screen-inventory.md) inventories current web and mobile screens, primary flows, components, states, and handoff priorities.
- [ux-acceptance-criteria.md](./ux-acceptance-criteria.md) defines done criteria for global UX quality and each production surface.
- [stitch-handoff.md](./stitch-handoff.md) provides manual import guidance and prompt blocks for Stitch when MCP access is unavailable.
- [figma-canva-fallback.md](./figma-canva-fallback.md) explains how to continue the design handoff in Figma or Canva if Stitch cannot be used.
- [consistency-checklist.md](./consistency-checklist.md) is the final QA checklist for web, mobile, and cross-platform review.

## Source Of Truth

Use these files as the source of truth for new UI work:

1. Token decisions live in `docs/design/design-tokens.md`.
2. The optional TypeScript token object lives in `apps/web/src/design-tokens.ts`.
3. Current web CSS variables in `apps/web/src/index.css` are treated as implemented web tokens.
4. Current mobile colors are mostly inline React Native values; new mobile work should migrate toward the canonical tokens rather than adding more one-off values.

## Product Positioning

FitConnect combines three connected loops:

- Food: diet chat, diet logs, meal guidance, and nutrition planning.
- Health: coach discovery, booking, profile goals, and workout support.
- Clothes: training gear recommendations aligned to sport, workout type, and user needs.

The design language should feel operationally trustworthy on web and personal, clear, and task-forward on mobile. Avoid marketing-style decoration in admin surfaces. Use data density, predictable navigation, accessible controls, and obvious system status.

## Scope Boundary

This package intentionally avoids broad app rewrites. It documents the current screens and supplies handoff-ready tokens and criteria. Future implementation can adopt the token module incrementally, starting with new components or isolated refactors.
