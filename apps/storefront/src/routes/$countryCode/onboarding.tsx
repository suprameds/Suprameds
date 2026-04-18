import { createFileRoute, useNavigate, useLocation } from "@tanstack/react-router"
import { useState, useRef, useCallback, useEffect } from "react"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { BrandLogo } from "@/components/auth/brand-logo"
import { ArrowRightIcon, ShieldCheckIcon } from "@/components/auth/auth-icons"

export const Route = createFileRoute("/$countryCode/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome to Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OnboardingPage,
})

function OnboardingPage() {
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const touchStartX = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Desktop: skip onboarding entirely
  useEffect(() => {
    if (window.innerWidth >= 1024) {
      localStorage.setItem("suprameds_onboarding_seen", "true")
      navigate({ to: "/$countryCode/account/login", params: { countryCode }, search: { redirectTo: undefined } })
    }
  }, [navigate, countryCode])

  const finish = useCallback(() => {
    localStorage.setItem("suprameds_onboarding_seen", "true")
    navigate({ to: "/$countryCode/account/login", params: { countryCode }, search: { redirectTo: undefined } })
  }, [navigate, countryCode])

  const next = useCallback(() => {
    if (current < 2) setCurrent((c) => c + 1)
    else finish()
  }, [current, finish])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      if (diff > 0 && current < 2) setCurrent((c) => c + 1)
      if (diff < 0 && current > 0) setCurrent((c) => c - 1)
    }
  }

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next()
      if ((e.key === "ArrowLeft" || e.key === "ArrowUp") && current > 0)
        setCurrent((c) => c - 1)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [next, current])

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Skip button */}
      <div className="flex justify-end px-6 pt-4">
        <button
          onClick={finish}
          className="text-[13px] font-semibold py-2 px-3 min-w-[44px] min-h-[44px] flex items-center"
          style={{ color: "var(--color-brand-navy-90)" }}
          aria-label="Skip onboarding"
        >
          Skip
        </button>
      </div>

      {/* Slides container */}
      <div
        ref={containerRef}
        className="flex-1 flex flex-col overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex-1 flex"
          style={{
            transform: `translateX(-${current * 100}%)`,
            transition: prefersReducedMotion ? "none" : "transform 350ms ease-out",
          }}
        >
          <Slide1 />
          <Slide2 />
          <Slide3 />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-6 pb-8 pt-4">
        {/* Dots */}
        <div className="flex gap-1.5 items-center" role="tablist" aria-label="Onboarding slides">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === current}
              aria-label={`Slide ${i + 1} of 3`}
              onClick={() => setCurrent(i)}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === current ? 22 : 6,
                background:
                  i === current
                    ? "var(--color-brand-teal)"
                    : "var(--color-brand-cream-dark)",
              }}
            />
          ))}
        </div>

        {/* Next button */}
        <button
          onClick={next}
          className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-white transition-all hover:opacity-90 active:scale-95"
          style={{ background: "var(--color-brand-navy)", boxShadow: "0 8px 24px rgba(13,27,42,.2)" }}
          aria-label={current === 2 ? "Get started" : "Next slide"}
        >
          <ArrowRightIcon size={18} />
        </button>
      </div>
    </div>
  )
}

/* ── Slide Wrapper ── */
function SlideFrame({
  children,
  heroContent,
  heroBg,
  title,
  desc,
}: {
  children?: React.ReactNode
  heroContent: React.ReactNode
  heroBg: string
  title: React.ReactNode
  desc: string
}) {
  return (
    <div className="w-full flex-shrink-0 flex flex-col px-4 gap-5" role="tabpanel">
      {/* Hero area */}
      <div
        className="flex-1 min-h-[300px] rounded-[28px] relative overflow-hidden flex items-center justify-center"
        style={{ background: heroBg }}
      >
        {heroContent}
      </div>

      {/* Text */}
      <div className="px-2">
        <h2
          className="text-[28px] leading-[1.1] tracking-[-0.02em]"
          style={{ fontFamily: "var(--font-serif)", color: "var(--color-brand-navy)" }}
        >
          {title}
        </h2>
        <p className="text-[13px] leading-relaxed mt-2.5" style={{ color: "var(--color-brand-navy-90)", opacity: 0.6 }}>
          {desc}
        </p>
      </div>
      {children}
    </div>
  )
}

