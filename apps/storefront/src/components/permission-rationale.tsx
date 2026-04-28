/**
 * Permission rationale modal — shown BEFORE invoking the OS permission dialog.
 *
 * Why this exists: a "cold" Android system permission prompt has a 60-70% deny
 * rate on first try. Showing a short context screen ("we use camera for Rx
 * upload, never for anything else") drops deny rate to 20-30%, recovering
 * meaningful conversion on flows like delivery-estimate and prescription
 * upload.
 *
 * Usage:
 *   const ask = usePermissionRationale()
 *   const allow = await ask({ icon, title, body })
 *   if (!allow) return
 *   // ... now invoke Geolocation.getCurrentPosition / Camera.getPhoto / etc.
 *
 * The provider renders a single bottom-sheet (mobile) / centered modal
 * (≥ sm) at z-index 10000 over everything else. Resolves the promise with
 * `true` on Continue, `false` on Cancel / backdrop click / Escape.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

export interface RationaleConfig {
  /** Icon shown in the round badge above the title (24×24 SVG recommended) */
  icon: ReactNode
  /** One-line headline. Plain language. e.g., "Use your location?" */
  title: string
  /** 1–2 sentences. WHAT we'll do, WHY we need it, what we won't do. */
  body: string
  /** Defaults to "Continue" */
  continueLabel?: string
  /** Defaults to "Not now" */
  cancelLabel?: string
}

type State = (RationaleConfig & { resolve: (allow: boolean) => void }) | null

const RationaleContext = createContext<
  ((cfg: RationaleConfig) => Promise<boolean>) | null
>(null)

export function PermissionRationaleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(null)

  const ask = useCallback((cfg: RationaleConfig) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...cfg, resolve })
    })
  }, [])

  const close = useCallback((allow: boolean) => {
    setState((s) => {
      if (s) s.resolve(allow)
      return null
    })
  }, [])

  // Escape closes (treats as cancel).
  useEffect(() => {
    if (!state) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [state, close])

  // Lock body scroll while open (prevents background scrolling on iOS Safari /
  // Android Chrome). Restore previous overflow on close.
  useEffect(() => {
    if (!state) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [state])

  return (
    <RationaleContext.Provider value={ask}>
      {children}
      {state && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="perm-rationale-title"
          aria-describedby="perm-rationale-body"
          className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => close(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl p-6 shadow-2xl animate-fade-in-up"
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="flex justify-center mb-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(14,124,134,0.1)",
                  color: "var(--brand-teal, #0E7C86)",
                }}
              >
                {state.icon}
              </div>
            </div>
            <h3
              id="perm-rationale-title"
              className="text-xl font-semibold text-center"
              style={{
                color: "var(--text-primary, #0D1B2A)",
                fontFamily: "Fraunces, Georgia, serif",
              }}
            >
              {state.title}
            </h3>
            <p
              id="perm-rationale-body"
              className="mt-3 text-sm text-center leading-relaxed"
              style={{ color: "var(--text-secondary, #6B7280)" }}
            >
              {state.body}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => close(true)}
                className="w-full py-3 min-h-[44px] rounded-lg font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
                style={{ background: "var(--brand-teal, #0E7C86)" }}
              >
                {state.continueLabel ?? "Continue"}
              </button>
              <button
                type="button"
                onClick={() => close(false)}
                className="w-full py-3 min-h-[44px] rounded-lg font-semibold transition-opacity hover:opacity-70"
                style={{ color: "var(--text-secondary, #6B7280)" }}
              >
                {state.cancelLabel ?? "Not now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </RationaleContext.Provider>
  )
}

/**
 * Imperative API to show a rationale modal and await the user's choice.
 *
 * Tolerant of a missing provider: if no `<PermissionRationaleProvider>` is
 * mounted (e.g., in isolated unit tests, or in code paths that bypass the
 * Layout wrapper), the returned function resolves immediately to `true` so
 * the calling flow falls through to the bare OS permission dialog. This keeps
 * tests, storybook, and edge cases working while production keeps the
 * rationale UX.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function usePermissionRationale() {
  const ask = useContext(RationaleContext)
  return ask ?? (async () => true)
}
