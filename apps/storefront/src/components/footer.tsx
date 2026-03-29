import CountrySelect from "@/components/country-select"
import { useCategories } from "@/lib/hooks/use-categories"
import { useRegions } from "@/lib/hooks/use-regions"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { Link, useLocation } from "@tanstack/react-router"

const Footer = () => {
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"

  const { data: categories } = useCategories({
    fields: "name,handle",
    queryParams: { parent_category_id: "null", limit: 6 },
  })

  const { data: regions } = useRegions({
    fields: "id, currency_code, *countries",
  })

  return (
    <footer style={{ background: "var(--bg-inverse)", color: "rgba(255,255,255,0.75)" }} data-testid="footer">

      {/* Compliance trust strip */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="content-container py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand-teal)" }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                ),
                label: "Licensed Pharmacy",
                sub: "Drugs & Cosmetics Act 1940",
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand-teal)" }}>
                    <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
                  </svg>
                ),
                label: "Licensed Pharmacist",
                sub: "Mirza Askary Ali, B.Pharm · #031171/A1",
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand-teal)" }}>
                    <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                  </svg>
                ),
                label: "Nationwide Delivery",
                sub: "Speed Post · All India Pincodes",
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand-teal)" }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
                  </svg>
                ),
                label: "Drug License Active",
                sub: "TS/HYD/2021-82149 · Form 20 & 21",
              },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">{item.icon}</div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-inverse)" }}>{item.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="content-container py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand + Address */}
          <div className="lg:col-span-1 flex flex-col gap-5">
            <Link to="/$countryCode" params={{ countryCode }} className="flex items-center gap-2 hover:opacity-80 transition-opacity w-fit">
              <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0" style={{ background: "var(--brand-teal)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-inverse)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
                  <line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>
                </svg>
              </div>
              <span className="text-xl font-semibold" style={{ color: "var(--text-inverse)", fontFamily: "Fraunces, Georgia, serif" }}>
                Suprameds
              </span>
            </Link>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              A licensed online pharmacy serving India since 2022. Pharmacist-dispensed medicines, delivered to your door.
            </p>
            {/* Required: Physical address (Consumer Protection Rules 2020) */}
            <div className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              <p className="font-medium mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Registered Office</p>
              <address style={{ fontStyle: "normal" }}>
                Supracyn Private Limited<br />
                D.No.7-2-544, SRT 323, Room No.1, 1st Floor<br />
                Opp Lodha Apartments, Sanathnagar<br />
                Hyderabad, Telangana
              </address>
            </div>
            <CountrySelect regions={regions ?? []} />
          </div>

          {/* Medicines */}
          <div className="flex flex-col gap-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--brand-teal)" }}>
              Medicines
            </h3>
            <ul className="space-y-2.5">
              {[
                { label: "All Medicines", href: `/${countryCode}/store` },
                ...(categories?.map(c => ({ label: c.name, href: `/${countryCode}/categories/${c.handle}` })) ?? []),
              ].map((item) => (
                <li key={item.label}>
                  <Link to={item.href} className="text-sm transition-colors hover:text-[var(--brand-teal-light)]" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Patient Services */}
          <div className="flex flex-col gap-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--brand-teal)" }}>
              Patient Services
            </h3>
            <ul className="space-y-2.5">
              {[
                { label: "Upload Prescription", href: `/${countryCode}/upload-rx` },
                { label: "My Account", href: `/${countryCode}/account` },
                { label: "My Orders", href: `/${countryCode}/account/orders` },
              ].map((item) => (
                <li key={item.label}>
                  <Link to={item.href} className="text-sm transition-colors hover:text-[var(--brand-teal-light)]" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Compliance */}
          <div className="flex flex-col gap-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--brand-teal)" }}>
              Compliance &amp; Legal
            </h3>
            <ul className="space-y-2.5">
              {[
                { label: "Pharmacy Licenses", href: "/pharmacy/licenses" },
                { label: "Prescription Policy", href: "/prescription-policy" },
                { label: "Privacy Policy (DPDP)", href: "/privacy" },
                { label: "Terms of Service", href: "/terms" },
                { label: "Returns & Refunds", href: "/returns" },
                { label: "Grievance Officer", href: "/grievance" },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    to={item.href}
                    className="text-sm transition-colors hover:text-[var(--brand-teal-light)]"
                    style={{ color: "rgba(255,255,255,0.6)" }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            {/* Emergency */}
            <div className="mt-2 p-3 rounded-lg" style={{ background: "rgba(192, 57, 43, 0.15)", border: "1px solid rgba(192,57,43,0.3)" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "#fadbd8" }}>Poison Control Emergency</p>
              <a href="tel:1800116117" className="text-sm font-bold" style={{ color: "#ff6b6b" }}>
                1800-116-117
              </a>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>National Helpline · Free · 24/7</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="content-container py-5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                © {new Date().getFullYear()} Supracyn Private Limited. All rights reserved.
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                Drug License No. TS/HYD/2021-82149 &nbsp;·&nbsp;
                Regd. Pharmacist: Mirza Askary Ali, B.Pharm (Reg #031171/A1)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                DL: TS/HYD/2021-82149
              </div>
            </div>
          </div>
          <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.25)" }}>
            Helpdesk: suprameds@gmail.in · +91 76749 62758 · Response within 48 hours
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
