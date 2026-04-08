import { CartDropdown } from "@/components/cart"
import { NotificationBell } from "@/components/notification-bell"
import { SearchDropdown, saveRecentSearch } from "@/components/search-dropdown"
import { ThemeToggle } from "@/components/theme-toggle"
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
import { useState, useRef, useEffect } from "react"

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
  const [scrolled, setScrolled] = useState(false)

  // Backdrop blur effect on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Search dropdown state
  const [searchFocused, setSearchFocused] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = searchQuery.trim()
    if (trimmed) {
      saveRecentSearch(trimmed)
      navigate({
        to: "/$countryCode/search",
        params: { countryCode },
        search: { q: trimmed },
      })
      setSearchQuery("")
      setSearchFocused(false)
    }
  }

  const handleSearchFocus = () => {
    if (blurTimeout.current) clearTimeout(blurTimeout.current)
    setSearchFocused(true)
    setHighlightIndex(-1)
  }

  const handleSearchBlur = () => {
    blurTimeout.current = setTimeout(() => setSearchFocused(false), 200)
  }

  const handleSelectProduct = (handle: string) => {
    saveRecentSearch(searchQuery.trim())
    navigate({
      to: "/$countryCode/products/$handle",
      params: { countryCode, handle },
    })
    setSearchQuery("")
    setSearchFocused(false)
  }

  const handleSubmitFromDropdown = (q: string) => {
    saveRecentSearch(q)
    navigate({
      to: "/$countryCode/search",
      params: { countryCode },
      search: { q },
    })
    setSearchQuery("")
    setSearchFocused(false)
  }

  const handleFillRecent = (q: string) => {
    setSearchQuery(q)
    setHighlightIndex(-1)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIndex((prev) => prev + 1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIndex((prev) => Math.max(-1, prev - 1))
    } else if (e.key === "Escape") {
      setSearchFocused(false)
    }
  }

  // Close dropdown on route change
  useEffect(() => { setSearchFocused(false) }, [location.pathname])

  const { data: topLevelCategories } = useCategories({
    fields: "id,name,handle,parent_category_id",
    queryParams: { parent_category_id: "null" },
  })

  const categoryLinks = topLevelCategories?.map((cat) => ({
    id: cat.id,
    name: cat.name,
    handle: cat.handle,
  })) ?? []

  // Close <details> dropdown on click-outside, Escape key, or route change
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const closeDropdown = () => {
    if (detailsRef.current) detailsRef.current.open = false
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (detailsRef.current?.open && !detailsRef.current.contains(e.target as Node)) {
        closeDropdown()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDropdown()
    }
    document.addEventListener("click", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("click", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [])

  // Close on route change
  useEffect(() => { closeDropdown() }, [location.pathname])

  return (
    <div className="sticky top-0 inset-x-0 z-40">

      {/* Main navigation */}
      <header
        className="relative mx-auto border-b transition-all duration-300"
        style={{
          background: scrolled ? "color-mix(in srgb, var(--bg-secondary) 85%, transparent)" : "var(--bg-secondary)",
          borderColor: scrolled ? "color-mix(in srgb, var(--border-primary) 40%, transparent)" : "var(--border-primary)",
          backdropFilter: scrolled ? "blur(20px) saturate(1.4)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(20px) saturate(1.4)" : "none",
        }}
      >
        <nav className="content-container flex items-center gap-x-4 w-full h-16">

          {/* ── Logo (left-aligned on desktop) ── */}
          <Link
            to="/$countryCode"
            params={{ countryCode }}
            className="hidden lg:flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, var(--brand-teal), #0a9272)" }}
            >
              <PillIcon />
            </div>
            <span
              className="text-lg font-semibold tracking-tight"
              style={{ color: "var(--text-primary)", fontFamily: "Fraunces, Georgia, serif" }}
            >
              Suprameds
            </span>
          </Link>

          {/* ── Desktop nav links ── */}
          <div className="hidden lg:flex items-center gap-x-1 flex-shrink-0">
            <details ref={detailsRef} className="group relative">
              <summary
                className="list-none flex items-center gap-1 px-3 py-1.5 rounded-full text-[13px] font-medium cursor-pointer select-none transition-colors hover:bg-[var(--bg-tertiary)]"
                style={{ color: "var(--text-primary)" }}
                aria-label="Medicines menu"
              >
                Medicines
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform duration-200 group-open:rotate-180" style={{ marginTop: 1 }} aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <div
                className="absolute left-0 mt-2 w-56 rounded-xl border shadow-lg p-2 z-50"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border-primary)" }}
              >
                <Link
                  to="/$countryCode/store"
                  params={{ countryCode }}
                  onClick={closeDropdown}
                  className="block px-3 py-2 text-sm font-medium hover:bg-[var(--bg-tertiary)] rounded-lg"
                  style={{ color: "var(--text-primary)" }}
                >
                  All Medicines
                </Link>
                {categoryLinks.map((link) => (
                  <Link
                    key={link.id}
                    to="/$countryCode/categories/$handle"
                    params={{ countryCode, handle: link.handle }}
                    onClick={closeDropdown}
                    className="block px-3 py-2 text-sm font-medium hover:bg-[var(--bg-tertiary)] rounded-lg"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            </details>

            <Link
              to="/$countryCode/store"
              params={{ countryCode }}
              search={{ schedule: "otc" } as any}
              className="px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors hover:bg-[var(--bg-tertiary)]"
              style={{ color: "var(--text-primary)" }}
            >
              OTC
            </Link>

            <Link
              to="/prescription-policy"
              className="px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors hover:bg-[var(--bg-tertiary)]"
              style={{ color: "var(--text-primary)" }}
            >
              Rx Policy
            </Link>
          </div>

          {/* ── Search bar (expanded, desktop) ── */}
          <form onSubmit={handleSearch} className="hidden lg:block relative flex-1 max-w-lg mx-4" role="search" aria-label="Search medicines">
            <div
              className="flex items-center rounded-full overflow-hidden transition-all"
              style={{
                background: searchFocused ? "var(--bg-secondary)" : "var(--bg-tertiary)",
                border: searchFocused ? "1.5px solid var(--brand-teal)" : "1.5px solid var(--border-primary)",
                boxShadow: searchFocused ? "0 0 0 3px rgba(14,124,134,0.08)" : "none",
              }}
            >
              <div className="pl-3.5" style={{ color: searchFocused ? "var(--brand-teal)" : "var(--text-tertiary)" }}>
                <SearchIcon />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setHighlightIndex(-1) }}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search medicines, e.g. Metformin, Paracetamol..."
                className="flex-1 px-2.5 py-2 text-sm outline-none bg-transparent caret-current"
                style={{ color: "var(--text-primary)" }}
                suppressHydrationWarning
                autoComplete="off"
              />
            </div>

            <SearchDropdown
              query={searchQuery}
              isOpen={searchFocused}
              highlightIndex={highlightIndex}
              onClose={() => setSearchFocused(false)}
              onSelectProduct={handleSelectProduct}
              onSubmitSearch={handleSubmitFromDropdown}
              onSetHighlight={setHighlightIndex}
              onFillRecent={handleFillRecent}
              countryCode={countryCode}
            />
          </form>

          {/* Mobile menu */}
          <Drawer>
            <DrawerTrigger className="lg:hidden" style={{ color: "var(--text-primary)" }}>
              <MenuIcon />
            </DrawerTrigger>
            <DrawerContent side="left">
              <DrawerHeader>
                <DrawerTitle className="font-serif text-lg" style={{ color: "var(--text-primary)" }}>
                  Suprameds
                </DrawerTitle>
              </DrawerHeader>
              <div className="flex flex-col py-4">
                {/* Mobile search */}
                <form
                  onSubmit={(e) => { handleSearch(e); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })) }}
                  className="px-6 pb-4"
                  role="search"
                >
                  <div
                    className="flex items-center rounded-lg overflow-hidden"
                    style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)" }}
                  >
                    <div className="pl-3" style={{ color: "var(--text-tertiary)" }}>
                      <SearchIcon />
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search medicines..."
                      className="px-2.5 py-2.5 text-sm outline-none bg-transparent flex-1"
                      style={{ color: "var(--text-primary)" }}
                    />
                  </div>
                </form>
                <div className="px-6 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--brand-teal)" }}>
                  Medicines
                </div>
                <div className="flex flex-col">
                  <DrawerClose asChild>
                    <Link
                      to="/$countryCode/store"
                      params={{ countryCode }}
                      className="px-8 py-3 text-sm font-medium hover:bg-[var(--bg-tertiary)] transition-colors"
                      style={{ color: "var(--text-primary)" }}
                    >
                      All Medicines
                    </Link>
                  </DrawerClose>
                  {categoryLinks.map((link) => (
                    <DrawerClose key={link.id} asChild>
                      <Link
                        to="/$countryCode/categories/$handle"
                        params={{ countryCode, handle: link.handle }}
                        className="px-8 py-3 text-sm font-medium hover:bg-[var(--bg-tertiary)] transition-colors"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {link.name}
                      </Link>
                    </DrawerClose>
                  ))}
                </div>
                <div className="px-6 pt-4 pb-2">
                  <div className="border-t" style={{ borderColor: "var(--border-primary)" }} />
                </div>
                {[
                  { label: "Prescription Policy", href: "/prescription-policy" },
                  { label: "Our Licenses", href: "/pharmacy/licenses" },
                  { label: "Grievance Officer", href: "/grievance" },
                ].map((item) => (
                  <DrawerClose key={item.label} asChild>
                    <Link
                      to={item.href}
                      className="px-8 py-3 text-sm font-medium hover:bg-[var(--bg-tertiary)] transition-colors"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {item.label}
                    </Link>
                  </DrawerClose>
                ))}
                <div className="px-6 pt-4 pb-2">
                  <div className="border-t" style={{ borderColor: "var(--border-primary)" }} />
                </div>
                <DrawerClose asChild>
                  <Link
                    to={customer ? "/$countryCode/account/profile" : "/$countryCode/account/login"}
                    params={{ countryCode }}
                    search={customer ? {} as any : { redirectTo: location.pathname } as any}
                    className="px-8 py-3 text-sm font-medium hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-2"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <PersonIcon />
                    {customer ? `${customer.first_name}'s Account` : "Sign in / Register"}
                  </Link>
                </DrawerClose>

                <div className="mx-8 mt-4 p-4 rounded-lg" style={{ background: "var(--bg-tertiary)" }}>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-primary)" }}>
                    <span className="font-semibold">Helpline: </span>
                    <a href="tel:+917674962758" className="underline">+91 76749 62758</a>
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>9 AM-9 PM · Mon-Sat</p>
                </div>
              </div>
            </DrawerContent>
          </Drawer>

          {/* Logo — mobile only (centered) */}
          <div className="lg:hidden flex-1 flex justify-center">
            <Link
              to="/$countryCode"
              params={{ countryCode }}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, var(--brand-teal), #0a9272)" }}
              >
                <PillIcon />
              </div>
              <span
                className="text-lg font-semibold tracking-tight"
                style={{ color: "var(--text-primary)", fontFamily: "Fraunces, Georgia, serif" }}
              >
                Suprameds
              </span>
            </Link>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-x-2 lg:gap-x-3 flex-shrink-0">
            <Link
              to="/$countryCode/upload-rx"
              params={{ countryCode }}
              className="hidden lg:flex items-center gap-1.5 text-xs font-medium px-3 py-2.5 rounded min-h-[44px] transition-all"
              style={{ color: "#0a6570", background: "#e8f5ee" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Upload Rx
            </Link>

            {/* Account / Sign in */}
            <Link
              to={customer ? "/$countryCode/account/profile" : "/$countryCode/account/login"}
              params={{ countryCode }}
              search={customer ? {} as any : { redirectTo: location.pathname } as any}
              className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-[var(--bg-tertiary)]"
              style={{ color: "var(--text-primary)" }}
              title={customer ? `${customer.first_name} ${customer.last_name}` : "Sign in or register"}
            >
              {customer ? (
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                  style={{ background: "var(--brand-green)", color: "var(--text-inverse)" }}
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

            <NotificationBell />
            <ThemeToggle />
            <CartDropdown />
          </div>
        </nav>
      </header>
    </div>
  )
}
