import React, { StrictMode, startTransition } from "react"
import * as Sentry from "@sentry/react"
import { hydrateRoot } from "react-dom/client"
import { StartClient } from "@tanstack/react-start/client"
import { getRouter } from "./router"

Sentry.init({
  dsn:
    import.meta.env.VITE_SENTRY_DSN ??
    "https://1c0ecc6f79ff0f0331c3ccaea3c08e4b@o4511002546077696.ingest.de.sentry.io/4511076540285008",
  enabled: import.meta.env.PROD,
  sendDefaultPii: true,
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
              background: "#1E2D5A",
              color: "#fff",
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
                background:#27AE60;color:#fff;border:none;padding:0.4rem 1rem;
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
