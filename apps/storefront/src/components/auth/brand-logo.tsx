/**
 * Suprameds S logo mark — recreated as inline SVG from the brand logo.
 * 6-stop gradient (gold → orange → magenta → pink → violet → cyan)
 * with a white highlight overlay for depth.
 */
export function BrandLogo({
  size = 56,
  className = "",
  id = "brand",
}: {
  size?: number
  className?: string
  id?: string
}) {
  const gradId = `sg-${id}`
  const hiId = `sg-hi-${id}`

  return (
    <div className={className} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", display: "block" }}>
        <defs>
          <linearGradient id={gradId} x1="70%" y1="0%" x2="30%" y2="100%">
            <stop offset="0%" stopColor="#FFD54A" />
            <stop offset="18%" stopColor="#FF9A3C" />
            <stop offset="42%" stopColor="#E6276D" />
            <stop offset="62%" stopColor="#C83AFF" />
            <stop offset="82%" stopColor="#5B4BFF" />
            <stop offset="100%" stopColor="#22C9E6" />
          </linearGradient>
          <linearGradient id={hiId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff" stopOpacity=".6" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M 62 12 Q 84 12, 84 32 Q 84 46, 64 50 L 36 50 Q 16 50, 16 68 Q 16 88, 38 88 L 58 88"
          stroke={`url(#${gradId})`}
          strokeWidth="22"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 62 12 Q 84 12, 84 32 Q 84 46, 64 50 L 36 50 Q 16 50, 16 68 Q 16 88, 38 88 L 58 88"
          stroke={`url(#${hiId})`}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          opacity=".6"
        />
      </svg>
    </div>
  )
}
