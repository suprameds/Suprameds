const CHECKS = [
  { label: "8+ characters", test: (pw: string) => pw.length >= 8 },
  { label: "Uppercase letter", test: (pw: string) => /[A-Z]/.test(pw) },
  { label: "Lowercase letter", test: (pw: string) => /[a-z]/.test(pw) },
  { label: "Number", test: (pw: string) => /\d/.test(pw) },
]

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null

  const results = CHECKS.map((c) => ({ ...c, met: c.test(password) }))
  const metCount = results.filter((r) => r.met).length
  const pct = (metCount / CHECKS.length) * 100
  const barColor =
    metCount <= 1
      ? "var(--color-brand-rx)"
      : metCount <= 2
        ? "var(--color-brand-warn)"
        : metCount <= 3
          ? "var(--color-brand-teal)"
          : "var(--color-brand-ok)"

  return (
    <div className="flex flex-col gap-2">
      {/* Progress bar */}
      <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--color-brand-cream-dark)" }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      {/* Checklist */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {results.map((c) => (
          <span
            key={c.label}
            className="text-xs flex items-center gap-1 transition-colors"
            style={{ color: c.met ? "var(--color-brand-ok)" : "var(--color-brand-cream-dark)" }}
          >
            {c.met ? "\u2713" : "\u2022"} {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

