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

const RxIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="13" x2="12" y2="17" />
    <line x1="10" y1="15" x2="14" y2="15" />
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

const SIDE_TABS = [
  { key: "home", label: "Home", Icon: HomeIcon, path: "" },
  { key: "store", label: "Store", Icon: StoreIcon, path: "/store" },
  // Upload Rx is the center FAB — handled separately
  { key: "orders", label: "Orders", Icon: OrdersIcon, path: "/account/orders" },
  { key: "account", label: "Account", Icon: AccountIcon, path: "/account/profile" },
] as const

function getActiveTab(pathname: string): string {
  if (pathname.includes("/store") || pathname.includes("/categories")) return "store"
  if (pathname.includes("/upload-rx")) return "upload-rx"
  if (pathname.includes("/account/orders") || pathname.includes("/order/")) return "orders"
  if (pathname.includes("/account")) return "account"
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length <= 1) return "home"
  return "home"
}

export function BottomTabBar() {
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"
  const activeTab = getActiveTab(location.pathname)
  const keyboardVisible = useKeyboardVisible()

  if (!isNativeApp()) return null

  const isRxActive = activeTab === "upload-rx"

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 transition-transform duration-200"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        transform: keyboardVisible ? "translateY(100%)" : "none",
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Frosted glass background */}
      <div
        className="absolute inset-0 rounded-t-2xl"
        style={{
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderTop: "1px solid rgba(13,27,42,0.08)",
          boxShadow: "0 -4px 24px rgba(13,27,42,0.06), 0 -1px 4px rgba(13,27,42,0.04)",
        }}
      />

      <div className="relative flex items-end justify-around h-16 px-2">
        {/* Left tabs: Home, Store */}
        {SIDE_TABS.slice(0, 2).map(({ key, label, Icon, path }) => {
          const isActive = activeTab === key
          return (
            <TabLink
              key={key}
              to={key === "home" ? "/$countryCode" : `/$countryCode${path}`}
              countryCode={countryCode}
              isActive={isActive}
              label={label}
            >
              <Icon active={isActive} />
            </TabLink>
          )
        })}

        {/* Center FAB: Upload Rx */}
        <div className="flex flex-col items-center justify-end flex-1 pb-1.5 -mt-5">
          <Link
            to={"/$countryCode/upload-rx" as any}
            params={{ countryCode } as any}
            onClick={() => hapticSelection()}
            className="flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg active:scale-95 transition-transform"
            style={{
              background: isRxActive
                ? "var(--color-brand-navy)"
                : "linear-gradient(135deg, var(--color-brand-teal), var(--color-brand-teal-dark))",
              boxShadow: "0 6px 20px -4px rgba(14,124,134,0.45), 0 2px 6px rgba(14,124,134,0.2)",
            }}
            aria-label="Upload Rx"
            aria-current={isRxActive ? "page" : undefined}
          >
            <RxIcon />
          </Link>
          <span
            className="text-[10px] font-semibold mt-1 leading-none"
            style={{ color: isRxActive ? "var(--color-brand-teal)" : "var(--color-brand-navy-90)" }}
          >
            Upload Rx
          </span>
        </div>

        {/* Right tabs: Orders, Account */}
        {SIDE_TABS.slice(2).map(({ key, label, Icon, path }) => {
          const isActive = activeTab === key
          return (
            <TabLink
              key={key}
              to={`/$countryCode${path}`}
              countryCode={countryCode}
              isActive={isActive}
              label={label}
            >
              <Icon active={isActive} />
            </TabLink>
          )
        })}
      </div>
    </nav>
  )
}

function TabLink({
  to, countryCode, isActive, label, children,
}: {
  to: string; countryCode: string; isActive: boolean; label: string; children: React.ReactNode
}) {
  return (
    <Link
      to={to as any}
      params={{ countryCode } as any}
      onClick={() => hapticSelection()}
      className="flex flex-col items-center justify-center gap-1 flex-1 h-full pt-2 pb-1.5 min-w-[56px] transition-colors relative"
      style={{
        color: isActive ? "var(--color-brand-teal)" : "rgba(13,27,42,0.4)",
      }}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
    >
      {/* Active indicator dot */}
      {isActive && (
        <div
          className="absolute top-1 w-1 h-1 rounded-full"
          style={{ background: "var(--color-brand-teal)" }}
        />
      )}
      {children}
      <span
        className="text-[10px] leading-none"
        style={{ fontWeight: isActive ? 700 : 500 }}
      >
        {label}
      </span>
    </Link>
  )
}
