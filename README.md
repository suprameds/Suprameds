# Suprameds

Indian pharmaceutical eCommerce platform built with **Medusa.js v2** (from [Bloom](https://bloom.medusajs.com)) and **TanStack Start** storefront.

## Prerequisites

- **Node.js** ≥ 18 (backend recommends ≥ 20)
- **pnpm** 10.x (`npm install -g pnpm`, or use `npx pnpm` from the project root)
- **Supabase** account (database)
- **Docker** (for Redis via Docker Compose)

## Quick setup

### 1. Install dependencies

From the project root:

```bash
pnpm install
```

### 2. Supabase (database)

1. Create a project at [supabase.com](https://supabase.com).
2. In the dashboard go to **Project Settings → Database**.
3. Copy the **Connection string** (URI). Prefer **Connection pooling** (port `6543`) for better concurrency:
   - Format: `postgresql://postgres.[PROJECT_REF]:[YOUR_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`
4. In `apps/backend/.env` set (use the same URI for both):
   - `DATABASE_URL=<paste-connection-string>`
   - `POSTGRES_URL=<paste-connection-string>`

### 3. Redis (Docker Compose)

From the project root:

```bash
docker compose up -d
```

This starts Redis on `localhost:6379`. Backend `.env` already has `REDIS_URL=redis://localhost:6379`.

### 4. Environment

- **Backend** (`apps/backend/.env`) — Set `DATABASE_URL` and `POSTGRES_URL` from Supabase (see step 2). Redis URL points at Docker Redis.
- **Storefront** (`apps/storefront/.env`) — After the first backend run, get the **Publishable API Key** from Medusa Admin (Settings → Publishable API Keys) and set `VITE_MEDUSA_PUBLISHABLE_KEY`.

### 5. Database migrations

From the project root (or from `apps/backend`):

```bash
cd apps/backend
npx medusa db:migrate
```

### 6. Run the stack

**Option A — From root (both apps):**

```bash
pnpm dev
```

**Option B — Separate terminals:**

- Backend: `pnpm backend:dev` or `cd apps/backend && pnpm dev`
- Storefront: `pnpm storefront:dev` or `cd apps/storefront && pnpm dev`

- **Backend (Medusa + Admin):** http://localhost:9000  
- **Storefront:** http://localhost:5176 (or port in `apps/storefront/.env`)

### 7. Publishable API Key (storefront ↔ backend)

1. Open Admin: http://localhost:9000/app  
2. Go to **Settings → Publishable API Keys**  
3. Create or copy a key and set `VITE_MEDUSA_PUBLISHABLE_KEY` in `apps/storefront/.env`  
4. Restart the storefront dev server if it’s already running  

## Scripts

| Command | Description |
|--------|-------------|
| `pnpm dev` | Run backend + storefront in dev |
| `pnpm build` | Build all apps |
| `pnpm start` | Run built apps |
| `pnpm backend:dev` | Backend only (Medusa develop) |
| `pnpm storefront:dev` | Storefront only (Vite) |

## Project layout

- `apps/backend` — Medusa.js v2 (API, admin, custom modules: pharma, prescription, inventoryBatch)
- `apps/storefront` — TanStack Start (Vite + React) storefront

For design system, compliance, and conventions see **AGENTS.md**.
