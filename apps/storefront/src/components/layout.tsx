import ErrorBoundary from "@/components/error-boundary"
import Footer from "@/components/footer"
import { Navbar } from "@/components/navbar"
import { BottomTabBar } from "@/components/bottom-tab-bar"
import { PermissionRationaleProvider } from "@/components/permission-rationale"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { CartProvider } from "@/lib/context/cart"
import { ThemeProvider } from "@/lib/context/theme"
import { ToastProvider } from "@/lib/context/toast-context"
import { AnimatedOutlet } from "@/components/animated-outlet"
import { useAndroidBackButton } from "@/lib/hooks/use-android-back-button"
import { useAppLifecycle } from "@/lib/hooks/use-app-lifecycle"
import { useExternalLinks } from "@/lib/hooks/use-external-links"
import { useNativeKeyboard } from "@/lib/hooks/use-native-keyboard"
import { isNativeApp } from "@/lib/utils/capacitor"
import { useCustomer } from "@/lib/hooks/use-customer"
import { useQueryClient } from "@tanstack/react-query"
import { useRouterState, useNavigate, useLocation } from "@tanstack/react-router"
import { lazy, Suspense, useEffect } from "react"

/**
 * sessionStorage key — set when the user taps "Skip for now" on the login page.
 * sessionStorage is cleared by the Capacitor webview on cold launch (process kill),
 * so every cold open with no signed-in customer re-prompts. Warm resumes (app
 * brought back from background without termination) keep the skip flag, so we
 * don't re-prompt mid-session.
 */
const NATIVE_LOGIN_SKIPPED_SESSION_KEY = "suprameds_native_login_skipped"

// Below-the-fold / non-critical components — kept out of main.js so the
// initial bundle parses faster. Render in a single Suspense with a null
// fallback since none of these need a placeholder on first paint.
const WhatsAppButton = lazy(() => import("@/components/whatsapp-button"))
const ConsentBanner = lazy(() =>
  import("@/components/consent-banner").then((m) => ({ default: m.ConsentBanner })),
)
const OfflineScreen = lazy(() =>
  import("@/components/offline-screen").then((m) => ({ default: m.OfflineScreen })),
)
const PushNotificationManager = lazy(() =>
  import("@/components/push-notification-manager").then((m) => ({
    default: m.PushNotificationManager,
  })),
)

/** Top navigation progress bar — shows instantly on route transitions */
function NavigationProgress() {
  const isLoading = useRouterState({ select: (s) => s.isLoading })
  if (!isLoading) return null
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px]">
      <div
        className="h-full animate-progress-bar"
        style={{ background: "var(--brand-teal, #0E7C86)" }}
      />
    </div>
  )
}

/** Runs native-only hooks that require provider context (toast, router, query) */
function NativeHooks() {
  useAndroidBackButton()
  useAppLifecycle()
  useExternalLinks()
  useNativeKeyboard()
  return null
}

