# FitConnect Release Runbook

Baseline date: 2026-06-04

This runbook covers staging and production releases for the FitConnect MVP. It assumes Docker Compose based deployment and credential-free release artifacts. Runtime secrets must be supplied by the target host or deployment platform and must not be packaged.

## Release Gates

1. CI is green for web build/lint, mobile typecheck, FastAPI compile, BFF syntax, Docker Compose config, and release artifact packaging.
2. `docs/QA_RELEASE_CHECKLIST.md` has no blocker items open for the release scope.
3. A previous known-good release package and rollback owner are identified.
4. Production secrets are already available on the target host or injected by the platform.
5. Database backup or snapshot is complete for production.

## Local Verification

Run from the repository root:

```powershell
.\scripts\release\verify-local.ps1
```

If dependencies are already installed and a local process is holding files, rerun only the checks without reinstalling:

```powershell
.\scripts\release\verify-local.ps1 -SkipInstall
```

Equivalent individual checks:

```powershell
cd apps\web
npm ci
npm run lint
npm run build

cd ..\..\apps\mobile
npm ci
npm run typecheck

cd ..\..\services\api-node
npm ci
npm run syntax

cd ..\..
python -m compileall -q services\api-fastapi
docker compose -f docker-compose.yml config --quiet
```

## Version and Tag

Use semantic version tags with a leading `v`.

- Patch: backward-compatible fixes, for example `v1.0.1`.
- Minor: backward-compatible features, for example `v1.1.0`.
- Major: breaking API, data, or deployment changes, for example `v2.0.0`.
- Staging candidates can use release candidate tags such as `v1.1.0-rc.1`.

Tag only after release gates pass:

```powershell
git fetch --tags
git status --short
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

Pushing a `v*` tag runs CI and uploads a release package artifact.

## Artifact Packaging

PowerShell:

```powershell
$env:RELEASE_VERSION = "v1.0.0"
$env:RELEASE_STAGE = "staging"
.\scripts\release\package-artifacts.ps1
```

Bash:

```bash
RELEASE_VERSION=v1.0.0 RELEASE_STAGE=staging bash scripts/release/package-artifacts.sh
```

Artifacts are written to `dist/release/` by default and include `RELEASE_MANIFEST.txt`.

The package includes:

- `docker-compose.yml`, `.env.example`, and `nginx/`.
- Infra seed/template files and helper scripts, excluding local PostgreSQL runtime data.
- Web, FastAPI, and BFF source required for Docker image builds.
- Release scripts and QA/release documentation.

The package excludes `.env`, `node_modules`, virtual environments, build caches, local database data, and cloud credentials.

## Staging Deployment

1. Copy the release archive to the staging host using the approved team process.
2. Extract the archive into a new release directory.
3. Supply staging `.env` values outside the package.
4. Validate Compose:

```powershell
docker compose -f docker-compose.yml config --quiet
```

5. Build and start:

```powershell
docker compose -f docker-compose.yml up -d --build
```

6. Verify health:

```powershell
docker compose ps
curl http://localhost:8088/health
curl http://localhost:8088/api/health/fastapi
curl http://localhost:8088/api/health/node
```

7. Run the staging subset of `docs/QA_RELEASE_CHECKLIST.md`.

## Production Deployment

Production uses the same package and commands as staging, with production `.env` values injected outside the package.

Before production:

- Confirm database backup or snapshot completion.
- Confirm `ALLOWED_ORIGINS` contains only production domains.
- Confirm `JWT_SECRET`, Supabase keys, database credentials, and Redis settings are production values.
- Confirm externally exposed ports and TLS/reverse proxy rules are handled by the production host.

Deploy:

```powershell
docker compose -f docker-compose.yml config --quiet
docker compose -f docker-compose.yml up -d --build
docker compose logs -f --tail 100 web api bff nginx
```

Monitor production health and critical user flows for at least 30 minutes.

## Rollback

Rollback uses the previous known-good package and its matching runtime configuration.

1. Record the failing version, symptoms, and first bad timestamp.
2. Stop the current release:

```powershell
docker compose -f docker-compose.yml down
```

3. Switch to the previous release directory or extract the previous archive.
4. Restore the matching `.env` or platform-injected variables.
5. Start the previous release:

```powershell
docker compose -f docker-compose.yml up -d --build
```

6. Verify health endpoints and the critical user flow.
7. If database changes were released, use the pre-approved rollback SQL or restore procedure. Do not improvise destructive database changes during incident response.

## Release Notes Template

```markdown
## Version
vX.Y.Z

## Commit
<commit-sha>

## Scope
- <change>

## Verification
- Web build/lint: pass
- Mobile typecheck: pass
- FastAPI compile: pass
- BFF syntax: pass
- Docker Compose config: pass
- QA checklist: <link or owner>

## Rollback
Previous known-good package: <version>
Database rollback: <none / script / restore point>
```
