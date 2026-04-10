import { createFileRoute, Link, useNavigate, useLocation } from "@tanstack/react-router"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRegister } from "@/lib/hooks/use-customer"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { sdk } from "@/lib/utils/sdk"

export const Route = createFileRoute("/$countryCode/account/register")({
  head: () => ({
    meta: [
      { title: "Create Account | Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    redirectTo: typeof search.redirectTo === "string" ? search.redirectTo : undefined,
    ref: typeof search.ref === "string" ? search.ref : undefined,
  }),
  component: RegisterPage,
})

function RegisterPage() {
  const location = useLocation()
  const { redirectTo, ref: refCode } = Route.useSearch()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"
  const navigate = useNavigate()
  const register = useRegister()

  // Referral code: from URL param or manual input
  const [manualRefCode, setManualRefCode] = useState("")
  const [showRefInput, setShowRefInput] = useState(!refCode) // show input if no URL param
  const activeRefCode = refCode || manualRefCode.trim().toUpperCase() || ""

  // Validate referral code (from URL or manual input)
  const { data: referralData, isFetching: validatingRef } = useQuery({
    queryKey: ["referral-validate", activeRefCode],
    queryFn: async () => {
      if (!activeRefCode) return null
      return await sdk.client.fetch<{ valid: boolean; referrer_name?: string }>(
        `/store/loyalty/validate-referral?code=${encodeURIComponent(activeRefCode)}`
      )
    },
    enabled: activeRefCode.length >= 4,
    retry: false,
  })

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
  })
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  /** Password strength checks — must match backend middleware */
  const passwordChecks = [
    { label: "8+ characters", met: form.password.length >= 8 },
    { label: "Uppercase letter", met: /[A-Z]/.test(form.password) },
    { label: "Lowercase letter", met: /[a-z]/.test(form.password) },
    { label: "Number", met: /\d/.test(form.password) },
  ]
  const allChecksMet = passwordChecks.every((c) => c.met)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!form.first_name || !form.last_name || !form.email || !form.password) {
      setError("Please fill in all required fields.")
      return
    }
    if (!allChecksMet) {
      setError("Password does not meet strength requirements.")
      return
    }
    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.")
      return
    }

    register.mutate(
      {
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || undefined,
        metadata: activeRefCode && referralData?.valid ? { referred_by: activeRefCode } : undefined,
      },
      {
        onSuccess: () => {
          if (redirectTo && redirectTo.startsWith("/")) {
            navigate({ to: redirectTo as never })
          } else {
            navigate({ to: "/$countryCode", params: { countryCode } })
          }
        },
        onError: (err: unknown) => {
          const msg =
            err instanceof Error ? err.message : "Registration failed."
          if (msg.toLowerCase().includes("exists") || msg.toLowerCase().includes("duplicate")) {
            setError("An account with this email already exists.")
          } else {
            setError(msg || "Registration failed. Please try again.")
          }
        },
      }
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--bg-primary)" }}>
      <div className="w-full max-w-md">
        <div className="bg-[var(--bg-secondary)] border rounded-xl p-8 shadow-sm" style={{ borderColor: "var(--border-primary)" }}>
          <div className="mb-8 text-center">
            <div
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4"
              style={{ background: "var(--bg-inverse)" }}
            >
              <PillIcon />
            </div>
            <h1 className="text-2xl font-serif font-semibold" style={{ color: "var(--text-primary)" }}>
              Create your account
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Join Suprameds for safe, licensed pharmacy delivery
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  First name <span style={{ color: "var(--brand-red)" }}>*</span>
                </label>
                <input
                  name="first_name"
                  type="text"
                  autoComplete="given-name"
                  value={form.first_name}
                  onChange={handleChange}
                  placeholder="Aarav"
                  className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1"
                  style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Last name <span style={{ color: "var(--brand-red)" }}>*</span>
                </label>
                <input
                  name="last_name"
                  type="text"
                  autoComplete="family-name"
                  value={form.last_name}
                  onChange={handleChange}
                  placeholder="Sharma"
                  className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1"
                  style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Email address <span style={{ color: "var(--brand-red)" }}>*</span>
              </label>
              <input
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1"
                style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Mobile number
              </label>
              <div className="relative flex">
                <span
                  className="flex items-center px-3 rounded-l-lg border border-r-0 text-sm"
                  style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)", background: "var(--bg-tertiary)" }}
                >
                  +91
                </span>
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="98765 43210"
                  className="flex-1 px-3.5 py-2.5 rounded-r-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1"
                  style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Password <span style={{ color: "var(--brand-red)" }}>*</span>
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min. 8 characters"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1"
                  style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {form.password.length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                  {passwordChecks.map((c) => (
                    <span key={c.label} className="text-xs flex items-center gap-1" style={{ color: c.met ? "var(--brand-green)" : "var(--text-tertiary)" }}>
                      {c.met ? "\u2713" : "\u2022"} {c.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Confirm password <span style={{ color: "var(--brand-red)" }}>*</span>
              </label>
              <div className="relative">
                <input
                  name="confirm_password"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.confirm_password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1"
                  style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="text-sm px-3.5 py-2.5 rounded-lg border"
                style={{ color: "#B91C1C", background: "#FEF2F2", borderColor: "#FECACA" }}
              >
                {error}
              </div>
            )}

            {/* Referral: validated banner OR manual input */}
            {activeRefCode && referralData?.valid ? (
              <div
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border"
                style={{ background: "#ECFDF5", borderColor: "#A7F3D0", color: "#065F46" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                <span className="text-sm">
                  Referred by <strong>{referralData.referrer_name}</strong> — you'll get <strong>50 bonus points</strong>!
                </span>
                {!refCode && (
                  <button
                    type="button"
                    onClick={() => { setManualRefCode(""); setShowRefInput(true) }}
                    className="ml-auto text-xs underline cursor-pointer"
                    style={{ color: "#065F46" }}
                  >
                    Change
                  </button>
                )}
              </div>
            ) : showRefInput ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Referral code <span className="text-xs font-normal" style={{ color: "var(--text-tertiary)" }}>(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualRefCode}
                    onChange={(e) => setManualRefCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SM-XXXXXX"
                    maxLength={9}
                    className="flex-1 px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1 font-mono tracking-wider"
                    style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
                  />
                  {validatingRef && (
                    <span className="flex items-center text-xs" style={{ color: "var(--text-tertiary)" }}>Checking...</span>
                  )}
                </div>
                {manualRefCode.length >= 4 && referralData && !referralData.valid && !validatingRef && (
                  <p className="text-xs" style={{ color: "var(--brand-red)" }}>Invalid referral code</p>
                )}
              </div>
            ) : null}

            <p className="text-xs leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
              By creating an account, you agree to our{" "}
              <a href="/terms" className="underline hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="underline hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
                Privacy Policy
              </a>
              .
            </p>

            <button
              type="submit"
              disabled={register.isPending}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed mt-1"
              style={{ background: "var(--bg-inverse)" }}
            >
              {register.isPending ? "Creating account..." : "Create account"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t text-center" style={{ borderColor: "var(--border-primary)" }}>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Already have an account?{" "}
              <Link
                to="/$countryCode/account/login"
                params={{ countryCode }}
                search={{ redirectTo }}
                className="font-medium hover:underline"
                style={{ color: "var(--brand-green)" }}
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

const PillIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
    <line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>
  </svg>
)

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
    <line x1="2" y1="2" x2="22" y2="22"/>
  </svg>
)
