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
import * as NavigationMenu from "@radix-ui/react-navigation-menu"
import { Link, useLocation } from "@tanstack/react-router"

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

export const Navbar = () => {
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"
  const { data: customer } = useCustomer()

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

          {/* Desktop Navigation */}
          <NavigationMenu.Root className="hidden lg:flex items-center h-full">
            <NavigationMenu.List className="flex items-center gap-x-8 h-full">
              <NavigationMenu.Item className="h-full flex items-center">
                <NavigationMenu.Trigger
                  className="h-full flex items-center gap-1 text-sm font-medium select-none transition-colors"
                  style={{ color: "#0D1B2A" }}
                >
                  Medicines
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginTop: 1 }}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </NavigationMenu.Trigger>
                <NavigationMenu.Content className="content-container py-10">
                  <div className="grid grid-cols-3 gap-10">
                    <div className="flex flex-col gap-5">
                      <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#0E7C86" }}>
                        Browse by Type
                      </h3>
                      <div className="flex flex-col gap-2.5">
                        <NavigationMenu.Link asChild>
                          <Link
                            to="/$countryCode/store"
                            params={{ countryCode }}
                            className="text-sm font-medium transition-colors hover:text-[#0E7C86]"
                            style={{ color: "#0D1B2A" }}
                          >
                            All Medicines
                          </Link>
                        </NavigationMenu.Link>
                        {categoryLinks.map((link) => (
                          <NavigationMenu.Link key={link.id} asChild>
                            <Link
                              to="/$countryCode/categories/$handle"
                              params={{ countryCode, handle: link.handle }}
                              className="text-sm font-medium transition-colors hover:text-[#0E7C86]"
                              style={{ color: "#0D1B2A" }}
                            >
                              {link.name}
                            </Link>
                          </NavigationMenu.Link>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-5">
                      <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#0E7C86" }}>
                        Services
                      </h3>
                      <div className="flex flex-col gap-2.5">
                        {[
                          { label: "Upload Prescription", href: "/" },
                          { label: "Chronic Reorder", href: "/" },
                          { label: "Pharmacist Helpline", href: "/" },
                          { label: "Track Order", href: "/" },
                        ].map((item) => (
                          <a
                            key={item.label}
                            href={item.href}
                            className="text-sm font-medium transition-colors hover:text-[#0E7C86]"
                            style={{ color: "#0D1B2A" }}
                          >
                            {item.label}
                          </a>
                        ))}
                      </div>
                    </div>
                    <div
                      className="rounded-lg p-5 flex flex-col gap-3 justify-between"
                      style={{ background: "#0D1B2A" }}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <PillIcon />
                          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#16a5b0" }}>
                            Verified Pharmacy
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                          Licensed by CDSCO · Form 18AA registered · LegitScript certified · Pharmacist-dispensed
                        </p>
                      </div>
                      <a
                        href="/pharmacy/licenses"
                        className="text-xs font-semibold underline transition-opacity hover:opacity-80"
                        style={{ color: "#16a5b0" }}
                      >
                        View our licenses →
                      </a>
                    </div>
                  </div>
                </NavigationMenu.Content>
              </NavigationMenu.Item>

              <NavigationMenu.Item>
                <Link
                  to="/$countryCode/store"
                  params={{ countryCode }}
                  className="text-sm font-medium transition-colors hover:text-[#0E7C86]"
                  style={{ color: "#0D1B2A" }}
                >
                  OTC Products
                </Link>
              </NavigationMenu.Item>

              <NavigationMenu.Item>
                <a
                  href="/prescription-policy"
                  className="text-sm font-medium transition-colors hover:text-[#0E7C86]"
                  style={{ color: "#0D1B2A" }}
                >
                  Prescription Policy
                </a>
              </NavigationMenu.Item>
            </NavigationMenu.List>

            <NavigationMenu.Viewport
              className="absolute top-full border-b shadow-lg overflow-hidden
                data-[state=open]:animate-[dropdown-open_300ms_ease-out]
                data-[state=closed]:animate-[dropdown-close_300ms_ease-out]"
              style={{
                left: "50%",
                transform: "translateX(-50%)",
                width: "100vw",
                background: "#fff",
                borderColor: "#EDE9E1",
              }}
            />
          </NavigationMenu.Root>

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
                  <a
                    key={item.label}
                    href={item.href}
                    className="px-8 py-3 text-sm font-medium hover:bg-[#F8F6F2] transition-colors"
                    style={{ color: "#0D1B2A" }}
                  >
                    {item.label}
                  </a>
                ))}
                <div className="px-6 pt-4 pb-2">
                  <div className="border-t" style={{ borderColor: "#EDE9E1" }} />
                </div>
                <DrawerClose asChild>
                  <Link
                    to={customer ? "/$countryCode/account/profile" : "/$countryCode/account/login"}
                    params={{ countryCode }}
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
            <a
              href="/"
              className="hidden lg:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded transition-all"
              style={{ color: "#0E7C86", background: "#d5f0e2" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Upload Rx
            </a>

            {/* Account / Sign in — visible label so users can find login */}
            <Link
              to={customer ? "/$countryCode/account/profile" : "/$countryCode/account/login"}
              params={{ countryCode }}
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
