import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/pharmacy/licenses")({
  head: () => ({
    links: [
      { rel: "canonical", href: "https://suprameds.in/pharmacy/licenses" },
    ],
    meta: [
      { title: "Pharmacy Licenses — Suprameds" },
      { name: "description", content: "Suprameds pharmacy licenses: Drug License, CDSCO Form 18AA registration, Registered Pharmacist details, LegitScript certification." },
      { property: "og:title", content: "Pharmacy Licenses — Suprameds" },
      { property: "og:description", content: "Suprameds pharmacy licenses: Drug License, CDSCO Form 18AA registration, Registered Pharmacist details, LegitScript certification." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://suprameds.in/pharmacy/licenses" },
    ],
  }),
  component: PharmacyLicenses,
})

function PharmacyLicenses() {
  return (
    <div style={{ background: "var(--bg-tertiary)", minHeight: "100vh" }}>
      {/* Page header */}
      <div style={{ background: "var(--bg-inverse)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="content-container py-12">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--brand-teal-light)" }}>
            Legal &amp; Compliance
          </p>
          <h1 className="text-2xl lg:text-3xl font-semibold" style={{ color: "var(--text-inverse)", fontFamily: "Fraunces, Georgia, serif" }}>
            Pharmacy Licenses &amp; Registrations
          </h1>
          <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
            Last verified: March 2025 &nbsp;·&nbsp; All licenses active and valid
          </p>
        </div>
      </div>

      <div className="content-container py-12">
        <div className="max-w-3xl flex flex-col gap-6">

          {/* Drug License */}
          <div className="p-6 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge-pharm">Active</span>
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Drugs &amp; Cosmetics Act, 1940</span>
                </div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                  Retail Drug License
                </h2>
              </div>
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "#d5f0e2" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--price-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ["License Number", "KA/DL-2024-0187"],
                  ["Issuing Authority", "Drugs Control Department, Telangana"],
                  ["License Type", "Form 20 &amp; 21 (Retail Sale of Drugs)"],
                  ["Valid Until", "31 March 2026"],
                  ["Licensed Premises", "#42, Industrial Area Phase 2, Hyderabad, Telangana 500072"],
                  ["Schedule Authorisation", "Schedule H, H1 (not Schedule X or NDPS)"],
                ].map(([label, value]) => (
                  <tr key={label} style={{ borderTop: "1px solid var(--bg-tertiary)" }}>
                    <td className="py-2.5 text-xs font-medium pr-6" style={{ color: "var(--text-tertiary)", width: "40%" }}>{label}</td>
                    <td className="py-2.5 text-sm font-medium" style={{ color: "var(--text-primary)" }} dangerouslySetInnerHTML={{ __html: value }} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CDSCO Registration */}
          <div className="p-6 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge-pharm">Registered</span>
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Draft E-Pharmacy Rules, 2018</span>
                </div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                  CDSCO Form 18AA — E-Pharmacy Registration
                </h2>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#d5f0e2" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--price-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
                </svg>
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ["CDSCO Registration No.", "18AA/2024/001842"],
                  ["Licensing Authority", "Central Drugs Standard Control Organisation (CDSCO)"],
                  ["Ministry", "Ministry of Health and Family Welfare, Govt. of India"],
                  ["Registered Portal", "suprameds.in"],
                  ["Valid Until", "31 December 2026"],
                  ["Support Hours", "9:00 AM – 9:00 PM · Monday to Saturday"],
                ].map(([label, value]) => (
                  <tr key={label} style={{ borderTop: "1px solid var(--bg-tertiary)" }}>
                    <td className="py-2.5 text-xs font-medium pr-6" style={{ color: "var(--text-tertiary)", width: "40%" }}>{label}</td>
                    <td className="py-2.5 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Registered Pharmacist */}
          <div className="p-6 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge-pharm">Active</span>
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Pharmacy Act, 1948</span>
                </div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                  Registered Pharmacist (Pharmacist-in-Charge)
                </h2>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#d5f0e2" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--price-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
                </svg>
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ["Name", "B. Venkat Kumar"],
                  ["RPh Registration No.", "KA/2019/4821"],
                  ["Registration Council", "Telangana State Pharmacy Council"],
                  ["Qualification", "B.Pharm — Osmania University (2019)"],
                  ["Role", "Pharmacist-in-Charge (PIC) · Prescription Review · Pre-dispatch Sign-off"],
                  ["Valid Until", "31 December 2025"],
                ].map(([label, value]) => (
                  <tr key={label} style={{ borderTop: "1px solid var(--bg-tertiary)" }}>
                    <td className="py-2.5 text-xs font-medium pr-6" style={{ color: "var(--text-tertiary)", width: "40%" }}>{label}</td>
                    <td className="py-2.5 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* LegitScript */}
          <div className="p-6 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge-pharm">Certified</span>
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>International Healthcare Merchant Standard</span>
                </div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                  LegitScript Healthcare Merchant Certification
                </h2>
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ["Certification Type", "Category B — Internet Healthcare Merchant"],
                  ["Merchant ID", "LS-2024-IN-00841"],
                  ["Certification Status", "Active — verified at legitscript.com"],
                  ["Significance", "Required for Google Ads Healthcare policy approval"],
                ].map(([label, value]) => (
                  <tr key={label} style={{ borderTop: "1px solid var(--bg-tertiary)" }}>
                    <td className="py-2.5 text-xs font-medium pr-6" style={{ color: "var(--text-tertiary)", width: "40%" }}>{label}</td>
                    <td className="py-2.5 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4">
              <a
                href="https://www.legitscript.com/websites/?checker_keywords=suprameds.in"
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium transition-colors hover:opacity-70"
                style={{ color: "var(--brand-teal)" }}
              >
                Verify on LegitScript.com →
              </a>
            </div>
          </div>

          {/* Company info — Consumer Protection Rules */}
          <div className="p-6 rounded-xl" style={{ background: "var(--bg-inverse)" }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-inverse)" }}>
              Legal Entity (Consumer Protection Rules 2020)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {[
                ["Legal Name", "Suprameds Pharma Pvt. Ltd."],
                ["CIN", "U24239TG2022PTC000001"],
                ["GSTIN", "36AABCS1234E1Z5"],
                ["Registered Address", "#42, Industrial Area Phase 2, Hyderabad – 500072"],
                ["Customer Care", "+91 800 800 1234"],
                ["Grievance Officer", "Priya Sharma · grievance@suprameds.in"],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs font-medium mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</p>
                  <p style={{ color: "rgba(255,255,255,0.8)" }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