/* ── Slide 1: Delivery ── */
function Slide1() {
  return (
    <SlideFrame
      heroBg="radial-gradient(circle at 80% 20%, rgba(14,124,134,.12), transparent 50%), radial-gradient(circle at 20% 80%, rgba(14,124,134,.15), transparent 50%), linear-gradient(180deg, #F0FAF8 0%, #E0F5F0 100%)"
      title={<>Doorstep delivery <em className="italic" style={{ color: "var(--color-brand-teal)" }}>across India</em></>}
      desc="Free Speed Post shipping on orders over ₹300. Track every order from pack-out to your doorstep."
      heroContent={
        <div className="absolute inset-5 rounded-[22px] bg-white/55 backdrop-blur-sm border border-white/80 p-4 flex flex-col">
          {/* Map grid background */}
          <svg className="absolute inset-0 w-full h-full rounded-[22px]" viewBox="0 0 200 280" preserveAspectRatio="xMidYMid slice">
            <defs>
              <pattern id="grid-onb" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(13,27,42,.06)" strokeWidth=".5" />
              </pattern>
              <linearGradient id="route-grad-onb" x1="0" y1="100%" x2="100%" y2="0">
                <stop offset="0%" stopColor="var(--color-brand-teal)" />
                <stop offset="100%" stopColor="var(--color-brand-teal-light)" />
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-onb)" />
            <path d="M 0 60 Q 60 50 100 90 T 200 120" fill="none" stroke="rgba(13,27,42,.1)" strokeWidth="6" />
            <path d="M 200 40 Q 140 80 130 160 T 40 240" fill="none" stroke="rgba(13,27,42,.08)" strokeWidth="4" />
            <path d="M 30 220 Q 60 160 100 140 Q 140 120 170 60" fill="none" stroke="url(#route-grad-onb)" strokeWidth="3" strokeLinecap="round" />
          </svg>

          {/* Delivery card at bottom */}
          <div className="mt-auto relative z-10 bg-white rounded-[18px] p-3.5 shadow-md flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(14,124,134,.1)", color: "var(--color-brand-teal)" }}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7h13v10H3z" /><path d="M16 10h4l2 3v4h-6z" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold" style={{ color: "var(--color-brand-navy)" }}>On the way</div>
              <div className="text-[10px]" style={{ color: "var(--color-brand-navy-90)", opacity: 0.5 }}>Order #SPM-2461 &middot; Speed Post</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold italic" style={{ fontFamily: "var(--font-serif)", color: "var(--color-brand-navy)" }}>2 days</div>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--color-brand-navy-90)", opacity: 0.5 }}>ETA</div>
            </div>
          </div>
        </div>
      }
    />
  )
}

