import { type ReactNode } from "react"

type SafetyEntry = { rating: string; note: string }

interface SafetyAdviceProps {
  safetyAdvice?: Record<string, SafetyEntry> | null
}

const PANELS: { key: string; label: string; icon: ReactNode }[] = [
  {
    key: "pregnancy",
    label: "Pregnancy",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" />
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
  },
  {
    key: "breastfeeding",
    label: "Breastfeeding",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2v6a6 6 0 0 0 12 0V2" /><path d="M12 8v8" /><path d="M8 20h8" />
      </svg>
    ),
  },
  {
    key: "alcohol",
    label: "Alcohol",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 22h8M12 12v10M5 2l3 10h8l3-10" />
      </svg>
    ),
  },
  {
    key: "driving",
    label: "Driving",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="6" width="22" height="12" rx="2" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /><path d="M5 10h14" />
      </svg>
    ),
  },
  {
    key: "kidney",
    label: "Kidney",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22c-4-2-8-6-8-12 0-3 2-6 5-6 1.5 0 2.5.5 3 1.5C12.5 4.5 13.5 4 15 4c3 0 5 3 5 6 0 6-4 10-8 12z" />
      </svg>
    ),
  },
  {
    key: "liver",
    label: "Liver",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12c0-5 3-9 7-9s7 4 7 9-3 9-7 9-7-4-7-9z" /><path d="M12 3v18" />
      </svg>
    ),
  },
]

const ratingStyles: Record<string, { bg: string; color: string; label: string }> = {
  safe: { bg: "#DCFCE7", color: "#16A34A", label: "Safe" },
  caution: { bg: "#FEF3C7", color: "#D97706", label: "Caution" },
  unsafe: { bg: "#FEE2E2", color: "#DC2626", label: "Unsafe" },
}

export default function SafetyAdvice({ safetyAdvice }: SafetyAdviceProps) {
  if (!safetyAdvice || Object.keys(safetyAdvice).length === 0) return null

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #EDE9E1" }}>
      <div className="px-4 py-3" style={{ background: "#F8F6F2", borderBottom: "1px solid #EDE9E1" }}>
        <h2 className="text-sm font-semibold" style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}>
          Safety Advice
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0" style={{ background: "#fff" }}>
        {PANELS.map((panel) => {
          const entry = safetyAdvice[panel.key]
          if (!entry) return null
          const style = ratingStyles[entry.rating] || ratingStyles.caution

          return (
            <div
              key={panel.key}
              className="px-4 py-3.5 flex gap-3"
              style={{ borderBottom: "1px solid #F3F0EB" }}
            >
              <div className="flex-shrink-0 mt-0.5" style={{ color: style.color }}>
                {panel.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold" style={{ color: "#0D1B2A" }}>
                    {panel.label}
                  </span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: style.bg, color: style.color }}
                  >
                    {style.label}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: "#6B7280" }}>
                  {entry.note}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
