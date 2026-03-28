import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router"
import { useCustomer, useLogout } from "@/lib/hooks/use-customer"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { useLocation } from "@tanstack/react-router"
import { useEffect } from "react"

export const Route = createFileRoute("/$countryCode/account/_layout")({
  component: AccountLayout,
})

function AccountLayout() {
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"
  const navigate = useNavigate()
  const { data: customer, isLoading } = useCustomer()
  const logout = useLogout()

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        navigate({
          to: "/$countryCode/account/login",
          params: { countryCode },
          search: { redirectTo: location.pathname },
        })
      },
    })
  }

  // Redirect unauthenticated users to login — must be in useEffect, never during render
  useEffect(() => {
    if (!isLoading && !customer) {
      navigate({ to: "/$countryCode/account/login", params: { countryCode }, search: { redirectTo: location.pathname } })
    }
  }, [isLoading, customer, countryCode, navigate])

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading...</div>
      </div>
    )
  }

  if (!customer) {
    return null
  }

  const navItems = [
    { label: "Profile", to: `/${countryCode}/account/profile`, icon: PersonIcon },
    { label: "My Orders", to: `/${countryCode}/account/orders`, icon: BoxIcon },
    { label: "Addresses", to: `/${countryCode}/account/addresses`, icon: PinIcon },
    { label: "Wishlist", to: `/${countryCode}/account/wishlist`, icon: HeartNavIcon },
    { label: "Refill Reminders", to: `/${countryCode}/account/reminders`, icon: ClockIcon },
  ]

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="content-container py-8 lg:py-12">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="hidden lg:flex flex-col w-60 flex-shrink-0">
            <div
              className="bg-[var(--bg-secondary)] border rounded-xl p-5 mb-3"
              style={{ borderColor: "var(--border-primary)" }}
            >
              <div className="flex items-center gap-3 mb-4 pb-4 border-b" style={{ borderColor: "var(--border-primary)" }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-semibold"
                  style={{ background: "var(--bg-inverse)" }}
                >
                  {customer.first_name?.[0]?.toUpperCase() ?? "U"}
                  {customer.last_name?.[0]?.toUpperCase() ?? ""}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {customer.first_name} {customer.last_name}
                  </p>
                  <p className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>
                    {customer.email}
                  </p>
                </div>
              </div>

              <nav className="flex flex-col gap-0.5">
                {navItems.map(({ label, to, icon: Icon }) => {
                  const isActive = location.pathname === to
                  return (
                    <Link
                      key={to}
                      to={to}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                      style={{
                        color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                        background: isActive ? "var(--bg-tertiary)" : "transparent",
                      }}
                    >
                      <Icon />
                      {label}
                    </Link>
                  )
                })}
              </nav>
            </div>

            <button
              onClick={handleLogout}
              disabled={logout.isPending}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-red-50 w-full text-left disabled:opacity-60"
              style={{ color: "#B91C1C" }}
            >
              <LogoutIcon />
              {logout.isPending ? "Signing out..." : "Sign out"}
            </button>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Mobile nav */}
            <div
              className="lg:hidden flex gap-2 mb-6 overflow-x-auto pb-1"
            >
              {navItems.map(({ label, to }) => {
                const isActive = location.pathname === to
                return (
                  <Link
                    key={to}
                    to={to}
                    className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-all"
                    style={{
                      color: isActive ? "var(--text-inverse)" : "var(--text-primary)",
                      background: isActive ? "var(--bg-inverse)" : "var(--bg-secondary)",
                      borderColor: isActive ? "var(--bg-inverse)" : "var(--border-primary)",
                    }}
                  >
                    {label}
                  </Link>
                )
              })}
              <button
                onClick={handleLogout}
                className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-all"
                style={{ color: "#B91C1C", background: "var(--bg-secondary)", borderColor: "#FECACA" }}
              >
                Sign out
              </button>
            </div>

            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}

const PersonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
)

const BoxIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
  </svg>
)

const PinIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
)

const ClockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
)

const HeartNavIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
)

const LogoutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)
