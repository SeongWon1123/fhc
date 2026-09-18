# Backend ownership audit — api-fastapi vs api-node

Date: 2026-09-18
Scope: read-only investigation (no code changes). Requested because the backend
consolidation decision was deferred pending evidence.

## Question

Two backends exist (`services/api-fastapi`, `services/api-node`). Is the split
deliberate and load-bearing, or is one of them vestigial?

## Verdict

**The split is real and load-bearing. Do not merge them.** They own disjoint
route namespaces that nginx routes separately, and the Node service owns the one
capability FastAPI does not implement: long-lived WebSocket sessions.

## Evidence

### nginx routes the two services to disjoint path prefixes

`nginx/nginx.conf`:

| Location | Upstream | Owner |
| --- | --- | --- |
| `/api/v1/` | `api_fastapi` (`api:8000`) | core domain API |
| `/docs`, `/openapi.json` | `api_fastapi` | API schema |
| `/api/auth/` | `api_node` (`bff:3000`) | auth relay |
| `/api/notifications/` | `api_node` | notifications |
| `/api/realtime/` | `api_node` | realtime |
| `/socket.io/` | `api_node` (with `Upgrade`/`Connection` map) | WebSocket transport |
| `/` | `web_frontend` (`web:80`) | operator console |

There is no path served by both, and no path that falls through from one to the
other. Merging the services would mean re-implementing the `/socket.io/` upgrade
path and the `map $http_upgrade $connection_upgrade` handling inside FastAPI's
ASGI stack — a behavioral change, not a refactor.

### The Node service is small but not empty

`services/api-node` is 406 lines total across 6 files:

| File | Lines | Role |
| --- | --- | --- |
| `index.js` | 98 | Express app, Socket.IO server, middleware wiring |
| `config.js` | 64 | env handling |
| `routes/auth.js` | 129 | signup/login/refresh relay |
| `routes/notifications.js` | 63 | notification fan-out |
| `routes/realtime.js` | 28 | realtime session endpoints |
| `middleware/auth.js` | 24 | bearer-token guard |

### FastAPI is the domain authority

`services/api-fastapi/main.py` mounts five routers, all under `/api/v1`:
`coaches`, `bookings`, `diet`, `clothing`, `admin`. It owns Supabase access,
the demo fallback, and every table write in the product flow.

### The clients confirm the split

* `apps/mobile/src/lib/api.ts` points at `EXPO_PUBLIC_API_URL` (`/api/v1`) and
  attaches the Supabase access token itself — it talks to FastAPI directly and
  never calls the BFF for the main flow.
* `apps/mobile/.env.example` declares `EXPO_PUBLIC_BFF_URL=https://bff.example.com`,
  but **no application code reads it**. The mobile app currently has no caller
  for the auth/notifications/realtime routes.

## Findings worth acting on

1. **`EXPO_PUBLIC_BFF_URL` is declared but unused.** Either the notification and
   realtime features were never wired into the mobile app, or they were wired and
   later dropped. This is the only genuinely questionable part of the split —
   the BFF serves capability the shipping client does not consume.
2. **Auth is split across both services.** FastAPI validates bearer tokens via
   Supabase (`app/dependencies.py`), while the Node BFF has its own
   `middleware/auth.js` and its own `routes/auth.js`. Two token-validation paths
   for one identity means two places to keep correct.
3. **CORS origins are duplicated** with different lists: `api-node/index.js`
   allows `:3000, :5173, :8080`; FastAPI's `allowed_origins` defaults to
   `:3000, :5173`. Harmless today, a drift risk tomorrow.

## Recommendation

Keep both services. If consolidation is wanted later, the cheaper direction is
**the reverse of merging**: move FastAPI's token validation to defer to the BFF's
auth so there is one identity path, or drop the BFF entirely *including* its
notifications and realtime features (accepting the feature loss). Pick one
deliberately rather than merging codebases.

Before either: confirm whether push notifications and realtime session updates
are still planned for the app. If they are not, the BFF is dead weight and
deleting it is the honest cleanup — but that is a product decision, and it is
not mine to make.
