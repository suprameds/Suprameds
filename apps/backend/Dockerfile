# ────────────────────────────────────────────────────────────────
# Suprameds – Medusa Backend
# Build context MUST be the monorepo root so that the root
# package-lock.json is accessible for `npm ci`.
#
# Medusa Cloud usage:
#   Root directory : /  (repo root)
#   Dockerfile path: apps/backend/Dockerfile
# ────────────────────────────────────────────────────────────────

# ── Stage 1: install & build ─────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace manifests & lock file first (layer caching)
COPY package.json package-lock.json ./

# Copy each workspace package.json so npm can resolve workspaces
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/storefront/package.json ./apps/storefront/package.json

# Install ALL workspace deps from the root lock file
RUN npm ci --no-audit

# Copy full source trees
COPY apps/backend ./apps/backend

# Build the Medusa backend (outputs to apps/backend/.medusa/server)
WORKDIR /app/apps/backend
RUN npm run build

# ── Stage 2: lean production image ───────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy the self-contained server bundle produced by `medusa build`
COPY --from=builder /app/apps/backend/.medusa/server ./

# Install only production dependencies declared in the bundle
RUN npm install --omit=dev --no-audit --ignore-scripts

EXPOSE 9000

CMD ["node", "index.js"]
