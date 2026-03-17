import Medusa from "@medusajs/js-sdk"

let MEDUSA_BACKEND_URL = "http://localhost:9000"
const PUBLISHABLE_KEY = import.meta.env.VITE_MEDUSA_PUBLISHABLE_KEY ?? ""

if (import.meta.env.VITE_MEDUSA_BACKEND_URL) {
  MEDUSA_BACKEND_URL = import.meta.env.VITE_MEDUSA_BACKEND_URL
}

// Store endpoints (login, register, products, etc.) require a valid publishable API key.
// Create one in Medusa Admin: Settings → Publishable API Keys, and set VITE_MEDUSA_PUBLISHABLE_KEY in .env
if (import.meta.env.DEV && !PUBLISHABLE_KEY) {
  console.warn(
    "[Suprameds] VITE_MEDUSA_PUBLISHABLE_KEY is missing. Set it in apps/storefront/.env and restart. Register/login may return Unauthorized."
  )
}

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: import.meta.env.DEV,
  publishableKey: PUBLISHABLE_KEY,
  auth: {
    type: "session",
  },
})
