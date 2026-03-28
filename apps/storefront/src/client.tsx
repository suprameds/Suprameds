import React, { StrictMode, startTransition } from "react"
import * as Sentry from "@sentry/react"
import { hydrateRoot } from "react-dom/client"
import { StartClient } from "@tanstack/react-start/client"
import { getRouter } from "./router"

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
    return event
  },
})

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
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state !== "installed" || !navigator.serviceWorker.controller) return

            const toast = document.createElement("div")
            toast.setAttribute("role", "alert")
            Object.assign(toast.style, {
              position: "fixed",
              bottom: "1.5rem",
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--bg-inverse, #1E2D5A)",
              color: "var(--text-inverse, #fff)",
              padding: "0.75rem 1.25rem",
              borderRadius: "10px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
              zIndex: "99999",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              fontFamily: "DM Sans, sans-serif",
              fontSize: "0.875rem",
            })
            toast.innerHTML = `
              <span>A new version is available</span>
              <button id="pwa-update-btn" style="
                background:var(--brand-green, #27AE60);color:var(--text-inverse, #fff);border:none;padding:0.4rem 1rem;
                border-radius:6px;font-size:0.8125rem;font-weight:600;cursor:pointer;
              ">Update</button>
              <button id="pwa-dismiss-btn" style="
                background:transparent;color:rgba(255,255,255,0.7);border:none;
                font-size:1.1rem;cursor:pointer;padding:0 0.25rem;
              ">&times;</button>
            `
            document.body.appendChild(toast)

            document.getElementById("pwa-update-btn")?.addEventListener("click", () => {
              newWorker.postMessage({ type: "SKIP_WAITING" })
              window.location.reload()
            })
            document.getElementById("pwa-dismiss-btn")?.addEventListener("click", () => {
              toast.remove()
            })
          })
        })

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
