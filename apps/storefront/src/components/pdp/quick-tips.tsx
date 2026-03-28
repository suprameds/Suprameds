interface QuickTipsProps {
  tips?: string[] | null
}

export default function QuickTips({ tips }: QuickTipsProps) {
  if (!tips || tips.length === 0) return null

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid #BBF7D0" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18h6M10 22h4" />
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
        </svg>
        <h2 className="text-sm font-semibold" style={{ color: "#15803D", fontFamily: "Fraunces, Georgia, serif" }}>
          Quick Tips
        </h2>
      </div>
      <ul className="px-4 py-3 flex flex-col gap-2">
        {tips.map((tip, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: "#2C3E50" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="leading-relaxed">{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
