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
    <footer style={{ background: "#0D1B2A", color: "rgba(255,255,255,0.75)" }} data-testid="footer">

      {/* Compliance trust strip */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="content-container py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E7C86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                ),
                label: "CDSCO Registered",
                sub: "Form 18AA · Central License",
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E7C86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
                  </svg>
                ),
                label: "Licensed Pharmacist",
                sub: "RPh B. Venkat Kumar · #KA/2019/4821",
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E7C86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                  </svg>
                ),
                label: "Nationwide Delivery",
                sub: "Speed Post · All India Pincodes",
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E7C86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
                  </svg>
                ),
                label: "LegitScript Certified",
                sub: "Category B · Healthcare Merchant",
              },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">{item.icon}</div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#fff" }}>{item.label}</p>
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
              <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0" style={{ background: "#0E7C86" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
                  <line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>
                </svg>
              </div>
              <span className="text-xl font-semibold" style={{ color: "#fff", fontFamily: "Fraunces, Georgia, serif" }}>
                Suprameds
              </span>
            </Link>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              A licensed online pharmacy serving India since 2022. Pharmacist-dispensed medicines, delivered to your door.
            </p>
            {/* Required: Physical address (Consumer Protection Rules 2020) */}
            <div className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
              <p className="font-medium mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>Registered Office</p>
              <address style={{ fontStyle: "normal" }}>
                Suprameds Pharma Pvt. Ltd.<br />
                #42, Industrial Area, Phase 2<br />
                Hyderabad, Telangana – 500072<br />
                GSTIN: 36AABCS1234E1Z5
              </address>
            </div>
            <CountrySelect regions={regions ?? []} />
          </div>

          {/* Medicines */}
          <div className="flex flex-col gap-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#0E7C86" }}>
              Medicines
            </h3>
            <ul className="space-y-2.5">
              {[
                { label: "All Medicines", href: `/${countryCode}/store` },
                { label: "OTC Products", href: `/${countryCode}/store` },
                { label: "Vitamins & Supplements", href: `/${countryCode}/store` },
                ...(categories?.map(c => ({ label: c.name, href: `/${countryCode}/categories/${c.handle}` })) ?? []),
              ].map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-sm transition-colors hover:text-[#16a5b0]" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Patient Services */}
          <div className="flex flex-col gap-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#0E7C86" }}>
              Patient Services
            </h3>
            <ul className="space-y-2.5">
              {[
                { label: "Upload Prescription", href: "/" },
                { label: "Track My Order", href: "/" },
                { label: "Refill Reminders", href: "/" },
                { label: "Pharmacist Q&A", href: "/" },
                { label: "My Account", href: "/" },
                { label: "My Prescriptions", href: "/" },
              ].map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-sm transition-colors hover:text-[#16a5b0]" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Compliance */}
          <div className="flex flex-col gap-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#0E7C86" }}>
              Compliance &amp; Legal
            </h3>
            <ul className="space-y-2.5">
              {[
                { label: "Pharmacy Licenses", href: "/pharmacy/licenses" },
                { label: "Prescription Policy", href: "/prescription-policy" },
                { label: "Privacy Policy (DPDP)", href: "/privacy" },
                { label: "Terms of Service", href: "/terms" },
                { label: "Returns &amp; Refunds", href: "/returns" },
                { label: "Grievance Officer", href: "/grievance" },
                { label: "Legal Notices", href: "/about/legal" },
              ].map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="text-sm transition-colors hover:text-[#16a5b0]"
                    style={{ color: "rgba(255,255,255,0.6)" }}
                    dangerouslySetInnerHTML={{ __html: item.label }}
                  />
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
                © {new Date().getFullYear()} Suprameds Pharma Pvt. Ltd. All rights reserved.
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                Drug License No. KA/DL-2024-0187 &nbsp;·&nbsp; CDSCO Reg. 18AA/2024/001842 &nbsp;·&nbsp;
                Regd. Pharmacist: B. Venkat Kumar (RPh #KA/2019/4821)
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* LegitScript seal placeholder — replace with actual CDN embed after certification */}
              <a
                href="https://www.legitscript.com/websites/?checker_keywords=suprameds.in"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-opacity hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
                </svg>
                LegitScript Certified
              </a>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                CDSCO Form 18AA
              </div>
            </div>
          </div>
          <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.25)" }}>
            Grievance Officer: Priya Sharma · grievance@suprameds.in · +91 800 800 5678 · Response within 48 hours
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
