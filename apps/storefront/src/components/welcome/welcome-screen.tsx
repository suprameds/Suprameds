import { Link } from "@tanstack/react-router"

/**
 * Welcome screen shown ONCE immediately after a successful signup
 * (`is_new === true` from the OTP verify response or a future register flow).
 *
 * Pharma-safe copy: no medical claims, no promotional language toward Rx
 * drugs (Drugs & Magic Remedies Act 1954), no model imagery. Factual feature
 * pills + soft CTAs only.
 *
 * Visual style chosen by Daisy: subtle. Brand navy/teal palette, gentle
 * fade-and-rise animation on mount via inline keyframes, no confetti or
 * illustration. Reads "professional pharmacy", not "consumer app celebration".
 *
 * Chrome (navbar, footer, bottom tab bar, consent banner) is suppressed by
 * `isChromeSuppressed` in layout.tsx so this is the only thing on screen
 * during the first-impression moment.
 *
 * No analytics: this screen is decoration around the existing trackSignup()
 * event that already fires at the source of truth (OTP verify success). A
 * separate welcome_viewed event would be redundant and noisy in GA4.
 */
export function WelcomeScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-5 py-10"
      style={{ background: "var(--bg-primary)" }}
    >
      <div
        className="w-full max-w-md flex flex-col items-center text-center"
        // The opacity-0 + animate-fadeInRise class is defined inline via the
        // <style> below — avoids touching the global Tailwind config or adding
        // a one-shot keyframe to theme.css that nothing else will reuse.
        style={{ animation: "welcomeFadeInRise 480ms ease-out both" }}
      >
        {/* Success check — inline SVG, no icon library dep. Sized to read as
            "your account is ready" without competing with the heading. */}
        <div
          className="flex items-center justify-center w-20 h-20 rounded-full mb-7"
          style={{
            background: "var(--color-brand-ok-light, #d5f0e2)",
            color: "var(--color-brand-ok, #1A7A4A)",
          }}
          aria-hidden="true"
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1
          className="text-3xl font-semibold mb-2"
          style={{
            fontFamily: "Fraunces, Georgia, serif",
            color: "var(--text-primary)",
          }}
        >
          Welcome to Suprameds
        </h1>
        <p
          className="text-base leading-relaxed max-w-sm mb-8"
          style={{ color: "var(--text-secondary)" }}
        >
          Your account is ready. Let&apos;s get you set up.
        </p>

        {/* Trust pills — factual, not promotional. Three is the sweet spot
            for a single mobile viewport without scrolling. */}
        <ul
          className="grid grid-cols-3 gap-2 w-full mb-8"
          aria-label="Why Suprameds"
        >
          <TrustPill icon={<HospitalIcon />} label="Licensed pharmacy" />
          <TrustPill icon={<StethoscopeIcon />} label="Pharmacist-checked" />
          <TrustPill icon={<TruckIcon />} label="COD across India" />
        </ul>

        {/* Feature cards — what to do next, not what the user gets "for free".
            Two cards keep this above the fold on a 360px viewport. */}
        <div className="w-full flex flex-col gap-3 mb-8">
          <FeatureCard
            title="Search by brand or composition"
            description="Find the same molecule under any brand name — including generics at a fraction of MRP."
          />
          <FeatureCard
            title="Upload your prescription once"
            description="Reorder Rx medicines anytime without re-uploading. Our pharmacists review every Rx order before dispatch."
          />
        </div>

        {/* CTAs. Both routed via Link so the TanStack router preloads and the
            navigation is single-tap with no JS round-trip. */}
        <div className="w-full flex flex-col gap-2.5">
          <Link
            to="/"
            className="w-full py-3 px-4 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:opacity-80"
            style={{ background: "var(--color-brand-teal)" }}
          >
            Browse medicines
          </Link>
          <Link
            to="/account"
            className="w-full py-3 px-4 rounded-lg text-sm font-medium border transition-all hover:bg-[var(--color-brand-cream)]"
            style={{
              borderColor: "var(--border-primary)",
              color: "var(--text-primary)",
              background: "transparent",
            }}
          >
            Complete your profile
          </Link>
        </div>
      </div>

      {/* Scoped keyframe — kept inline so this screen is fully self-contained
          and nothing else in the app accidentally depends on it. */}
      <style>{`
        @keyframes welcomeFadeInRise {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────

function TrustPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li
      className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border"
      style={{
        borderColor: "var(--border-primary)",
        background: "var(--bg-secondary, white)",
        color: "var(--text-primary)",
      }}
    >
      <span
        className="flex items-center justify-center w-6 h-6"
        style={{ color: "var(--color-brand-teal)" }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="text-[11px] leading-tight font-medium">{label}</span>
    </li>
  )
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div
      className="w-full text-left p-4 rounded-xl border"
      style={{
        borderColor: "var(--border-primary)",
        background: "var(--bg-secondary, white)",
      }}
    >
      <h3
        className="text-sm font-semibold mb-1"
        style={{
          fontFamily: "Fraunces, Georgia, serif",
          color: "var(--text-primary)",
        }}
      >
        {title}
      </h3>
      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {description}
      </p>
    </div>
  )
}

// Inline SVG icons — no library. Sized to fit the 24x24 pill viewport.

function HospitalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6v4" />
      <path d="M10 8h4" />
      <rect x="4" y="10" width="16" height="11" rx="1" />
      <path d="M9 21v-4h6v4" />
    </svg>
  )
}

function StethoscopeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3v6a4 4 0 0 0 8 0V3" />
      <path d="M5 3h2" />
      <path d="M13 3h2" />
      <path d="M10 13v3a5 5 0 0 0 10 0v-2" />
      <circle cx="20" cy="14" r="2" />
    </svg>
  )
}

function TruckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 7h13v10H1z" />
      <path d="M14 10h4l3 3v4h-7" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="17" cy="19" r="2" />
    </svg>
  )
}