/* ── Slide 2: Savings ── */
function Slide2() {
  return (
    <SlideFrame
      heroBg="radial-gradient(circle at 30% 30%, rgba(14,124,134,.15), transparent 55%), radial-gradient(circle at 80% 80%, rgba(14,124,134,.1), transparent 55%), linear-gradient(160deg, #EFFAF8 0%, #E0F5F0 100%)"
      title={<>Save <em className="italic" style={{ color: "var(--color-brand-teal)" }}>up to 80%</em> on every prescription</>}
      desc="Licensed generic alternatives with the same active ingredient — at a fraction of the branded MRP."
      heroContent={
        <div className="relative w-[200px] h-[260px]">
          {/* Branded MRP card */}
          <div
            className="absolute top-5 left-0 w-[180px] p-4 bg-white rounded-[18px] opacity-70"
            style={{ transform: "rotate(-6deg)", boxShadow: "0 24px 60px rgba(13,27,42,.12)" }}
          >
            <div className="text-[9px] uppercase tracking-[0.2em] font-semibold" style={{ color: "var(--color-brand-navy-90)", opacity: 0.5 }}>Branded MRP</div>
            <div className="flex items-baseline gap-1 mt-1.5">
              <span className="text-sm font-semibold opacity-70">₹</span>
              <span className="text-[34px] italic line-through" style={{ fontFamily: "var(--font-serif)", color: "var(--color-brand-cream-dark)" }}>420</span>
            </div>
            <div className="text-[10px] mt-1.5" style={{ color: "var(--color-brand-navy-90)", opacity: 0.5 }}>Glimepiride 2mg &middot; 10 tabs</div>
          </div>

          {/* Suprameds price card */}
          <div
            className="absolute top-[90px] left-5 w-[180px] p-4 rounded-[18px] text-white"
            style={{ background: "var(--color-brand-navy)", transform: "rotate(4deg)", boxShadow: "0 24px 60px rgba(13,27,42,.25)" }}
          >
            {/* Badge */}
            <div
              className="absolute -top-3 -right-4 px-3 py-2 rounded-full text-[11px] font-extrabold text-white"
              style={{
                background: "var(--color-brand-teal)",
                transform: "rotate(10deg)",
                boxShadow: "0 10px 20px -4px rgba(14,124,134,.4)",
              }}
            >
              -68%
            </div>
            <div className="text-[9px] uppercase tracking-[0.2em] font-semibold" style={{ color: "rgba(255,255,255,.6)" }}>SupraMeds price</div>
            <div className="flex items-baseline gap-1 mt-1.5">
              <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,.8)" }}>₹</span>
              <span className="text-[34px] italic" style={{ fontFamily: "var(--font-serif)", color: "var(--color-brand-teal-light)" }}>134</span>
            </div>
            <div className="text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,.6)" }}>Same salt &middot; Licensed generic</div>
          </div>

          {/* Floating chips */}
          <div className="absolute -top-2 -right-10 bg-white px-3 py-2 rounded-full text-[11px] font-bold shadow-md flex items-center gap-1.5" style={{ color: "var(--color-brand-navy)" }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            1000+ generics
          </div>
          <div className="absolute bottom-2 -right-6 bg-white px-3 py-2 rounded-full text-[11px] font-bold shadow-md flex items-center gap-1.5" style={{ color: "var(--color-brand-navy)" }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 13l3 3 7-7" /></svg>
            Same salt, same effect
          </div>
        </div>
      }
    />
  )
}

/* ── Slide 3: Trust ── */
function Slide3() {
  return (
    <SlideFrame
      heroBg="radial-gradient(circle at 50% 30%, rgba(14,124,134,.15), transparent 55%), linear-gradient(180deg, #E8F7FA 0%, #EEF2FF 100%)"
      title={<>Licensed, sealed &amp; <em className="italic" style={{ color: "var(--color-brand-teal)" }}>pharmacist-verified</em></>}
      desc="Every order is packed at our Hyderabad pharmacy and sealed with a tamper-proof strip before it leaves."
      heroContent={
        <>
          {/* Rotating ring */}
          <div
            className="w-[200px] h-[200px] rounded-full p-1 grid place-items-center"
            style={{
              background: `conic-gradient(from 180deg, var(--color-brand-teal), var(--color-brand-teal-light), var(--color-brand-teal-dark), var(--color-brand-teal), var(--color-brand-teal-light), var(--color-brand-teal))`,
              animation: "rotate 12s linear infinite",
            }}
          >
            <div
              className="w-full h-full rounded-full bg-white grid place-items-center"
              style={{ animation: "rotate 12s linear infinite reverse" }}
            >
              <div
                className="w-20 h-20 rounded-3xl grid place-items-center"
                style={{ background: "var(--color-brand-teal)", boxShadow: "0 20px 40px -10px rgba(14,124,134,.4)" }}
              >
                <ShieldCheckIcon size={36} />
              </div>
            </div>
          </div>

          {/* Trust chips */}
          {[
            { label: "Drug License", top: "18%", left: "6%", icon: "star" },
            { label: "Pharmacist verified", top: "60%", right: "4%", icon: "check" },
            { label: "Cold-chain safe", bottom: "16%", left: "12%", icon: "shield" },
          ].map((chip) => (
            <div
              key={chip.label}
              className="absolute bg-white py-2.5 px-3.5 pr-4 rounded-full text-[11px] font-bold flex items-center gap-2 shadow-md"
              style={{
                top: chip.top,
                left: chip.left,
                right: (chip as any).right,
                bottom: (chip as any).bottom,
                color: "var(--color-brand-navy)",
              }}
            >
              <div
                className="w-[22px] h-[22px] rounded-full grid place-items-center"
                style={{ background: "rgba(14,124,134,.1)", color: "var(--color-brand-teal)" }}
              >
                {chip.icon === "star" && (
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" /></svg>
                )}
                {chip.icon === "check" && (
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
                )}
                {chip.icon === "shield" && (
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" /></svg>
                )}
              </div>
              {chip.label}
            </div>
          ))}
        </>
      }
    />
  )
}
