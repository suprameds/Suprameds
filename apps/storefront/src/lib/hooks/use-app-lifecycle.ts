import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { isNativeApp } from "@/lib/utils/capacitor"
import { checkForAppUpdate } from "@/lib/capacitor"

const SITE_HOSTS = new Set(["supracyn.in", "www.supracyn.in"])

/**
 * Wires @capacitor/app lifecycle events:
 *  - appStateChange → refetch React Query data when the app returns to foreground
 *  - appUrlOpen     → route deep links opened from other apps (supracyn.in/*)
 *  - resume         → re-check Play Store for updates
 *
 * Must render inside the QueryClient + Router providers.
 */
export function useAppLifecycle() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isNativeApp()) return

    const handles: Array<{ remove: () => void }> = []
    let cancelled = false

    ;(async () => {
      try {
        const { App } = await import("@capacitor/app")
        if (cancelled) return

        const stateChange = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) {
            queryClient.invalidateQueries()
            checkForAppUpdate().catch(() => { /* already logged */ })
          }
        })
        handles.push(stateChange)

        const urlOpen = await App.addListener("appUrlOpen", ({ url }) => {
          try {
            const parsed = new URL(url)
            if (SITE_HOSTS.has(parsed.hostname)) {
              const target = parsed.pathname + parsed.search + parsed.hash
              navigate({ to: target || "/", replace: false })
            }
          } catch {
            /* malformed URL — ignore */
          }
        })
        handles.push(urlOpen)
      } catch (err) {
        if (import.meta.env.DEV) console.warn("[app] lifecycle init failed", err)
      }
    })()

    return () => {
      cancelled = true
      handles.forEach((h) => h.remove())
    }
  }, [queryClient, navigate])
}
