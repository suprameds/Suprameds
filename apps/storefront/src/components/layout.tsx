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
import { useQueryClient } from "@tanstack/react-query"
import { useRouterState, useNavigate, useLocation } from "@tanstack/react-router"
import { lazy, Suspense, useEffect } from "react"

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

  const handleRefresh = async () => {
    await queryClient.invalidateQueries()
  }

  // Onboarding redirect — native app only, first launch only
  useEffect(() => {
    if (!native) return
    const hasSeenOnboarding = localStorage.getItem("suprameds_onboarding_seen_v2")
    const isExcludedPath = location.pathname.includes("/onboarding") || location.pathname.includes("/pharmacy")

    if (!hasSeenOnboarding && !isExcludedPath) {
      navigate({ to: "/onboarding", replace: true })
    }
  }, [navigate, location.pathname, native])

  return (
    <ThemeProvider>
    <ToastProvider>
      <PermissionRationaleProvider>
      <CartProvider>
        {native && <NativeHooks />}
        <div className="min-h-screen flex flex-col">
          {!isOnboarding && (
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
          {!isOnboarding && <Navbar />}

          <main id="main-content" className="relative flex-1">
            {isOnboarding ? (
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

          {!isOnboarding && (
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
            {!isOnboarding && <ConsentBanner />}
          </Suspense>
          {/* Bottom padding when native tab bar is visible */}
          {native && !isOnboarding && (
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
