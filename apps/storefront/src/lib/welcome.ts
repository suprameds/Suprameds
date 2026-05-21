/**
 * One-shot sessionStorage flag that gates the /welcome screen.
 *
 * Lifecycle:
 *   1. Login OTP verify returns `is_new: true` → `markFreshSignup()` is called,
 *      then we navigate to `/welcome`.
 *   2. The /welcome route's beforeLoad reads + clears the flag via
 *      `consumeFreshSignup()`. If absent (user typed URL directly, or refreshed
 *      after clicking the CTA), the route redirects home so a stale URL visit
 *      doesn't re-show the screen.
 *
 * Why sessionStorage (not localStorage or customer.metadata):
 *   - sessionStorage clears on Capacitor process kill, matching the desired
 *     "first impression only" semantic — no risk of the screen reappearing
 *     on a later cold launch if cleanup races.
 *   - localStorage would persist across cold launches. customer.metadata
 *     would require a backend round-trip on the welcome page mount for no
 *     UX benefit at v1 scope.
 *
 * Why a centralized helper (vs. inlining `sessionStorage.setItem`):
 *   - Keeps the key name in one place so we can grep / bump versions safely.
 *   - Guards typeof-window for SSR (TanStack Start renders this route server-
 *     side first; touching sessionStorage there would throw).
 */

const KEY = "suprameds_welcome_pending_v1"

/** Call right before navigating to /welcome on a successful signup. */
export function markFreshSignup(): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(KEY, "1")
  } catch {
    // Storage quota / disabled — welcome screen won't show, but signup
    // still succeeds. Acceptable degradation.
  }
}

/**
 * Read + clear the flag. Returns true iff the flag was set, meaning the
 * caller (the /welcome route) should render the screen. Subsequent calls
 * within the same session return false.
 */
export function consumeFreshSignup(): boolean {
  if (typeof window === "undefined") return false
  try {
    const present = window.sessionStorage.getItem(KEY) === "1"
    if (present) {
      window.sessionStorage.removeItem(KEY)
    }
    return present
  } catch {
    return false
  }
}
