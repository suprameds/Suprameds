import { useState, useEffect } from "react"

const CONSENT_KEY = "suprameds_dpdp_consent"

interface StoredConsent {
  accepted: boolean
  timestamp: string
  version: string
}

const CURRENT_POLICY_VERSION = "1.0"

/**
 * DPDP Act 2023 consent banner.
 * Shown on first visit; dismissed on accept.
 * Consent is stored in localStorage with timestamp and policy version.
 */
export const ConsentBanner = () => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY)
      if (!stored) {
        setVisible(true)
        return
      }
      const parsed: StoredConsent = JSON.parse(stored)
      if (parsed.version !== CURRENT_POLICY_VERSION) {
        setVisible(true)
      }
    } catch {
      setVisible(true)
    }
  }, [])

  const handleAccept = () => {
    const consent: StoredConsent = {
      accepted: true,
      timestamp: new Date().toISOString(),
      version: CURRENT_POLICY_VERSION,
    }
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 inset-x-0 z-50 border-t shadow-lg"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border-primary)" }}
    >
      <div className="content-container flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Your privacy matters
          </p>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Suprameds uses essential cookies and collects minimal personal data to operate this pharmacy
            platform, as required under the{" "}
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>
              Digital Personal Data Protection (DPDP) Act, 2023
            </span>
            . By continuing, you consent to our{" "}
            <a href="/privacy" className="underline" style={{ color: "var(--brand-teal)" }}>
              Privacy Policy
            </a>{" "}
            and{" "}
            <a href="/terms" className="underline" style={{ color: "var(--brand-teal)" }}>
              Terms of Service
            </a>
            .
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <a
            href="/privacy"
            className="text-xs font-medium underline"
            style={{ color: "var(--brand-teal)" }}
          >
            Learn more
          </a>
          <button
            onClick={handleAccept}
            className="px-5 py-2 rounded text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--brand-teal)", color: "var(--text-inverse)" }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConsentBanner
