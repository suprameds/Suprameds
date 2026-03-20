import React, { StrictMode, startTransition } from "react"
import * as Sentry from "@sentry/react"
import { hydrateRoot } from "react-dom/client"
import { StartClient } from "@tanstack/react-start/client"
import { getRouter } from "./router"

Sentry.init({
  dsn:
    import.meta.env.VITE_SENTRY_DSN ??
    "https://1c0ecc6f79ff0f0331c3ccaea3c08e4b@o4511002546077696.ingest.de.sentry.io/4511076540285008",
  // Keep enabled in production while avoiding noise during local development.
  enabled: import.meta.env.PROD,
  // Sends additional context like user IP where available.
  sendDefaultPii: true,
})

const router = getRouter()

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient router={router} />
    </StrictMode>,
  )
})
