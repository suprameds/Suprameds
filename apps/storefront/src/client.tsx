import React, { StrictMode, startTransition } from "react"
import * as Sentry from "@sentry/react"
import { hydrateRoot } from "react-dom/client"
import { StartClient } from "@tanstack/react-start/client"
// eslint-disable-next-line no-restricted-imports
import { getRouter } from "./router"
// eslint-disable-next-line no-restricted-imports
import { isExtensionNoise, isZarazNoise } from "./lib/utils/sentry-filters"

try {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    enabled: import.meta.env.PROD,
    environment: import.meta.env.MODE,
    release: `suprameds-storefront@${import.meta.env.VITE_APP_VERSION || "0.0.0"}`,

    // Performance — sample 20% of page loads in production
    tracesSampleRate: 0.2,

    // Session Replay — capture 10% of sessions, 100% on error
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Don't report network errors from ad-blockers or extension interference
    beforeSend(event) {
      const message = event.exception?.values?.[0]?.value || ""
      if (message.includes("ResizeObserver") || message.includes("ChunkLoadError")) {
        return null
      }
      if (isExtensionNoise(event)) {
        return null
      }
      if (isZarazNoise(event)) {
        return null
      }
      return event
    },
  })
} catch (e) {
  console.warn("[Sentry] Failed to initialize — error tracking disabled:", e)
}

/**
 * PWA Service Worker registration.
 * The SW is built separately via vite.sw.config.ts (VitePWA / Workbox)
 * because vite-plugin-pwa is incompatible with TanStack Start's
 * multi-environment SSR build. We register manually here instead of
 * using virtual:pwa-register.
 */
if (import.meta.env.PROD && typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        // New SW versions install in the background and activate silently
        // on the next page load when no tab is controlling the old worker.
        // We deliberately do NOT show an "update available" toast — users
        // get the new bundle whenever they next refresh, no nag.
        // eslint-disable-next-line no-console
        console.log("[PWA] Service worker registered:", registration.scope)
      })
      .catch((err) => {
        console.warn("[PWA] Service worker registration failed:", err)
      })
  })
}

const router = getRouter()

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      {/* @ts-expect-error TanStack Start internal prop typing */}
      <StartClient router={router} />
    </StrictMode>,
  )
})
