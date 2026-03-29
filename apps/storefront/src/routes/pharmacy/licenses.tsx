import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/pharmacy/licenses")({
  head: () => ({
    links: [
      { rel: "canonical", href: "https://suprameds.in/pharmacy/licenses" },
    ],
    meta: [
      { title: "Pharmacy Licenses — Suprameds" },
      { name: "description", content: "Suprameds pharmacy licenses: Drug License TS/HYD/2021-82149, Registered Pharmacist details." },
      { property: "og:title", content: "Pharmacy Licenses — Suprameds" },
      { property: "og:description", content: "Suprameds pharmacy licenses: Drug License TS/HYD/2021-82149, Registered Pharmacist details." },
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
                  ["License Number", "TS/HYD/2021-82149"],
                  ["Issuing Authority", "Drugs Control Administration, Govt. of Telangana"],
                  ["License Type", "Form 20 &amp; 21 (Retail Sale of Drugs)"],
                  ["Date of Issue", "20 September 2021"],
                  ["Next Retention Fee Due", "19 September 2026"],
                  ["Licensed Premises", "1st Floor, H.No 7-2-544, SRT 323, Sanathnagar, Hyderabad – 500018, Telangana"],
                  ["Schedule Authorisation", "Schedules C, C(1) — excluding Schedule X (Form 20 &amp; 21)"],
                ].map(([label, value]) => (
                  <tr key={label} style={{ borderTop: "1px solid var(--bg-tertiary)" }}>
                    <td className="py-2.5 text-xs font-medium pr-6" style={{ color: "var(--text-tertiary)", width: "40%" }}>{label}</td>
                    <td className="py-2.5 text-sm font-medium" style={{ color: "var(--text-primary)" }} dangerouslySetInnerHTML={{ __html: value }} />
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
                  ["Name", "Mirza Askary Ali"],
                  ["Registration No.", "031171/A1"],
                  ["Registration Date", "25 August 2000"],
                  ["Registration Council", "Telangana State Pharmacy Council"],
                  ["Qualification", "B.Pharmacy"],
                  ["Role", "Pharmacist-in-Charge (PIC) · Prescription Review · Pre-dispatch Sign-off"],
                ].map(([label, value]) => (
                  <tr key={label} style={{ borderTop: "1px solid var(--bg-tertiary)" }}>
                    <td className="py-2.5 text-xs font-medium pr-6" style={{ color: "var(--text-tertiary)", width: "40%" }}>{label}</td>
                    <td className="py-2.5 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Company info — Consumer Protection Rules */}
          <div className="p-6 rounded-xl" style={{ background: "var(--bg-inverse)" }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-inverse)" }}>
              Legal Entity (Consumer Protection Rules 2020)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {[
                ["Legal Name", "Supracyn Pharma Pvt Ltd"],
                ["GSTIN", "36ABGCS8302R1ZP"],
                ["Directors", "Guntupalli Mallishwari · Bollempalli Satyanarayana"],
                ["Registered Address", "1st Floor, H.No 7-2-544, SRT 323, Sanathnagar, Hyderabad – 500018, Telangana"],
                ["Customer Care", "+91 76749 62758"],
                ["Helpdesk Email", "suprameds@gmail.com"],
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
