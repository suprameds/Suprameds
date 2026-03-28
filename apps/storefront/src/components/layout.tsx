import { ConsentBanner } from "@/components/consent-banner"
import ErrorBoundary from "@/components/error-boundary"
import Footer from "@/components/footer"
import { Navbar } from "@/components/navbar"
import WhatsAppButton from "@/components/whatsapp-button"
import { PushNotificationManager } from "@/components/push-notification-manager"
import { CartProvider } from "@/lib/context/cart"
import { ThemeProvider } from "@/lib/context/theme"
import { ToastProvider } from "@/lib/context/toast-context"
import { Outlet } from "@tanstack/react-router"

const Layout = () => {
  return (
    <ThemeProvider>
    <ToastProvider>
      <CartProvider>
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
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>

          <Footer />
          <ConsentBanner />
          <WhatsAppButton />
        </div>
      </CartProvider>
    </ToastProvider>
    </ThemeProvider>
  )
}

export default Layout
