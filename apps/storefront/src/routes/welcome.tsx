import { createFileRoute, redirect } from "@tanstack/react-router"
import { WelcomeScreen } from "@/components/welcome/welcome-screen"
import { consumeFreshSignup } from "@/lib/welcome"

/**
 * /welcome — shown ONCE immediately after a successful signup.
 *
 * Access control: the route's `beforeLoad` consumes a single-use sessionStorage
 * flag set by the login page's OTP verify success handler when `is_new === true`.
 * No flag = redirect home. This prevents:
 *   - Stale screen on URL bar visits later.
 *   - Refresh re-showing the screen after a CTA click (the flag is already
 *     consumed by then).
 *   - Cold-launch resurrection on the native shell (sessionStorage clears
 *     on Capacitor process kill, matching the "first-impression only" intent).
 *
 * Chrome (navbar, footer, bottom tab bar, consent banner) is suppressed by
 * the matching path check in layout.tsx — keep them in lockstep.
 */
export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome | Suprameds" },
      // No SEO value here and explicitly post-auth — keep crawlers out.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  beforeLoad: () => {
    // beforeLoad runs on the client for soft navigations and also during SSR
    // hydration. consumeFreshSignup is SSR-safe (returns false on the server)
    // so server-rendered hits to /welcome will redirect home — which is the
    // right behavior, since the signup-and-navigate flow is fully client-side.
    if (!consumeFreshSignup()) {
      throw redirect({ to: "/", replace: true })
    }
  },
  component: WelcomeScreen,
})
