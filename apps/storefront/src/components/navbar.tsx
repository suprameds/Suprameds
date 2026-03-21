import { CartDropdown } from "@/components/cart"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { useCustomer } from "@/lib/hooks/use-customer"
import { useCategories } from "@/lib/hooks/use-categories"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { Link, useLocation, useNavigate } from "@tanstack/react-router"
import { useState } from "react"

const ANNOUNCEMENT_DISMISSED_KEY = "suprameds_announce_dismissed"

function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true
    return window.localStorage.getItem(ANNOUNCEMENT_DISMISSED_KEY) === "1"
  })

  if (dismissed) return null

  return (
    <div
      className="relative overflow-hidden text-center py-2 px-4 text-xs font-medium tracking-wide"
      style={{ background: "linear-gradient(90deg, #0E7C86, #1A9A5C)", color: "#fff" }}
    >
      <div className="content-container flex items-center justify-center gap-x-2 sm:gap-x-4 flex-wrap gap-y-1">
        <span className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          Save 50–80% on Generic Medicines
        </span>
        <span className="hidden sm:inline opacity-60">|</span>
        <span className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          FREE Delivery above ₹300
        </span>
        <span className="hidden sm:inline opacity-60">|</span>
        <span className="hidden sm:flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          2-Day Delivery in T.S. & A.P.
        </span>
      </div>
      <button
        onClick={() => { setDismissed(true); window.localStorage.setItem(ANNOUNCEMENT_DISMISSED_KEY, "1") }}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss announcement"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  )
}

const ShieldIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const PhoneIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.69l3.2-.01a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.09a16 16 0 0 0 6 6l1.56-1.56a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.04z" />
  </svg>
)

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
)

const PillIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
    <line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>
  </svg>
)

const PersonIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
)

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