const Layout = () => {
  const native = isNativeApp()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  // Onboarding owns the full screen — suppress global chrome (navbar, footer,
  // tab bar, WhatsApp button, consent banner) so it doesn't feel like a web
  // page sandwiched in app chrome.
  const isOnboarding = location.pathname.startsWith("/onboarding")
  // Auth pages are self-contained (own logo + brand panel) and get the same
  // fullscreen treatment so the native tab bar doesn't appear underneath the
  // sign-in form and the navbar/footer don't compete for attention.
  const isAuthPage = /^\/account\/(login|register|forgot-password|reset-password)(\/|$)/.test(
    location.pathname,
  )
  const isChromeSuppressed = isOnboarding || isAuthPage

  const handleRefresh = async () => {
    await queryClient.invalidateQueries()
  }

  const { data: customer, isLoading: customerLoading } = useCustomer()

  // Onboarding redirect — DISABLED. The first-launch onboarding adds an
  // extra step before users see the storefront on the native app; we're
  // currently optimising for time-to-first-screen, so the route is left
  // accessible (direct nav to /onboarding still works) but no longer
  // auto-redirects. Mark it "seen" eagerly so the legacy native-login gate
  // below — which depends on `hasSeenOnboarding` — keeps firing normally.
  //
  // Re-enable by restoring the original block:
  //   if (!hasSeenOnboarding && !isExcludedPath) navigate({ to: "/onboarding", replace: true })
  useEffect(() => {
    if (!native) return
    try {
      localStorage.setItem("suprameds_onboarding_seen_v2", "true")
    } catch {
      // non-fatal
    }
  }, [native])

  // Migration: clear the legacy persistent skip/resolved flag so users who
  // dismissed the prompt under the old contract get re-prompted on next cold
  // launch under the new "every-cold-open" contract. Safe to run on web too —
  // the key is namespaced and unused there.
  useEffect(() => {
    try {
      localStorage.removeItem("suprameds_native_login_resolved")
    } catch {
      // non-fatal
    }
  }, [])

  // Native login gate — every cold launch of the native app, if no customer
  // is signed in, redirect to /account/login. Pattern matches food-delivery
  // and Q-commerce apps that require an account before browsing in earnest.
  //
  // Dismissal model:
  //   - sessionStorage skip flag survives intra-session navigation and warm
  //     resume from background, so users who chose "Skip for now" aren't
  //     re-prompted on every route change or app-resume in the same session.
  //   - Capacitor clears sessionStorage when the OS terminates the webview
  //     process, so the next cold launch re-prompts.
  //   - Once signed in, the auth JWT in localStorage (medusa_auth_token) is
  //     the source of truth and useCustomer() returns the customer → no
  //     redirect.
  //
  // Web users are unaffected — anonymous browsing is critical for SEO/Ads.
  useEffect(() => {
    if (!native) return
    if (customerLoading) return // wait for customer state to settle

    const hasSeenOnboarding = localStorage.getItem("suprameds_onboarding_seen_v2")
    if (!hasSeenOnboarding) return // onboarding redirect above handles this

    // Signed-in → no prompt
    if (customer) return

    // Skipped during this session → don't re-prompt on every navigation
    try {
      if (sessionStorage.getItem(NATIVE_LOGIN_SKIPPED_SESSION_KEY)) return
    } catch {
      // sessionStorage can be disabled in some webview configurations — non-fatal
    }

    // Don't redirect if they're already on an auth/onboarding/pharmacy path
    const isAuthOrIntroPath =
      /^\/account\/(login|register|forgot-password|reset-password)(\/|$)/.test(location.pathname) ||
      location.pathname.startsWith("/onboarding") ||
      location.pathname.startsWith("/pharmacy")
    if (isAuthOrIntroPath) return

    navigate({
      to: "/account/login",
      search: { firstLaunch: true, redirectTo: location.pathname || "/" } as never,
      replace: true,
    })
  }, [native, customer, customerLoading, location.pathname, navigate])

  return (
    <ThemeProvider>
    <ToastProvider>
      <PermissionRationaleProvider>
      <CartProvider>
        {native && <NativeHooks />}
        <div className="min-h-screen flex flex-col">
          {!isChromeSuppressed && (
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-white focus:text-[var(--text-primary)] focus:shadow-lg focus:border focus:border-[var(--border-primary)]"
            >
              Skip to main content
            </a>
          )}
          <NavigationProgress />
          <Suspense fallback={null}>
            <PushNotificationManager />
          </Suspense>
          {!isChromeSuppressed && <Navbar />}

          <main id="main-content" className="relative flex-1">
            {isChromeSuppressed ? (
              <ErrorBoundary>
                <AnimatedOutlet />
              </ErrorBoundary>
            ) : (
              <PullToRefresh onRefresh={handleRefresh}>
                <ErrorBoundary>
                  <AnimatedOutlet />
                </ErrorBoundary>
              </PullToRefresh>
            )}
          </main>

          {!isChromeSuppressed && (
            <>
              <Footer />
              <Suspense fallback={null}>
                <WhatsAppButton />
              </Suspense>
              <BottomTabBar />
            </>
          )}
          <Suspense fallback={null}>
            <OfflineScreen />
            {!isChromeSuppressed && <ConsentBanner />}
          </Suspense>
          {/* Bottom padding when native tab bar is visible */}
          {native && !isChromeSuppressed && (
            <div className="h-14" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} />
          )}
        </div>
      </CartProvider>
      </PermissionRationaleProvider>
    </ToastProvider>
    </ThemeProvider>
  )
}

export default Layout
