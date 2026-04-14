import { isNativeApp } from "@/lib/utils/capacitor"
import { hapticSelection } from "@/lib/utils/haptics"
import { useKeyboardVisible } from "@/lib/hooks/use-keyboard-visible"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { Link, useLocation } from "@tanstack/react-router"

const HomeIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
    {!active && <path d="M9 21V12h6v9" />}
  </svg>
)

const StoreIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" fill={active ? "currentColor" : "none"} />
    <rect x="14" y="3" width="7" height="7" rx="1" fill={active ? "currentColor" : "none"} />
    <rect x="3" y="14" width="7" height="7" rx="1" fill={active ? "currentColor" : "none"} />
    <rect x="14" y="14" width="7" height="7" rx="1" fill={active ? "currentColor" : "none"} />
  </svg>
)

const RxIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill={active ? "currentColor" : "none"} />
    <polyline points="14 2 14 8 20 8" stroke={active ? "var(--bg-secondary)" : "currentColor"} />
    <line x1="12" y1="13" x2="12" y2="17" stroke={active ? "var(--bg-secondary)" : "currentColor"} />
    <line x1="10" y1="15" x2="14" y2="15" stroke={active ? "var(--bg-secondary)" : "currentColor"} />
  </svg>
)

const OrdersIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke={active ? "var(--bg-secondary)" : "currentColor"} />
    <line x1="12" y1="22.08" x2="12" y2="12" stroke={active ? "var(--bg-secondary)" : "currentColor"} />
  </svg>
)

const AccountIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
)

const TABS = [
  { key: "home", label: "Home", Icon: HomeIcon, path: "" },
  { key: "store", label: "Store", Icon: StoreIcon, path: "/store" },
  { key: "upload-rx", label: "Upload Rx", Icon: RxIcon, path: "/upload-rx" },
  { key: "orders", label: "Orders", Icon: OrdersIcon, path: "/account/orders" },
  { key: "account", label: "Account", Icon: AccountIcon, path: "/account/profile" },
] as const

function getActiveTab(pathname: string): string {
  if (pathname.includes("/store") || pathname.includes("/categories")) return "store"
  if (pathname.includes("/upload-rx")) return "upload-rx"
  if (pathname.includes("/account/orders") || pathname.includes("/order/")) return "orders"
  if (pathname.includes("/account")) return "account"
  // Home is the root country code path
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length <= 1) return "home"
  return "home"
}

export function BottomTabBar() {
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"
  const activeTab = getActiveTab(location.pathname)
  const keyboardVisible = useKeyboardVisible()

  // Only render inside native Capacitor shell
  if (!isNativeApp()) return null

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t transition-transform duration-200"
      style={{
        background: "var(--bg-secondary)",
        borderColor: "var(--border-primary)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        transform: keyboardVisible ? "translateY(100%)" : "none",
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around h-14">
        {TABS.map(({ key, label, Icon, path }) => {
          const isActive = activeTab === key
          const to = key === "home"
            ? "/$countryCode"
            : `/$countryCode${path}`

          return (
            <Link
              key={key}
              to={to as any}
              params={{ countryCode } as any}
              onClick={() => hapticSelection()}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-[56px] transition-colors"
              style={{
                color: isActive ? "var(--brand-teal)" : "var(--text-tertiary)",
              }}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon active={isActive} />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
