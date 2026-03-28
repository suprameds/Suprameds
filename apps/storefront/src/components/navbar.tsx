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
      <header className="relative mx-auto border-b" style={{ background: "#fff", borderColor: "#EDE9E1" }}>
        <nav className="content-container flex items-center justify-between w-full h-16">

          {/* Desktop Navigation (plain links to avoid Radix NavigationMenu render loop in React 19) */}
          <div className="hidden lg:flex items-center gap-x-8 h-full">
            <details ref={detailsRef} className="group relative">
              <summary
                className="list-none flex items-center gap-1 text-sm font-medium cursor-pointer select-none"
                style={{ color: "#0D1B2A" }}
                aria-label="Medicines menu"
              >
                Medicines
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform duration-200 group-open:rotate-180" style={{ marginTop: 1 }} aria-hidden="true">
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
                  onClick={closeDropdown}
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
                    onClick={closeDropdown}
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
                {/* Mobile search */}
                <form
                  onSubmit={(e) => { handleSearch(e); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })) }}
                  className="px-6 pb-4"
                  role="search"
                >
                  <div
                    className="flex items-center rounded-lg overflow-hidden"
                    style={{ background: "#F8F6F2", border: "1px solid #EDE9E1" }}
                  >
                    <div className="pl-3" style={{ color: "#999" }}>
                      <SearchIcon />
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search medicines..."
                      className="px-2.5 py-2.5 text-sm outline-none bg-transparent flex-1"
                      style={{ color: "#0D1B2A" }}
                    />
                  </div>
                </form>
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
                    search={customer ? {} as any : { redirectTo: location.pathname } as any}
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
              search={customer ? {} as any : { redirectTo: location.pathname } as any}
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
