# Fix Railway Deployments — Design Spec

**Date**: 2026-04-08
**Status**: Approved

## Problem

Deployments have been failing in a cascading "fix-forward" pattern — 15+ commits pushed directly to main, each discovering the next failure only after Railway deploys. Five root causes:

1. **8 missing VITE_* build args** in `Dockerfile.storefront` — Vite bakes env vars at build time, so missing ARGs = `undefined` in production JS
2. **CI only passes 2/21 build args** — Docker build in CI doesn't catch missing vars
3. **docker-compose.yml only has 5/21 build args** — can't test locally with full config
4. **No railway.toml** — removed in commit 3710abc, Railway uses dashboard-only config
5. **600s healthcheck start-period** — takes 10 minutes to detect boot failures

## Approach

Fix Railway deployment within its constraints (no platform migration). Eight changes across 9 files.

### 1. Add 8 missing ARG declarations to Dockerfile.storefront

The storefront code references 21 `VITE_*` vars via `import.meta.env`. The Dockerfile only declares 13 as `ARG`. Railway can only inject vars that have matching `ARG` declarations. Missing:

- `VITE_GTM_ID`, `VITE_META_PIXEL_ID`, `VITE_SITE_URL`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_MEDUSA_PRODUCTION_URL`, `VITE_CAPACITOR`, `VITE_APP_VERSION`

All go in Stage 2 (build) only — Vite inlines them into the bundle at compile time.

### 2. Reduce healthcheck start-periods

- Storefront: 600s → 60s (pure Node.js, boots in <10s)
- Backend: 600s → 180s (runs migrations, but 3 min is plenty)

### 3. Re-add railway.toml

Minimal file with restart policy. Service-specific config (dockerfilePath, healthcheckPath) stays in Railway dashboard since it differs per service.

### 4. Fix docker-compose.yml

Replace 5 hardcoded build args with all 21 using `${VAR:-default}` interpolation. Add `env_file` directive pointing to `.env.storefront`.

### 5. Fix CI workflow

- Storefront job: add all 21 VITE_* vars with CI placeholders
- Docker build job: pass all 21 build args with placeholders

### 6. Local Docker test script

`scripts/test-deploy.sh` — loads env vars, builds both Docker images, reports success/failure without pushing to GitHub.

### 7. Env template

`.env.storefront.example` with all 21 keys documented. Add `.env.storefront` to `.gitignore`.

### 8. Branch strategy

Document in CLAUDE.md: push to `development` first for staging, merge to `main` for production.

## Files Modified

| File | Change |
|------|--------|
| `Dockerfile.storefront` | Add 8 ARGs, reduce healthcheck to 60s |
| `Dockerfile.backend` | Reduce healthcheck to 180s |
| `railway.toml` | New — restart policy |
| `docker-compose.yml` | All 21 build args via interpolation |
| `.github/workflows/ci.yml` | All 21 env vars + build args |
| `scripts/test-deploy.sh` | New — local Docker build test |
| `.env.storefront.example` | New — template for storefront vars |
| `.gitignore` | Add `.env.storefront` |
| `CLAUDE.md` | Document branch strategy |

## Alternatives Considered

- **Coolify on VPS**: Better local/prod parity, cheaper ($5/mo), but requires server maintenance
- **Fly.io**: Better build arg support, free tier, but platform migration overhead

Both rejected in favor of fixing Railway since infrastructure is already set up.
