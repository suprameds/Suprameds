/**
 * Capacitor mobile entry point — renders the app client-only (no SSR).
 *
 * This file is the Vite entry for the Capacitor SPA build (vite.config.capacitor.ts).
 * It bypasses TanStack Start's SSR hydration and mounts a pure client-side React app.
 */
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"
import { QueryClientProvider } from "@tanstack/react-query"
// eslint-disable-next-line no-restricted-imports
import { getRouter } from "./router"
// eslint-disable-next-line no-restricted-imports
import { initCapacitorPlugins } from "./lib/capacitor"
import * as Sentry from "@sentry/react"
// eslint-disable-next-line no-restricted-imports
import "./styles/app.css"

// Initialize Sentry for mobile
try {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    enabled: import.meta.env.PROD,
    environment: "mobile",
    release: `suprameds-mobile@${import.meta.env.VITE_APP_VERSION || "0.0.0"}`,
    tracesSampleRate: 0.2,
    integrations: [Sentry.browserTracingIntegration()],
    beforeSend(event) {
      const message = event.exception?.values?.[0]?.value || ""
      if (message.includes("ResizeObserver") || message.includes("ChunkLoadError")) {
        return null
      }
      return event
    },
  })
} catch {
  /* Sentry init failed — continue without error tracking */
}

// Initialize native plugins (status bar, splash screen)
initCapacitorPlugins()

// Mount the app
const router = getRouter()
const queryClient = (router.options.context as any).queryClient

const root = document.getElementById("app")
if (root) {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}
