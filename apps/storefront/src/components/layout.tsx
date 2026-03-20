import { ConsentBanner } from "@/components/consent-banner"
import ErrorBoundary from "@/components/error-boundary"
import Footer from "@/components/footer"
import { Navbar } from "@/components/navbar"
import { PushNotificationManager } from "@/components/push-notification-manager"
import { CartProvider } from "@/lib/context/cart"
import { ToastProvider } from "@/lib/context/toast-context"
import { Outlet } from "@tanstack/react-router"

const Layout = () => {
  return (
    <ToastProvider>
      <CartProvider>
        <div className="min-h-screen flex flex-col">
          <PushNotificationManager />
          <Navbar />

          <main className="relative flex-1">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>

          <Footer />
          <ConsentBanner />
        </div>
      </CartProvider>
    </ToastProvider>
  )
}

export default Layout
