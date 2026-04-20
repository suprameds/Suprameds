import { useEffect, useState } from "react"
import { BrandLogo } from "@/components/auth/brand-logo"

const BRAND_GRADIENT =
  "linear-gradient(135deg, #FFB020 0%, #FF7A3D 20%, #E6276D 45%, #C83AFF 65%, #6C4BFF 80%, #22C9E6 100%)"

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    // Min 1.5s display, max 2s — then fade out and complete
    const timer = setTimeout(() => setFading(true), 1500)
    const maxTimer = setTimeout(() => onComplete(), 2000)
    return () => {
      clearTimeout(timer)
      clearTimeout(maxTimer)
    }
  }, [onComplete])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-400"
      style={{
        background: "var(--color-brand-navy)",
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      {/* Breathing gradient glow */}
      <div
        className="absolute inset-[-20%]"
        style={{
          background: [
            "radial-gradient(400px 400px at 30% 40%, rgba(14,124,134,.35), transparent 60%)",
            "radial-gradient(500px 500px at 70% 60%, rgba(14,124,134,.2), transparent 60%)",
            "radial-gradient(400px 400px at 50% 90%, rgba(14,124,134,.25), transparent 60%)",
          ].join(", "),
          filter: "blur(40px)",
          animation: "breathe 6s ease-in-out infinite",
        }}
      />

      {/* Center stage */}
      <div className="relative z-10 flex flex-col items-center gap-5">
        <BrandLogo
          size={96}
          id="splash"
          className="drop-shadow-[0_12px_40px_rgba(14,124,134,.5)]"
        />
        <div
          className="text-[34px] text-white tracking-[-0.01em]"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          SUPRA<span className="italic" style={{ background: BRAND_GRADIENT, WebkitBackgroundClip: "text", color: "transparent" }}>MEDS</span>
        </div>
        <div
          className="text-[11px] font-semibold tracking-[0.3em] uppercase mt-1.5"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          Licensed &middot; Generic &middot; Affordable
        </div>
      </div>

      {/* Animated loader bar */}
      <div
        className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[60px] h-[2px] rounded-full overflow-hidden z-10"
        style={{ background: "rgba(255,255,255,0.12)" }}
      >
        <div
          className="absolute top-0 h-full w-[40%] rounded-full"
          style={{
            background: BRAND_GRADIENT,
            animation: "slide 1.8s ease-in-out infinite",
          }}
        />
      </div>

      {/* Footer */}
      <div
        className="absolute bottom-10 left-0 right-0 text-center z-10 text-[10px] font-semibold tracking-[0.2em] uppercase"
        style={{ color: "rgba(255,255,255,0.35)" }}
      >
        A Supracyn Pharma initiative
      </div>
    </div>
  )
}
