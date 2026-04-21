import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"

// ---- Layout tests (skip-to-main-content) ----

vi.mock("@/components/consent-banner", () => ({
  ConsentBanner: () => null,
  default: () => null,
}))

vi.mock("@/components/error-boundary", () => ({
  default: ({ children }: any) => <>{children}</>,
  ErrorBoundary: ({ children }: any) => <>{children}</>,
}))

vi.mock("@/components/footer", () => ({
  default: () => <footer data-testid="footer">Footer</footer>,
}))

vi.mock("@/components/navbar", () => ({
  Navbar: () => <nav data-testid="navbar">Navbar</nav>,
}))

vi.mock("@/components/push-notification-manager", () => ({
  PushNotificationManager: () => null,
}))

vi.mock("@/components/whatsapp-button", () => ({
  default: () => null,
}))

vi.mock("@/lib/context/theme", () => ({
  ThemeProvider: ({ children }: any) => <>{children}</>,
}))

vi.mock("@/lib/context/cart", () => ({
  CartProvider: ({ children }: any) => <>{children}</>,
}))

vi.mock("@/lib/context/toast-context", () => ({
  ToastProvider: ({ children }: any) => <>{children}</>,
}))

vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <div data-testid="outlet">Page</div>,
  useLocation: () => ({ pathname: "/" }),
  useRouterState: () => ({ isTransitioning: false }),
}))

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock("@/components/bottom-tab-bar", () => ({
  BottomTabBar: () => null,
}))

vi.mock("@/components/offline-screen", () => ({
  OfflineScreen: () => null,
}))

vi.mock("@/components/pull-to-refresh", () => ({
  PullToRefresh: ({ children }: any) => <>{children}</>,
}))

vi.mock("@/components/animated-outlet", () => ({
  AnimatedOutlet: () => <div data-testid="outlet">Page</div>,
}))

vi.mock("@/lib/utils/capacitor", () => ({
  isNativeApp: () => false,
}))

vi.mock("@/lib/hooks/use-android-back-button", () => ({
  useAndroidBackButton: () => {},
}))

import Layout from "@/components/layout"

describe("Layout – Accessibility", () => {
  it("renders a 'Skip to main content' link", () => {
    render(<Layout />)
    const skipLink = screen.getByText("Skip to main content")
    expect(skipLink).toBeInTheDocument()
    expect(skipLink).toHaveAttribute("href", "#main-content")
  })

  it("main element has id='main-content' as skip link target", () => {
    render(<Layout />)
    const main = document.getElementById("main-content")
    expect(main).not.toBeNull()
    expect(main?.tagName.toLowerCase()).toBe("main")
  })

  it("skip link has sr-only class (hidden until focused)", () => {
    render(<Layout />)
    const skipLink = screen.getByText("Skip to main content")
    expect(skipLink.className).toContain("sr-only")
  })
})

// Consent Banner tests are in consent-banner.test.tsx to avoid mock conflicts
