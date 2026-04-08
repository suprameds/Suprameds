#!/usr/bin/env bash
set -euo pipefail

# Test Docker builds locally before pushing to Railway.
# Usage: bash scripts/test-deploy.sh [env-file]
#   env-file defaults to .env.storefront

ENV_FILE="${1:-.env.storefront}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found."
  echo "Copy .env.storefront.example to .env.storefront and fill in values."
  exit 1
fi

set -a; source "$ENV_FILE"; set +a

echo "=== Building backend image ==="
docker build -f Dockerfile.backend -t suprameds-backend .

echo ""
echo "=== Building storefront image ==="
docker build -f Dockerfile.storefront \
  --build-arg VITE_MEDUSA_BACKEND_URL="${VITE_MEDUSA_BACKEND_URL:-http://localhost:9000}" \
  --build-arg VITE_MEDUSA_PUBLISHABLE_KEY="${VITE_MEDUSA_PUBLISHABLE_KEY:-}" \
  --build-arg VITE_FIREBASE_API_KEY="${VITE_FIREBASE_API_KEY:-}" \
  --build-arg VITE_FIREBASE_PROJECT_ID="${VITE_FIREBASE_PROJECT_ID:-}" \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN="${VITE_FIREBASE_AUTH_DOMAIN:-}" \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID="${VITE_FIREBASE_MESSAGING_SENDER_ID:-}" \
  --build-arg VITE_FIREBASE_APP_ID="${VITE_FIREBASE_APP_ID:-}" \
  --build-arg VITE_FIREBASE_MEASUREMENT_ID="${VITE_FIREBASE_MEASUREMENT_ID:-}" \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET="${VITE_FIREBASE_STORAGE_BUCKET:-}" \
  --build-arg VITE_FIREBASE_VAPID_KEY="${VITE_FIREBASE_VAPID_KEY:-}" \
  --build-arg VITE_RAZORPAY_KEY_ID="${VITE_RAZORPAY_KEY_ID:-}" \
  --build-arg VITE_SENTRY_DSN="${VITE_SENTRY_DSN:-}" \
  --build-arg VITE_GSC_VERIFICATION="${VITE_GSC_VERIFICATION:-}" \
  --build-arg VITE_GTM_ID="${VITE_GTM_ID:-}" \
  --build-arg VITE_META_PIXEL_ID="${VITE_META_PIXEL_ID:-}" \
  --build-arg VITE_SITE_URL="${VITE_SITE_URL:-https://suprameds.in}" \
  --build-arg VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-}" \
  --build-arg VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-}" \
  --build-arg VITE_MEDUSA_PRODUCTION_URL="${VITE_MEDUSA_PRODUCTION_URL:-}" \
  --build-arg VITE_CAPACITOR="${VITE_CAPACITOR:-}" \
  --build-arg VITE_APP_VERSION="${VITE_APP_VERSION:-local}" \
  -t suprameds-storefront .

echo ""
echo "=== Both images built successfully ==="
echo ""
echo "Test locally with:"
echo "  docker run --rm -p 3000:3000 suprameds-storefront"
echo "  docker run --rm -p 9000:9000 --env-file apps/backend/.env suprameds-backend"
