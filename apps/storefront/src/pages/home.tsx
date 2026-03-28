import type React from "react"
import { useLatestProducts } from "@/lib/hooks/use-products"
import { useCategories } from "@/lib/hooks/use-categories"
import { getProductPrice } from "@/lib/utils/price"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import ProductCard from "@/components/product-card"
import { Reveal } from "@/components/ui/reveal"
import { Counter } from "@/components/ui/counter"
import { Link, useLocation, useLoaderData, useNavigate } from "@tanstack/react-router"
import { Route } from "@/routes/$countryCode/index"
import { useState } from "react"

/* ── Inline SVG icons (tree-shakeable, no icon lib) ── */

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
)

const ChevronDown = ({ open }: { open: boolean }) => (
  <svg
    width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
    className={`flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

/* ── Category icon map ── */
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  tablets: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="3" width="14" height="18" rx="2"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="15" y2="14"/></svg>,
  capsules: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/></svg>,
  syrups: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 2h8v4H8z"/><path d="M6 6h12v16H6z"/><path d="M10 12h4"/></svg>,
  default: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>,
}

function getCategoryIcon(handle: string): React.ReactNode {
  const lower = handle.toLowerCase()
  if (lower.includes("tablet")) return CATEGORY_ICONS.tablets
  if (lower.includes("capsule")) return CATEGORY_ICONS.capsules
  if (lower.includes("syrup") || lower.includes("liquid")) return CATEGORY_ICONS.syrups
  return CATEGORY_ICONS.default
}

/* ── FAQ data ── */
const FAQ_ITEMS = [
  {
    q: "Do I need a prescription to buy medicines on Suprameds?",
    a: "OTC (over-the-counter) medicines can be purchased without a prescription. For Schedule H and H1 medicines, you must upload a valid prescription from a registered medical practitioner. Our pharmacist verifies every prescription before dispensing.",
  },
  {
    q: "How do I know the medicines are genuine?",
    a: "We source directly from licensed pharmaceutical manufacturers and distributors. Every batch is tracked with lot number, manufacturing date, and expiry date. Our operations are governed by the Drugs & Cosmetics Act 1940.",
  },
  {
    q: "What are generic medicines? Are they safe?",
    a: "Generic medicines contain the same active ingredient, dosage, and efficacy as branded drugs — they just cost less because the patent has expired. They are approved by the CDSCO (India's drug regulator) and must meet the same quality standards.",
  },
  {
    q: "How long does delivery take?",
    a: "Within Telangana & Andhra Pradesh: 1–2 business days. Rest of India: 5–7 business days via India Post Speed Post. Orders above ₹300 get free delivery.",
  },
  {
    q: "Can I return or cancel an order?",
    a: "Due to pharmaceutical regulations, medicines cannot be returned once dispatched. However, you can cancel before dispatch. If you receive a damaged or incorrect product, we'll arrange a replacement or refund within 48 hours.",
  },
  {
    q: "Is my personal and medical data safe?",
    a: "Absolutely. We comply with the Digital Personal Data Protection Act 2023 (DPDP). Your prescription records are encrypted and stored securely. We never share medical data with third parties.",
  },
]

/* ── Main component ── */

const Home = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"
  const { region } = useLoaderData({ from: "/$countryCode/" })

  const { data: latestProductsData } = useLatestProducts({ limit: 8, region_id: region?.id })
  const products = latestProductsData?.products ?? []

  const { data: categories } = useCategories({
    fields: "id,name,handle,parent_category_id",
    queryParams: { parent_category_id: "null" } as any,
  })

  const [searchQuery, setSearchQuery] = useState("")
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = searchQuery.trim()
    if (trimmed) {
      navigate({
        to: "/$countryCode/search",
        params: { countryCode },
        search: { q: trimmed },
      })
    }
  }

  return (
    <div style={{ background: "#F8F6F2" }}>

      {/* ════════════════════════════════════════════
          HERO — dark navy, search bar, value props
         ════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ background: "#0D1B2A" }}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('/images/hero-bg.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.45,
          }}
        />

        <div className="content-container relative z-10 py-16 lg:py-24">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-5">
              <span
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: "rgba(14,124,134,0.2)", color: "#16a5b0", border: "1px solid rgba(14,124,134,0.3)" }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
                </svg>
                CDSCO Licensed · LegitScript Certified
              </span>
            </div>

            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-[1.15] mb-3"
              style={{ color: "#fff", fontFamily: "Fraunces, Georgia, serif", letterSpacing: "-0.02em" }}
            >
              Generic Medicines at{" "}
              <span style={{ color: "#27AE60", fontStyle: "italic" }}>50–80% Off</span>
            </h1>
            <p className="text-base lg:text-lg mb-6" style={{ color: "rgba(255,255,255,0.7)" }}>
              Same composition, same efficacy — dispensed by registered pharmacists across India.
            </p>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="mb-6">
              <div
                className="flex items-center rounded-lg overflow-hidden max-w-xl"
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                <div className="pl-4" style={{ color: "rgba(255,255,255,0.4)" }}><SearchIcon /></div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for medicines, e.g. Metformin, Amlodipine..."
                  className="flex-1 px-3 py-3.5 text-sm bg-transparent outline-none placeholder:text-white/30"
                  style={{ color: "#fff" }}
                />
                <button
                  type="submit"
                  className="px-5 py-3.5 text-sm font-semibold transition-opacity hover:opacity-90 flex-shrink-0"
                  style={{ background: "#0E7C86", color: "#fff" }}
                >
                  Search
                </button>
              </div>
            </form>

            <div className="flex flex-wrap gap-2 mb-6">
              {[
                { icon: "truck", text: "FREE Delivery above ₹300" },
                { icon: "clock", text: "2-Day Delivery in T.S. & A.P." },
                { icon: "india", text: "Pan-India Speed Post" },
              ].map((pill) => (
                <span
                  key={pill.text}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ background: "rgba(39,174,96,0.12)", color: "#68D89B", border: "1px solid rgba(39,174,96,0.18)" }}
                >
                  {pill.icon === "truck" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>}
                  {pill.icon === "clock" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
                  {pill.icon === "india" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>}
                  {pill.text}
                </span>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/$countryCode/store"
                params={{ countryCode }}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #0E7C86, #0a9272)", color: "#fff", boxShadow: "0 2px 12px rgba(14,124,134,0.25)" }}
              >
                Browse All Medicines <ArrowRight />
              </Link>
              <Link
                to="/$countryCode/upload-rx"
                params={{ countryCode }}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all hover:border-[#0E7C86]"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.85)", border: "1.5px solid rgba(255,255,255,0.15)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload Prescription
              </Link>
            </div>
          </div>

          {/* ── Glassmorphism floating badges (desktop only) ── */}
          <div className="hidden lg:block absolute right-8 top-1/2 -translate-y-1/2" style={{ zIndex: 5 }}>
            <div
              className="absolute -top-16 right-0 flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: "rgba(255,255,255,0.78)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                border: "1px solid rgba(255,255,255,0.4)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                animation: "float 5s ease-in-out infinite",
              }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(14,124,134,0.1)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E7C86" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: "#0D1B2A" }}>CDSCO Registered</p>
                <p className="text-[10px]" style={{ color: "#6B7280" }}>Form 18AA Verified</p>
              </div>
            </div>
            <div
              className="absolute top-24 right-8 flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: "rgba(255,255,255,0.78)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                border: "1px solid rgba(255,255,255,0.4)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                animation: "float 5s 2.5s ease-in-out infinite",
              }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(184,146,47,0.08)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8922F" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: "#0D1B2A" }}>Avg. Savings</p>
                <p className="text-[10px]" style={{ color: "#6B7280" }}>₹1,240 / month</p>
              </div>
            </div>
          </div>
        </div>

        {/* Hero stat bar */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.15)" }}>
          <div className="content-container py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { value: <><Counter end={80} suffix="%" /></>, label: "Max Savings on Generics" },
                { value: "₹0", label: "Delivery above ₹300" },
                { value: <><Counter end={5000} suffix="+" /></>, label: "Medicines Available" },
                { value: "2-Day", label: "Delivery in TS & AP" },
              ].map((stat, i) => (
                <Reveal key={i} delay={i * 0.08}>
                  <div className="text-center">
                    <p className="text-lg font-semibold" style={{ color: "#16a5b0", fontFamily: "Fraunces, Georgia, serif" }}>{stat.value}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{stat.label}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>

        {/* Float animation for hero badges */}
        <style>{`@keyframes float { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-6px); } }`}</style>
      </section>

      {/* ════════════════════════════════════════════
          SHOP BY CATEGORY
         ════════════════════════════════════════════ */}
      {categories && categories.length > 0 && (
        <section style={{ background: "#fff", borderTop: "1px solid #EDE9E1", borderBottom: "1px solid #EDE9E1" }}>
          <div className="content-container py-14 lg:py-18">
            <Reveal>
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#0E7C86" }}>Browse</p>
                <h2 className="text-2xl lg:text-3xl font-semibold" style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}>Shop by Category</h2>
              </div>
              <Link
                to="/$countryCode/store"
                params={{ countryCode }}
                className="hidden md:flex items-center gap-1.5 text-sm font-medium hover:opacity-70 transition-opacity"
                style={{ color: "#0E7C86" }}
              >
                View all <ArrowRight />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to="/$countryCode/categories/$handle"
                  params={{ countryCode, handle: cat.handle }}
                  className="group flex flex-col items-center gap-3 p-5 rounded-xl text-center transition-all hover:shadow-md hover:-translate-y-0.5"
                  style={{ background: "#F8F6F2", border: "1px solid #EDE9E1" }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors group-hover:bg-[#E0F7FA]"
                    style={{ background: "#E8F5E9", color: "#0E7C86" }}
                  >
                    {getCategoryIcon(cat.handle)}
                  </div>
                  <span className="text-sm font-medium" style={{ color: "#0D1B2A" }}>{cat.name}</span>
                </Link>
              ))}

              {/* Always-visible "All Medicines" card */}
              <Link
                to="/$countryCode/store"
                params={{ countryCode }}
                className="group flex flex-col items-center gap-3 p-5 rounded-xl text-center transition-all hover:shadow-md hover:-translate-y-0.5"
                style={{ background: "#0D1B2A" }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(14,124,134,0.2)", color: "#16a5b0" }}>
                  <ArrowRight />
                </div>
                <span className="text-sm font-medium" style={{ color: "#fff" }}>All Medicines</span>
              </Link>
            </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════
          FEATURED PRODUCTS
         ════════════════════════════════════════════ */}
      {products.length > 0 && (
        <section className="content-container py-14 lg:py-18">
          <Reveal>
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#0E7C86" }}>Popular</p>
              <h2 className="text-2xl lg:text-3xl font-semibold" style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}>
                Best-selling medicines
              </h2>
            </div>
            <Link
              to="/$countryCode/store"
              params={{ countryCode }}
              className="hidden md:flex items-center gap-1.5 text-sm font-medium hover:opacity-70 transition-opacity"
              style={{ color: "#0E7C86" }}
            >
              View all <ArrowRight />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
            {products.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
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
          </Reveal>
        </section>
      )}

      {/* ════════════════════════════════════════════
          PRESCRIPTION CTA — mid-page conversion
         ════════════════════════════════════════════ */}
      <section className="content-container py-14 lg:py-18">
        <Reveal>
        <div className="rounded-2xl overflow-hidden" style={{ boxShadow: "0 8px 48px rgba(0,0,0,0.08)" }}>
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Left: dark navy */}
            <div className="p-10 lg:p-14 flex flex-col justify-center" style={{ background: "linear-gradient(155deg, #0D1B2A, #16384D)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: "#10A37F" }}>
                <span style={{ width: 20, height: 1.5, background: "#10A37F", borderRadius: 1, display: "inline-block" }} />
                Prescription Medicines
              </p>
              <h2 className="text-2xl lg:text-3xl font-semibold leading-tight mb-4" style={{ color: "#fff", fontFamily: "Fraunces, Georgia, serif" }}>
                Have a doctor's prescription?
              </h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.55)" }}>
                Upload your prescription and our pharmacist will prepare your order with maximum generic savings.
              </p>

              <div className="flex flex-col gap-3 mb-8">
                {[
                  { n: "1", t: "Upload a photo or PDF", d: "JPG, PNG, or PDF — all formats accepted" },
                  { n: "2", t: "Pharmacist reviews in 4 hrs", d: "Generic alternatives suggested for savings" },
                  { n: "3", t: "Secure, encrypted storage", d: "DPDP Act compliant · 5-year retention" },
                ].map((step) => (
                  <div key={step.n} className="flex gap-3 items-start">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold" style={{ background: "rgba(16,163,127,0.12)", color: "#10A37F" }}>
                      {step.n}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#fff" }}>{step.t}</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{step.d}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                to="/$countryCode/upload-rx"
                params={{ countryCode }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all hover:opacity-90 self-start"
                style={{ background: "linear-gradient(135deg, #0E7C86, #0a9272)", color: "#fff", boxShadow: "0 2px 12px rgba(14,124,134,0.25)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload Prescription Now
              </Link>
            </div>

            {/* Right: light gradient with drop zone */}
            <div className="p-10 lg:p-14 flex flex-col items-center justify-center gap-5" style={{ background: "linear-gradient(155deg, #E6F4F0, #F5F0E8)" }}>
              <div
                className="w-full max-w-xs rounded-2xl p-10 text-center cursor-pointer transition-all hover:scale-[1.02]"
                style={{ border: "2px dashed rgba(14,124,134,0.2)", background: "rgba(255,255,255,0.55)", backdropFilter: "blur(6px)" }}
              >
                <div className="text-4xl mb-3">📄</div>
                <h4 className="text-sm font-bold mb-1" style={{ color: "#0D1B2A" }}>Drag & drop your Rx here</h4>
                <p className="text-[11px]" style={{ color: "#6B7280" }}>or click to browse · JPG, PNG, PDF</p>
              </div>
              <p className="text-[11px]" style={{ color: "#9CA3AF" }}>Max 10MB · Reviewed within 4 hours</p>

              {/* Compliance pills */}
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {["Drugs & Cosmetics Act", "CDSCO Form 18AA", "DPDP Act 2023", "LegitScript Certified"].map((c) => (
                  <span key={c} className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: "#9CA3AF" }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#10A37F" }} />
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        </Reveal>
      </section>

      {/* ════════════════════════════════════════════
          WHY SUPRAMEDS — trust signals
         ════════════════════════════════════════════ */}
      <section className="content-container py-14 lg:py-18">
        <Reveal>
          <div className="text-center mb-10">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center justify-center gap-2" style={{ color: "#0E7C86" }}>
              <span style={{ width: 20, height: 1.5, background: "#0E7C86", borderRadius: 1, display: "inline-block" }} />
              Why Suprameds
              <span style={{ width: 20, height: 1.5, background: "#0E7C86", borderRadius: 1, display: "inline-block" }} />
            </p>
            <h2 className="text-2xl lg:text-3xl font-semibold" style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}>
              Built on trust, backed by compliance
            </h2>
          </div>
        </Reveal>

        {/* Bento grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Wide navy card */}
          <Reveal className="sm:col-span-2 rounded-2xl p-8 transition-all hover:-translate-y-1" style={{ background: "#0D1B2A", border: "1px solid transparent" }}>
            <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4" style={{ background: "rgba(255,255,255,0.1)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <p className="text-4xl font-semibold mb-1" style={{ fontFamily: "Fraunces, Georgia, serif", background: "linear-gradient(135deg, #C9A55A, #DDB76A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              0.0%
            </p>
            <h3 className="text-lg font-semibold mb-2" style={{ color: "#fff", fontFamily: "Fraunces, Georgia, serif" }}>No Hidden Markups</h3>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>Direct from WHO-GMP certified manufacturers. No middlemen, no franchise fees. Just the real cost of quality medicine.</p>
          </Reveal>

          {/* Teal accent card */}
          <Reveal delay={0.1} className="rounded-2xl p-8 transition-all hover:-translate-y-1" style={{ background: "linear-gradient(150deg, #0E7C86, #0a9272)", border: "1px solid transparent" }}>
            <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4" style={{ background: "rgba(255,255,255,0.1)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/><path d="M9 12l2 2 4-4"/></svg>
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: "#fff", fontFamily: "Fraunces, Georgia, serif" }}>Pharmacist Verified</h3>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>RPh B. Venkat Kumar (Reg #KA/2019/4821) reviews every prescription before dispensing. No exceptions.</p>
          </Reveal>

          {/* Regular cards */}
          <Reveal delay={0.1} className="rounded-2xl p-8 transition-all hover:-translate-y-1 hover:shadow-lg" style={{ background: "#fff", border: "1px solid #EDE9E1" }}>
            <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4" style={{ background: "#E6F4F0", color: "#0E7C86" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
            </div>
            <h3 className="text-sm font-bold mb-2" style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}>Batch Tracked</h3>
            <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>Every medicine tracked by batch number, MFG & expiry date. FEFO allocation ensures freshness.</p>
          </Reveal>

          <Reveal delay={0.15} className="rounded-2xl p-8 transition-all hover:-translate-y-1 hover:shadow-lg" style={{ background: "#fff", border: "1px solid #EDE9E1" }}>
            <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4" style={{ background: "rgba(217,79,59,0.06)", color: "#D94F3B" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            </div>
            <h3 className="text-sm font-bold mb-2" style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}>Pan-India Delivery</h3>
            <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>India Post Speed Post to all serviceable pincodes. Free delivery on orders above ₹300.</p>
          </Reveal>

          <Reveal delay={0.2} className="rounded-2xl p-8 transition-all hover:-translate-y-1 hover:shadow-lg" style={{ background: "#fff", border: "1px solid #EDE9E1" }}>
            <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4" style={{ background: "rgba(184,146,47,0.07)", color: "#B8922F" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            </div>
            <h3 className="text-sm font-bold mb-2" style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}>Data Privacy</h3>
            <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>DPDP Act 2023 compliant. Encrypted prescription storage. Your data is never shared.</p>
          </Reveal>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          FAQ
         ════════════════════════════════════════════ */}
      <section style={{ background: "#fff", borderTop: "1px solid #EDE9E1" }}>
        <div className="content-container py-14 lg:py-18">
          <div className="max-w-3xl mx-auto">
            <Reveal>
            <div className="text-center mb-10">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#0E7C86" }}>Support</p>
              <h2 className="text-2xl lg:text-3xl font-semibold" style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}>
                Frequently asked questions
              </h2>
            </div>
            </Reveal>

            <div className="space-y-3">
              {FAQ_ITEMS.map((item, i) => {
                const isOpen = openFaq === i
                return (
                  <div key={i} className="rounded-xl overflow-hidden" style={{ border: "1px solid #EDE9E1" }}>
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="w-full flex items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-[#FAFAF8]"
                      style={{ background: isOpen ? "#FAFAF8" : "#fff" }}
                      aria-expanded={isOpen}
                    >
                      <span className="text-sm font-semibold" style={{ color: "#0D1B2A" }}>{item.q}</span>
                      <ChevronDown open={isOpen} />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5">
                        <p className="text-sm leading-relaxed" style={{ color: "#666" }}>{item.a}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          HOW IT WORKS — 4-step process
         ════════════════════════════════════════════ */}
      <section className="content-container py-14 lg:py-18">
        <Reveal>
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#0E7C86" }}>How It Works</p>
          <h2 className="text-2xl lg:text-3xl font-semibold" style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}>
            Pharmacy-grade care, delivered home
          </h2>
        </div>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { step: "01", title: "Search or Upload Rx", body: "Find your medicine by name or upload a doctor's prescription. We accept PDF, JPG, or photo uploads.", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
            { step: "02", title: "Pharmacist Reviews", body: "Our registered pharmacist (RPh) reviews your order and verifies prescriptions within 4 hours.", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg> },
            { step: "03", title: "Pay Your Way", body: "UPI, debit/credit card, netbanking, or Cash on Delivery. Orders before 2 PM ship same day.", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> },
            { step: "04", title: "Tracked Delivery", body: "India Post Speed Post to your door with live tracking. OTP confirmation for Rx orders.", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
          ].map((item, i) => (
            <Reveal key={item.step} delay={0.1 + i * 0.1}>
            <div className="p-5 rounded-xl flex flex-col gap-3 h-full transition-all hover:-translate-y-1 hover:shadow-lg" style={{ background: "#fff", border: "1px solid #EDE9E1" }}>
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: "linear-gradient(135deg, #0E7C86, #0a9272)", color: "#fff" }}>{item.icon}</div>
                <span className="text-2xl font-light" style={{ color: "#EDE9E1", fontFamily: "Fraunces, Georgia, serif" }}>{item.step}</span>
              </div>
              <h3 className="text-sm font-semibold" style={{ color: "#0D1B2A" }}>{item.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#666" }}>{item.body}</p>
            </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════
          CHRONIC REORDER CTA
         ════════════════════════════════════════════ */}
      <section style={{ borderTop: "1px solid #EDE9E1" }}>
        <div className="content-container py-10 lg:py-14">
          <div
            className="flex flex-col md:flex-row items-center justify-between gap-6 p-8 rounded-xl"
            style={{ background: "#0D1B2A" }}
          >
            <div>
              <h3 className="text-lg lg:text-xl font-semibold mb-1" style={{ color: "#fff", fontFamily: "Fraunces, Georgia, serif" }}>
                On chronic medication?
              </h3>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                Set up monthly refill reminders. We'll notify you before you run out.
              </p>
            </div>
            <Link
              to="/$countryCode/account/reminders"
              params={{ countryCode }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 flex-shrink-0"
              style={{ background: "#0E7C86", color: "#fff" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Set up reminders
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}

export default Home
