import { ConsentBanner } from "@/components/consent-banner"
import ErrorBoundary from "@/components/error-boundary"
import Footer from "@/components/footer"
import { Navbar } from "@/components/navbar"
import WhatsAppButton from "@/components/whatsapp-button"
import { BottomTabBar } from "@/components/bottom-tab-bar"
import { OfflineScreen } from "@/components/offline-screen"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { PushNotificationManager } from "@/components/push-notification-manager"
import { CartProvider } from "@/lib/context/cart"
import { ThemeProvider } from "@/lib/context/theme"
import { ToastProvider } from "@/lib/context/toast-context"
import { AnimatedOutlet } from "@/components/animated-outlet"
import { useAndroidBackButton } from "@/lib/hooks/use-android-back-button"
import { isNativeApp } from "@/lib/utils/capacitor"
import { useQueryClient } from "@tanstack/react-query"

/** Runs native-only hooks that require provider context (toast, router) */
function NativeHooks() {
  useAndroidBackButton()
  return null
}

const Layout = () => {
  const native = isNativeApp()
  const queryClient = useQueryClient()

  const handleRefresh = async () => {
    await queryClient.invalidateQueries()
  }

  return (
    <ThemeProvider>
    <ToastProvider>
      <CartProvider>
        {native && <NativeHooks />}
        <div className="min-h-screen flex flex-col">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-white focus:text-[var(--text-primary)] focus:shadow-lg focus:border focus:border-[var(--border-primary)]"
          >
            Skip to main content
          </a>
          <PushNotificationManager />
          <Navbar />

          <main id="main-content" className="relative flex-1">
            <PullToRefresh onRefresh={handleRefresh}>
              <ErrorBoundary>
                <AnimatedOutlet />
              </ErrorBoundary>
            </PullToRefresh>
          </main>

          <Footer />
          <WhatsAppButton />
          <BottomTabBar />
          <OfflineScreen />
          <ConsentBanner />
          {/* Bottom padding when native tab bar is visible */}
          {native && <div className="h-14" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} />}
        </div>
      </CartProvider>
    </ToastProvider>
    </ThemeProvider>
  )
}

export default Layout
