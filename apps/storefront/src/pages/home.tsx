import { useLatestProducts } from "@/lib/hooks/use-products"
import { getProductPrice } from "@/lib/utils/price"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { Link, useLocation, useLoaderData } from "@tanstack/react-router"
import { Route } from "@/routes/$countryCode/index"

const UploadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
)

const Home = () => {
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"
  const { region } = useLoaderData({ from: "/$countryCode/" })

  const { data: latestProductsData } = useLatestProducts({ limit: 4, region_id: region?.id })
  const products = latestProductsData?.products ?? []

  return (
    <div style={{ background: "#F8F6F2" }}>

      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: "#0D1B2A",
          minHeight: "560px",
        }}
      >
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 25px 25px, #0E7C86 1px, transparent 0)`,
            backgroundSize: "50px 50px",
          }}
        />
        {/* Accent glow */}
        <div
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #0E7C86, transparent)" }}
        />
        <div
          className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #16a5b0, transparent)" }}
        />

        <div className="content-container relative z-10 py-20 lg:py-28">
          <div className="max-w-2xl">
            {/* Verified badge */}
            <div className="flex items-center gap-2 mb-6">
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: "rgba(14,124,134,0.2)", color: "#16a5b0", border: "1px solid rgba(14,124,134,0.3)" }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
                </svg>
                CDSCO Licensed · LegitScript Certified
              </div>
            </div>

            <h1
              className="text-4xl lg:text-5xl font-semibold leading-tight mb-5"
              style={{ color: "#fff", fontFamily: "Fraunces, Georgia, serif", letterSpacing: "-0.02em" }}
            >
              India's trusted online<br />
              <span style={{ color: "#16a5b0", fontStyle: "italic" }}>licensed pharmacy</span>
            </h1>

            <p className="text-base lg:text-lg leading-relaxed mb-8 max-w-lg" style={{ color: "rgba(255,255,255,0.65)" }}>
              Prescription and OTC medicines dispensed by registered pharmacists.
              Delivered to all India pincodes via Speed Post.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/$countryCode/store"
                params={{ countryCode }}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded text-sm font-semibold transition-all hover:opacity-90"
                style={{ background: "#0E7C86", color: "#fff" }}
              >
                Browse Medicines
                <ArrowRight />
              </Link>
              <Link
                to="/$countryCode/upload-rx"
                params={{ countryCode }}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded text-sm font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                <UploadIcon />
                Upload Prescription
              </Link>
            </div>

            {/* Trust marks */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-8">
              {[
                "Pharmacist verified dispensing",
                "5-year prescription records",
                "DPDP compliant data privacy",
                "Nationwide Speed Post delivery",
              ].map((item) => (
                <div key={item} className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                  <CheckIcon />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Hero bottom stat bar */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)" }}>
          <div className="content-container py-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { value: "3+", label: "Years Licensed" },
                { value: "350+", label: "Monthly Orders" },
                { value: "5000+", label: "Medicines" },
                { value: "All India", label: "Delivery Coverage" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-xl font-semibold" style={{ color: "#16a5b0", fontFamily: "Fraunces, Georgia, serif" }}>
                    {stat.value}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="content-container py-16 lg:py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#0E7C86" }}>
            The Suprameds Process
          </p>
          <h2
            className="text-2xl lg:text-3xl font-semibold"
            style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}
          >
            Pharmacy-grade care, delivered home
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              step: "01",
              title: "Upload Prescription",
              body: "Photograph your doctor's prescription. We accept PDF, JPG, or WhatsApp photo uploads.",
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              ),
            },
            {
              step: "02",
              title: "Pharmacist Reviews",
              body: "Our registered pharmacist (RPh) reviews your prescription within 4 hours and approves dispensing.",
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
                </svg>
              ),
            },
            {
              step: "03",
              title: "Payment & Dispatch",
              body: "Pay by UPI, card, netbanking, or COD. We dispatch the same day for orders before 2 PM.",
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                </svg>
              ),
            },
            {
              step: "04",
              title: "Tracked Delivery",
              body: "India Post Speed Post to your door. Live AfterShip tracking. OTP confirmation for Rx orders.",
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
              ),
            },
          ].map((item, i) => (
            <div
              key={item.step}
              className="p-6 rounded-xl flex flex-col gap-4"
              style={{ background: "#fff", border: "1px solid #EDE9E1" }}
            >
              <div className="flex items-start justify-between">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "#F8F6F2", color: "#0E7C86" }}
                >
                  {item.icon}
                </div>
                <span
                  className="text-3xl font-light"
                  style={{ color: "#EDE9E1", fontFamily: "Fraunces, Georgia, serif" }}
                >
                  {item.step}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-1.5" style={{ color: "#0D1B2A" }}>
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "#666" }}>
                  {item.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURED PRODUCTS ── */}
      {products.length > 0 && (
        <section style={{ background: "#fff", borderTop: "1px solid #EDE9E1", borderBottom: "1px solid #EDE9E1" }}>
          <div className="content-container py-16 lg:py-20">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#0E7C86" }}>
                  Available Now
                </p>
                <h2
                  className="text-2xl lg:text-3xl font-semibold"
                  style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}
                >
                  Latest in our catalog
                </h2>
              </div>
              <Link
                to="/$countryCode/store"
                params={{ countryCode }}
                className="hidden md:flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70"
                style={{ color: "#0E7C86" }}
              >
                View all medicines <ArrowRight />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {products.map((product) => {
                const { cheapestPrice } = getProductPrice({ product, region })
                const isRx = (product as any).metadata?.requires_prescription
                const scheduleClass = (product as any).metadata?.schedule_classification

                return (
                  <Link
                    key={product.id ?? product.handle}
                    to="/$countryCode/products/$handle"
                    params={{ countryCode, handle: product.handle ?? "" }}
                    className="group flex flex-col rounded-xl overflow-hidden transition-all hover:shadow-lg"
                    style={{ background: "#F8F6F2", border: "1px solid #EDE9E1" }}
                  >
                    {/* Image */}
                    <div className="relative aspect-square overflow-hidden" style={{ background: "#fff" }}>
                      {product.thumbnail ? (
                        <img
                          src={product.thumbnail}
                          alt={product.title ?? ""}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#EDE9E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
                            <line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>
                          </svg>
                        </div>
                      )}
                      {/* Badges */}
                      <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                        {isRx && <span className="badge-rx">Rx Only</span>}
                        {scheduleClass && scheduleClass !== "OTC" && (
                          <span className="badge-rx" style={{ background: "#D68910" }}>Sch. {scheduleClass}</span>
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4 flex flex-col gap-2 flex-1">
                      <div>
                        <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "#999" }}>
                          {(product as any).metadata?.manufacturer ?? (product as any).metadata?.drug_class ?? "Medicine"}
                        </p>
                        <h3 className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: "#0D1B2A" }}>
                          {product.title}
                        </h3>
                        {(product as any).metadata?.generic_name && (
                          <p className="text-xs mt-0.5" style={{ color: "#888" }}>
                            {(product as any).metadata.generic_name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-2">
                        <div>
                          {cheapestPrice ? (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-sm font-semibold" style={{ color: "#0D1B2A" }}>
                                {cheapestPrice.calculated_price}
                              </span>
                              {cheapestPrice.original_price !== cheapestPrice.calculated_price && (
                                <span className="text-xs line-through" style={{ color: "#bbb" }}>
                                  {cheapestPrice.original_price}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: "#999" }}>See price</span>
                          )}
                          {(product as any).metadata?.mrp && (
                            <p className="text-xs" style={{ color: "#aaa" }}>
                              MRP ₹{(product as any).metadata.mrp}
                            </p>
                          )}
                        </div>
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
                          style={{ background: "#0E7C86", color: "#fff" }}
                        >
                          <ArrowRight />
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            <div className="mt-6 md:hidden text-center">
              <Link
                to="/$countryCode/store"
                params={{ countryCode }}
                className="inline-flex items-center gap-1.5 text-sm font-medium"
                style={{ color: "#0E7C86" }}
              >
                View all medicines <ArrowRight />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── COMPLIANCE CALLOUT ── */}
      <section className="content-container py-16 lg:py-20">
        <div
          className="rounded-2xl p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center"
          style={{ background: "#0D1B2A" }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#16a5b0" }}>
              Legal &amp; Compliant
            </p>
            <h2
              className="text-2xl lg:text-3xl font-semibold mb-4 leading-tight"
              style={{ color: "#fff", fontFamily: "Fraunces, Georgia, serif" }}
            >
              Every dispensing follows<br />Indian pharmacy law
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
              Suprameds operates under the Drugs &amp; Cosmetics Act 1940, Pharmacy Act 1948, and CDSCO's Draft E-Pharmacy Rules 2018.
              No Schedule X or NDPS drugs are sold online. Rx dispensing only by registered pharmacists.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/pharmacy/licenses" className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium transition-opacity hover:opacity-80" style={{ background: "#0E7C86", color: "#fff" }}>
                View our licenses
              </a>
              <a href="/prescription-policy" className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium transition-opacity hover:opacity-80" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.15)" }}>
                Prescription policy
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Drugs & Cosmetics Act, 1940", status: "Compliant" },
              { label: "Pharmacy Act, 1948", status: "Compliant" },
              { label: "CDSCO Form 18AA", status: "Registered" },
              { label: "DPDP Act, 2023", status: "Compliant" },
              { label: "LegitScript Category B", status: "Certified" },
              { label: "Consumer Protection Rules 2020", status: "Compliant" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-2 p-3 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(14,124,134,0.2)" }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16a5b0" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium leading-snug" style={{ color: "rgba(255,255,255,0.8)" }}>{item.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#16a5b0" }}>{item.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CHRONIC REORDER CTA ── */}
      <section style={{ background: "#fff", borderTop: "1px solid #EDE9E1" }}>
        <div className="content-container py-12 lg:py-16">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3
                className="text-xl lg:text-2xl font-semibold mb-2"
                style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}
              >
                On chronic medication?
              </h3>
              <p className="text-sm" style={{ color: "#666" }}>
                Set up monthly refill reminders. We'll WhatsApp you before you run out.
              </p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <Link
                to="/$countryCode/account/login"
                params={{ countryCode }}
                className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ background: "#0D1B2A", color: "#fff" }}
              >
                Set up refill reminders
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}

export default Home
