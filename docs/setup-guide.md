# Setup Guide

## Prerequisites

- **Node.js** >= 20 ([download](https://nodejs.org))
- **pnpm** >= 10 (`corepack enable && corepack prepare pnpm@10 --activate`)
- **Docker** and Docker Compose ([download](https://docker.com))
- **PostgreSQL** via Supabase, Neon, or local install

## Local Development

### 1. Clone and Install

```bash
git clone https://github.com/suprameds/Suprameds.git
cd Suprameds
pnpm install
```

### 2. Start Redis

```bash
docker compose up -d
```

Starts Redis 7 on `localhost:6379` with persistence enabled.

### 3. Configure Backend Environment

```bash
cp apps/backend/.env.example apps/backend/.env
```

**Required variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | JWT signing key (32+ chars) | `supersecret-jwt-key-minimum-32chars` |
| `COOKIE_SECRET` | Session cookie key | `cookie-secret-key` |
| `REDIS_URL` | Redis connection (optional) | `redis://localhost:6379` |

**Optional but recommended:**

| Variable | Description |
|----------|-------------|
| `RAZORPAY_TEST_KEY_ID` | Razorpay test mode key |
| `RAZORPAY_TEST_KEY_SECRET` | Razorpay test mode secret |
| `RESEND_API_KEY` | Email via Resend |
| `MSG91_AUTH_KEY` | SMS OTP via MSG91 |
| `PHI_ENCRYPTION_KEY` | 64-char hex for AES-256-GCM patient data encryption |
| `R2_*` or `S3_*` | File storage (Cloudflare R2 or AWS S3) |
| `FIREBASE_*` | Push notifications |
| `WHATSAPP_*` | WhatsApp Business API |
| `AFTERSHIP_API_KEY` | Shipment tracking |

### 4. Configure Storefront Environment

```bash
cp apps/storefront/.env.example apps/storefront/.env
```

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_MEDUSA_BACKEND_URL` | Backend URL | `http://localhost:9000` |
| `VITE_MEDUSA_PUBLISHABLE_KEY` | From Admin dashboard | `pk_...` |
| `VITE_RAZORPAY_KEY_ID` | Razorpay public key | `rzp_test_...` |
| `VITE_SENTRY_DSN` | Sentry error tracking | `https://...@sentry.io/...` |

### 5. Database Setup

```bash
cd apps/backend

# Run Medusa migrations (creates all module tables)
pnpm medusa db:migrate

# Run seed scripts (roles, permissions, search indexes)
pnpm medusa exec ./src/scripts/run-migrations.ts
```

### 6. Start Development

```bash
# From project root - starts both apps
pnpm dev

# Or individually
pnpm backend:dev      # Backend on :9000
pnpm storefront:dev   # Storefront on :5173
```

### 7. Get Publishable API Key

1. Open Admin: `http://localhost:9000/app`
2. Navigate to **Settings > Publishable API Keys**
3. Create or copy a key
4. Set `VITE_MEDUSA_PUBLISHABLE_KEY` in `apps/storefront/.env`
5. Restart storefront dev server

## Production Deployment

### Docker

```bash
# Build images
pnpm docker:build

# Start full stack (Nginx + Backend + Storefront + Redis)
pnpm docker:up

# Stop
pnpm docker:down
```

The production stack uses:
- **Nginx** — reverse proxy on ports 80/443
- **Backend** — Medusa.js on internal port 9000
- **Storefront** — Static build served by Nginx on internal port 80
- **Redis** — Cache and job queue with 256MB limit

### Environment Variables for Production

Create a `.env` file at the project root with all production values. See `apps/backend/.env.example` for the complete list. Critical production variables:

- `DATABASE_URL` — Production PostgreSQL (Neon/Supabase)
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — Live Razorpay keys
- `PHI_ENCRYPTION_KEY` — Generate with: `openssl rand -hex 32`
- `VITE_MEDUSA_BACKEND_URL` — Public backend URL (e.g., `https://api.suprameds.in`)

### Medusa Cloud

The backend supports Medusa Cloud deployment via `src/scripts/cloud-start.mjs`, which runs migrations and seeds before starting the server.

## Database

### PostgreSQL

The project uses PostgreSQL with these custom schemas (via MikroORM migrations):

- 17 custom module tables (pharma, prescriptions, batches, etc.)
- Full-text search via `tsvector` with GIN indexes
- PHI fields encrypted at rest with AES-256-GCM

### Redis

Optional but recommended for production:
- BullMQ job queue (scheduled tasks)
- Session caching
- OTP storage (3-minute TTL)

If `REDIS_URL` is not set, Medusa falls back to in-memory processing.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Admin dashboard blank | Delete `apps/backend/.medusa/` and rebuild |
| Redis connection refused | Run `docker compose up -d` |
| Stale module changes | Delete `.medusa/` folder, restart dev server |
| Publishable key invalid | Recreate in Admin > Settings > API Keys |
| TypeScript errors after pull | Run `pnpm install` then `pnpm build` |