export const Navbar = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"
  const { data: customer } = useCustomer()
  const [searchQuery, setSearchQuery] = useState("")

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = searchQuery.trim()
    if (trimmed) {
      navigate({
        to: "/$countryCode/search",
        params: { countryCode },
        search: { q: trimmed },
      })
      setSearchQuery("")
    }
  }

  const { data: topLevelCategories } = useCategories({
    fields: "id,name,handle,parent_category_id",
    queryParams: { parent_category_id: "null" },
  })

  const categoryLinks = topLevelCategories?.map((cat) => ({
    id: cat.id,
    name: cat.name,
    handle: cat.handle,
  })) ?? []

  return (
    <div className="sticky top-0 inset-x-0 z-40">
      <AnnouncementBar />
      {/* Compliance top bar — LegitScript & CDSCO crawlable */}
      <div className="compliance-bar w-full">
        <div className="content-container flex items-center justify-between py-1.5">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-white/70">
              <ShieldIcon />
              <span>Lic. No. KA/DL-2024-0187 &nbsp;|&nbsp; Regd. Pharmacist: B. Venkat Kumar (RPh #KA/2019/4821)</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a href="tel:+918008001234" className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors">
              <PhoneIcon />
              <span>+91 800 800 1234</span>
            </a>
            <span className="text-white/40">|</span>
            <span className="text-white/60">9 AM–9 PM Mon–Sat</span>
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <header className="relative mx-auto border-b" style={{ background: "#fff", borderColor: "#EDE9E1" }}>
        <nav className="content-container flex items-center justify-between w-full h-16">

          {/* Desktop Navigation (plain links to avoid Radix NavigationMenu render loop in React 19) */}
          <div className="hidden lg:flex items-center gap-x-8 h-full">
            <details className="group relative">
              <summary
                className="list-none flex items-center gap-1 text-sm font-medium cursor-pointer"
                style={{ color: "#0D1B2A" }}
                aria-label="Medicines menu"
              >
                Medicines
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginTop: 1 }} aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <div
                className="absolute left-0 mt-2 w-64 rounded-lg border bg-white shadow-lg p-3 z-50"
                style={{ borderColor: "#EDE9E1" }}
              >
                <Link
                  to="/$countryCode/store"
                  params={{ countryCode }}
                  className="block px-2 py-2 text-sm font-medium hover:bg-[#F8F6F2] rounded"
                  style={{ color: "#0D1B2A" }}
                >
                  All Medicines
                </Link>
                {categoryLinks.map((link) => (
                  <Link
                    key={link.id}
                    to="/$countryCode/categories/$handle"
                    params={{ countryCode, handle: link.handle }}
                    className="block px-2 py-2 text-sm font-medium hover:bg-[#F8F6F2] rounded"
                    style={{ color: "#0D1B2A" }}
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            </details>

            <Link
              to="/$countryCode/store"
              params={{ countryCode }}
              className="text-sm font-medium transition-colors hover:text-[#0E7C86]"
              style={{ color: "#0D1B2A" }}
            >
              OTC Products
            </Link>

            <Link
              to="/prescription-policy"
              className="text-sm font-medium transition-colors hover:text-[#0E7C86]"
              style={{ color: "#0D1B2A" }}
            >
              Prescription Policy
            </Link>

            <form onSubmit={handleSearch} className="flex items-center ml-2" role="search" aria-label="Search medicines">
              <div
                className="flex items-center rounded-lg overflow-hidden"
                style={{ background: "#F8F6F2", border: "1px solid #EDE9E1" }}
              >
                <div className="pl-2.5" style={{ color: "#999" }}>
                  <SearchIcon />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search medicines..."
                  className="px-2 py-1.5 text-xs outline-none bg-transparent w-36 xl:w-48"
                  style={{ color: "#0D1B2A" }}
                />
              </div>
            </form>
          </div>

          {/* Mobile menu */}
          <Drawer>
            <DrawerTrigger className="lg:hidden" style={{ color: "#0D1B2A" }}>
              <MenuIcon />
            </DrawerTrigger>
            <DrawerContent side="left">
              <DrawerHeader>
                <DrawerTitle className="font-serif text-lg" style={{ color: "#0D1B2A" }}>
                  Suprameds
                </DrawerTitle>
              </DrawerHeader>
              <div className="flex flex-col py-4">
                <div className="px-6 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "#0E7C86" }}>
                  Medicines
                </div>
                <div className="flex flex-col">
                  <DrawerClose asChild>
                    <Link
                      to="/$countryCode/store"
                      params={{ countryCode }}
                      className="px-8 py-3 text-sm font-medium hover:bg-[#F8F6F2] transition-colors"
                      style={{ color: "#0D1B2A" }}
                    >
                      All Medicines
                    </Link>
                  </DrawerClose>
                  {categoryLinks.map((link) => (
                    <DrawerClose key={link.id} asChild>
                      <Link
                        to="/$countryCode/categories/$handle"
                        params={{ countryCode, handle: link.handle }}
                        className="px-8 py-3 text-sm font-medium hover:bg-[#F8F6F2] transition-colors"
                        style={{ color: "#0D1B2A" }}
                      >
                        {link.name}
                      </Link>
                    </DrawerClose>
                  ))}
                </div>
                <div className="px-6 pt-4 pb-2">
                  <div className="border-t" style={{ borderColor: "#EDE9E1" }} />
                </div>
                {[
                  { label: "Prescription Policy", href: "/prescription-policy" },
                  { label: "Our Licenses", href: "/pharmacy/licenses" },
                  { label: "Grievance Officer", href: "/grievance" },
                ].map((item) => (
                  <DrawerClose key={item.label} asChild>
                    <Link
                      to={item.href}
                      className="px-8 py-3 text-sm font-medium hover:bg-[#F8F6F2] transition-colors"
                      style={{ color: "#0D1B2A" }}
                    >
                      {item.label}
                    </Link>
                  </DrawerClose>
                ))}
                <div className="px-6 pt-4 pb-2">
                  <div className="border-t" style={{ borderColor: "#EDE9E1" }} />
                </div>
                <DrawerClose asChild>
                  <Link
                    to={customer ? "/$countryCode/account/profile" : "/$countryCode/account/login"}
                    params={{ countryCode }}
                    search={{ redirectTo: undefined } as any}
                    className="px-8 py-3 text-sm font-medium hover:bg-[#F8F6F2] transition-colors flex items-center gap-2"
                    style={{ color: "#0D1B2A" }}
                  >
                    <PersonIcon />
                    {customer ? `${customer.first_name}'s Account` : "Sign in / Register"}
                  </Link>
                </DrawerClose>

                <div className="mx-8 mt-4 p-4 rounded-lg" style={{ background: "#F8F6F2" }}>
                  <p className="text-xs leading-relaxed" style={{ color: "#0D1B2A" }}>
                    <span className="font-semibold">Helpline: </span>
                    <a href="tel:+918008001234" className="underline">+91 800 800 1234</a>
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#666" }}>9 AM–9 PM · Mon–Sat</p>
                </div>
              </div>
            </DrawerContent>
          </Drawer>

          {/* Logo — centered */}
          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2">
            <Link
              to="/$countryCode"
              params={{ countryCode }}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div
                className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                style={{ background: "#0D1B2A" }}
              >
                <PillIcon />
              </div>
              <span
                className="font-serif text-xl font-semibold tracking-tight"
                style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}
              >
                Suprameds
              </span>
            </Link>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-x-3 h-full justify-end">
            <Link
              to="/$countryCode/upload-rx"
              params={{ countryCode }}
              className="hidden lg:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded transition-all"
              style={{ color: "#0E7C86", background: "#d5f0e2" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Upload Rx
            </Link>

            {/* Account / Sign in — visible label so users can find login */}
            <Link
              to={customer ? "/$countryCode/account/profile" : "/$countryCode/account/login"}
              params={{ countryCode }}
              search={{ redirectTo: undefined } as any}
              className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-gray-100"
              style={{ color: "#0D1B2A" }}
              title={customer ? `${customer.first_name} ${customer.last_name}` : "Sign in or register"}
            >
              {customer ? (
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                  style={{ background: "#27AE60" }}
                >
                  {customer.first_name?.[0]?.toUpperCase() ?? "U"}
                </span>
              ) : (
                <PersonIcon />
              )}
              <span className="text-sm font-medium">
                {customer ? "Account" : "Sign in"}
              </span>
            </Link>

            <CartDropdown />
          </div>
        </nav>
      </header>
    </div>
  )
}
