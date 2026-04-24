import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState, forwardRef } from "react"
import { useCustomer, useLogin, useOtpSend, useOtpVerify } from "@/lib/hooks/use-customer"
import { trackLogin, trackSignup } from "@/lib/utils/analytics"
import { DEFAULT_COUNTRY_CODE } from "@/lib/constants/site"
import { hapticNotification } from "@/lib/utils/haptics"

export const Route = createFileRoute("/account/login")({
  head: () => ({
    meta: [
      { title: "Sign In | Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    redirectTo: typeof search.redirectTo === "string" ? search.redirectTo : undefined,
  }),
  component: LoginPage,
})

type LoginMode = "email" | "phone-otp" | "email-otp"
type OtpStep = "input" | "verify"

function LoginPage() {
  const { redirectTo } = Route.useSearch()
  const navigate = useNavigate()
  const login = useLogin()
  const { data: customer, isLoading: customerLoading } = useCustomer()

  // Redirect already-logged-in users
  useEffect(() => {
    if (!customerLoading && customer) {
      if (redirectTo && redirectTo.startsWith("/")) {
        navigate({ to: redirectTo as never })
      } else {
        navigate({ to: "/" })
      }
    }
  }, [customerLoading, customer, navigate, redirectTo])

  const [mode, setMode] = useState<LoginMode>("email")

  // Email/password state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")

  // Phone OTP state
  const [phone, setPhone] = useState("")
  const [phoneOtp, setPhoneOtp] = useState("")
  const [phoneOtpStep, setPhoneOtpStep] = useState<OtpStep>("input")
  const [phoneOtpError, setPhoneOtpError] = useState("")
  const [phoneCountdown, setPhoneCountdown] = useState(0)
  const phoneOtpInputRef = useRef<HTMLInputElement>(null)

  // Email OTP state
  const [otpEmail, setOtpEmail] = useState("")
  const [emailOtp, setEmailOtp] = useState("")
  const [emailOtpStep, setEmailOtpStep] = useState<OtpStep>("input")
  const [emailOtpError, setEmailOtpError] = useState("")
  const [emailCountdown, setEmailCountdown] = useState(0)
  const emailOtpInputRef = useRef<HTMLInputElement>(null)

  const otpSend = useOtpSend()
  const otpVerify = useOtpVerify()

  const navigateAfterLogin = useCallback((isNewUser?: boolean) => {
    if (redirectTo && redirectTo.startsWith("/")) {
      navigate({ to: redirectTo as never })
    } else if (isNewUser) {
      // New OTP users → account page to complete profile (add name etc.)
      navigate({ to: "/account" })
    } else {
      navigate({ to: "/" })
    }
  }, [redirectTo, navigate])

  // ── Email/Password submit ────────────────────────────────────────
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email || !password) {
      setError("Please enter your email and password.")
      return
    }

    login.mutate(
      { email, password },
      {
        onSuccess: (customer) => {
          void trackLogin({
            method: "email",
            userId: customer?.id,
            userData: { email, country: DEFAULT_COUNTRY_CODE },
          })
          navigateAfterLogin(false)
        },
        onError: () => setError("Invalid email or password. Please try again."),
      }
    )
  }

  // ── Phone OTP: Send ──────────────────────────────────────────────
  const isValidPhone = /^[6-9]\d{9}$/.test(phone)

  const handleSendPhoneOtp = () => {
    setPhoneOtpError("")

    if (!isValidPhone) {
      setPhoneOtpError("Enter a valid 10-digit Indian mobile number (starts with 6-9).")
      return
    }

    otpSend.mutate(
      { phone, country_code: "91", channel: "sms" },
      {
        onSuccess: () => {
          setPhoneOtpStep("verify")
          setPhoneOtp("")
          setPhoneCountdown(60)
        },
        onError: (err: any) => {
          const data = err?.body || err
          if (data?.fallback_channel === "email") {
            setPhoneOtpError("SMS is currently unavailable. Please use Email OTP instead.")
            // Auto-switch to email OTP after a brief delay
            setTimeout(() => switchMode("email-otp"), 2000)
          } else {
            setPhoneOtpError(data?.message || "Failed to send OTP. Please try again.")
          }
        },
      }
    )
  }

  // ── Phone OTP: Verify ────────────────────────────────────────────
  const handleVerifyPhoneOtp = () => {
    setPhoneOtpError("")

    if (!/^\d{6}$/.test(phoneOtp)) {
      setPhoneOtpError("Please enter the 6-digit OTP.")
      return
    }

    otpVerify.mutate(
      { phone, otp: phoneOtp, country_code: "91", channel: "sms" },
      {
        onSuccess: (customer) => {
          void hapticNotification("success")
          const isNew = !customer?.first_name
          const userData = { phone, country: DEFAULT_COUNTRY_CODE }
          if (isNew) {
            void trackSignup({ method: "phone-otp", userId: customer?.id, userData })
          } else {
            void trackLogin({ method: "phone-otp", userId: customer?.id, userData })
          }
          navigateAfterLogin(isNew)
        },
        onError: (err: any) => {
          void hapticNotification("error")
          setPhoneOtpError(err?.body?.message || err?.message || "Invalid or expired OTP.")
        },
      }
    )
  }

  // ── Email OTP: Send ──────────────────────────────────────────────
  const isValidOtpEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(otpEmail)

  const handleSendEmailOtp = () => {
    setEmailOtpError("")

    if (!isValidOtpEmail) {
      setEmailOtpError("Enter a valid email address.")
      return
    }

    otpSend.mutate(
      { email: otpEmail, channel: "email" },
      {
        onSuccess: () => {
          setEmailOtpStep("verify")
          setEmailOtp("")
          setEmailCountdown(60)
        },
        onError: (err: any) => {
          const data = err?.body || err
          if (data?.fallback_channel === "sms") {
            setEmailOtpError("Email service unavailable. Switch to Phone OTP.")
          } else {
            setEmailOtpError(data?.message || "Failed to send OTP. Please try again.")
          }
        },
      }
    )
  }

  // ── Email OTP: Verify ────────────────────────────────────────────
  const handleVerifyEmailOtp = () => {
    setEmailOtpError("")

    if (!/^\d{6}$/.test(emailOtp)) {
      setEmailOtpError("Please enter the 6-digit OTP.")
      return
    }

    otpVerify.mutate(
      { email: otpEmail, otp: emailOtp, channel: "email" },
      {
        onSuccess: (customer) => {
          void hapticNotification("success")
          const isNew = !customer?.first_name
          const userData = { email: otpEmail, country: DEFAULT_COUNTRY_CODE }
          if (isNew) {
            void trackSignup({ method: "email-otp", userId: customer?.id, userData })
          } else {
            void trackLogin({ method: "email-otp", userId: customer?.id, userData })
          }
          navigateAfterLogin(isNew)
        },
        onError: (err: any) => {
          void hapticNotification("error")
          setEmailOtpError(err?.body?.message || err?.message || "Invalid or expired OTP.")
        },
      }
    )
  }

  // Auto-focus OTP inputs
  useEffect(() => {
    if (phoneOtpStep === "verify") setTimeout(() => phoneOtpInputRef.current?.focus(), 100)
  }, [phoneOtpStep])

  useEffect(() => {
    if (emailOtpStep === "verify") setTimeout(() => emailOtpInputRef.current?.focus(), 100)
  }, [emailOtpStep])

  // Countdown timers
  useEffect(() => {
    if (phoneCountdown <= 0) return
    const t = setInterval(() => setPhoneCountdown((c) => c - 1), 1000)
    return () => clearInterval(t)
  }, [phoneCountdown])

  useEffect(() => {
    if (emailCountdown <= 0) return
    const t = setInterval(() => setEmailCountdown((c) => c - 1), 1000)
    return () => clearInterval(t)
  }, [emailCountdown])

  // Reset state when switching modes
  const switchMode = (m: LoginMode) => {
    setMode(m)
    setError("")
    setPhoneOtpError("")
    setPhoneOtpStep("input")
    setPhoneOtp("")
    setEmailOtpError("")
    setEmailOtpStep("input")
    setEmailOtp("")
  }

  const TEAL = "var(--brand-teal)"
  const NAVY = "var(--text-primary)"

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-primary)" }}>
      {/* ── Left panel: brand visual (hidden on mobile) ── */}
      <div
        className="hidden lg:flex lg:w-[45%] xl:w-[50%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0A3D42, #0E7C86 40%, #134E5E)" }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full opacity-10" style={{ background: "white" }} />
        <div className="absolute bottom-10 -right-16 w-56 h-56 rounded-full opacity-[0.07]" style={{ background: "white" }} />
        <div className="absolute top-1/2 left-1/4 w-32 h-32 rounded-full opacity-[0.05]" style={{ background: "white" }} />

        <div>
          <Link to="/" className="inline-block mb-12">
            <img src="/images/suprameds-logo-full.png" alt="Suprameds" className="h-10 brightness-0 invert" style={{ objectFit: "contain" }} />
          </Link>

          <h2
            className="text-3xl xl:text-4xl font-semibold text-white leading-tight mb-4"
            style={{ fontFamily: "Fraunces, Georgia, serif" }}
          >
            Quality medicines,
            <br />
            affordable prices.
          </h2>
          <p className="text-sm leading-relaxed max-w-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            India's licensed online pharmacy. Same composition, 50-80% less than branded alternatives.
            Pharmacist-verified, delivered to your door.
          </p>
        </div>

        {/* Trust badges at bottom */}
        <div className="flex flex-wrap gap-6 mt-auto pt-8">
          {[
            { label: "Licensed Pharmacy", sub: "DL: TS/HYD/2021-82149" },
            { label: "Pharmacist Verified", sub: "Every order checked" },
            { label: "Pan-India Delivery", sub: "Speed Post" },
          ].map((badge) => (
            <div key={badge.label}>
              <p className="text-xs font-semibold text-white">{badge.label}</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>{badge.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel: login form ── */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 lg:px-12">
      <div className="w-full max-w-md">
        {/* Mobile logo (hidden on desktop) */}
        <div className="lg:hidden text-center mb-6">
          <Link to="/" className="inline-block">
            <img src="/images/suprameds-logo-full.png" alt="Suprameds" className="h-9" style={{ objectFit: "contain" }} />
          </Link>
        </div>

        <div className="bg-[var(--bg-secondary)] border rounded-xl p-8 shadow-sm" style={{ borderColor: "var(--border-primary)" }}>
          {/* Header */}
          <div className="mb-6">
            <h1
              className="text-2xl font-semibold"
              style={{ color: NAVY, fontFamily: "Fraunces, Georgia, serif" }}
            >
              Sign in
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Access your orders, prescriptions, and account
            </p>
          </div>

          {/* Mode toggle tabs (3-way) */}
          <div className="flex rounded-lg p-1 mb-6" style={{ background: "var(--bg-tertiary)" }}>
            {([
              { key: "email" as const, label: "Password" },
              { key: "phone-otp" as const, label: "Phone OTP" },
              { key: "email-otp" as const, label: "Email OTP" },
            ]).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => switchMode(tab.key)}
                className="flex-1 py-2 text-sm font-medium rounded-md transition-all"
                style={{
                  background: mode === tab.key ? "var(--bg-secondary)" : "transparent",
                  color: mode === tab.key ? NAVY : "var(--text-secondary)",
                  boxShadow: mode === tab.key ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Email / Password Form ───────────────────────────────── */}
          {mode === "email" && (
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Email address
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1"
                  style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)", "--tw-ring-color": TEAL } as React.CSSProperties}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Password</label>
                  <Link
                    to="/account/forgot-password"
                    className="text-xs hover:underline"
                    style={{ color: TEAL }}
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1"
                    style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)", "--tw-ring-color": TEAL } as React.CSSProperties}
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
              </div>

              {error && <ErrorBanner message={error} />}

              <button
                type="submit"
                disabled={login.isPending}
                className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed mt-1"
                style={{ background: TEAL }}
              >
                {login.isPending ? "Signing in..." : "Sign in"}
              </button>
            </form>
          )}

          {/* ── Phone OTP Form ──────────────────────────────────────── */}
          {mode === "phone-otp" && (
            <div className="flex flex-col gap-4">
              {phoneOtpStep === "input" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Mobile number</label>
                    <div className="flex">
                      <span
                        className="flex items-center px-3 rounded-l-lg border border-r-0 text-sm select-none"
                        style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)", background: "var(--bg-tertiary)" }}
                      >
                        +91
                      </span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        placeholder="98765 43210"
                        className="flex-1 px-3.5 py-2.5 rounded-r-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1"
                        style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)", "--tw-ring-color": TEAL } as React.CSSProperties}
                      />
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>We'll send a 6-digit OTP via SMS</p>
                  </div>

                  {phoneOtpError && <ErrorBanner message={phoneOtpError} />}

                  <button
                    type="button"
                    onClick={handleSendPhoneOtp}
                    disabled={otpSend.isPending || !isValidPhone}
                    className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed mt-1"
                    style={{ background: TEAL }}
                  >
                    {otpSend.isPending ? "Sending OTP..." : "Send OTP"}
                  </button>
                </>
              )}

              {phoneOtpStep === "verify" && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                      OTP sent to <span className="font-semibold">+91 {phone}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => { setPhoneOtpStep("input"); setPhoneOtpError(""); setPhoneOtp("") }}
                      className="text-xs font-medium hover:underline"
                      style={{ color: TEAL }}
                    >
                      Change
                    </button>
                  </div>

                  <OtpInput ref={phoneOtpInputRef} value={phoneOtp} onChange={setPhoneOtp} />

                  {phoneOtpError && <ErrorBanner message={phoneOtpError} />}

                  <button
                    type="button"
                    onClick={handleVerifyPhoneOtp}
                    disabled={otpVerify.isPending || phoneOtp.length !== 6}
                    className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: TEAL }}
                  >
                    {otpVerify.isPending ? "Verifying..." : "Verify & Sign in"}
                  </button>

                  <ResendTimer countdown={phoneCountdown} onResend={handleSendPhoneOtp} isPending={otpSend.isPending} />
                </>
              )}
            </div>
          )}

          {/* ── Email OTP Form ──────────────────────────────────────── */}
          {mode === "email-otp" && (
            <div className="flex flex-col gap-4">
              {emailOtpStep === "input" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Email address</label>
                    <input
                      type="email"
                      autoComplete="email"
                      value={otpEmail}
                      onChange={(e) => setOtpEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1"
                      style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)", "--tw-ring-color": TEAL } as React.CSSProperties}
                    />
                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                      We'll send a 6-digit OTP to your inbox — no password needed
                    </p>
                  </div>

                  {emailOtpError && <ErrorBanner message={emailOtpError} />}

                  <button
                    type="button"
                    onClick={handleSendEmailOtp}
                    disabled={otpSend.isPending || !isValidOtpEmail}
                    className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed mt-1"
                    style={{ background: TEAL }}
                  >
                    {otpSend.isPending ? "Sending OTP..." : "Send OTP to Email"}
                  </button>
                </>
              )}

              {emailOtpStep === "verify" && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                      OTP sent to <span className="font-semibold">{otpEmail}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => { setEmailOtpStep("input"); setEmailOtpError(""); setEmailOtp("") }}
                      className="text-xs font-medium hover:underline"
                      style={{ color: TEAL }}
                    >
                      Change
                    </button>
                  </div>

                  <OtpInput ref={emailOtpInputRef} value={emailOtp} onChange={setEmailOtp} />

                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    Check your inbox and spam folder for the OTP email from Suprameds
                  </p>

                  {emailOtpError && <ErrorBanner message={emailOtpError} />}

                  <button
                    type="button"
                    onClick={handleVerifyEmailOtp}
                    disabled={otpVerify.isPending || emailOtp.length !== 6}
                    className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: TEAL }}
                  >
                    {otpVerify.isPending ? "Verifying..." : "Verify & Sign in"}
                  </button>

                  <ResendTimer countdown={emailCountdown} onResend={handleSendEmailOtp} isPending={otpSend.isPending} />
                </>
              )}
            </div>
          )}

          {/* Register link — OTP modes double as signup, so adjust messaging */}
          <div className="mt-6 pt-6 border-t text-center" style={{ borderColor: "var(--border-primary)" }}>
            {mode === "email" ? (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                New to Suprameds?{" "}
                <Link
                  to="/account/register"
                  search={{ redirectTo, ref: undefined }}
                  className="font-medium hover:underline"
                  style={{ color: TEAL }}
                >
                  Create an account
                </Link>
                {" "}or use{" "}
                <button type="button" onClick={() => switchMode("email-otp")} className="font-medium hover:underline" style={{ color: TEAL }}>
                  Email OTP
                </button>
              </p>
            ) : (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                New user? OTP will create your account automatically.
                <br />
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  Already have a password?{" "}
                  <button type="button" onClick={() => switchMode("email")} className="font-medium hover:underline" style={{ color: TEAL }}>
                    Sign in with password
                  </button>
                </span>
              </p>
            )}
          </div>

          {/* Trust footer */}
          <div className="mt-6 p-3 rounded-lg text-center" style={{ background: "var(--bg-tertiary)" }}>
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              Protected by 256-bit encryption · Licensed pharmacy under CDSCO
            </p>
          </div>
        </div>

        {/* Mobile-only: "Please sign in to continue" banner */}
        <p className="lg:hidden text-center text-xs mt-4" style={{ color: "var(--text-tertiary)" }}>
          India's licensed online pharmacy · DL: TS/HYD/2021-82149
        </p>
      </div>
      </div>
    </div>
  )
}

// ── Shared sub-components ────────────────────────────────────────────

const OtpInput = forwardRef<HTMLInputElement, { value: string; onChange: (v: string) => void }>(
  ({ value, onChange }, ref) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Enter OTP</label>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="• • • • • •"
        className="w-full px-3.5 py-3 rounded-lg border text-center text-lg tracking-[0.4em] font-mono outline-none transition-all focus:ring-2 focus:ring-offset-1"
        style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)", "--tw-ring-color": "var(--brand-teal)" } as React.CSSProperties}
      />
    </div>
  )
)
OtpInput.displayName = "OtpInput"

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="text-sm px-3.5 py-2.5 rounded-lg border"
      style={{ color: "#B91C1C", background: "#FEF2F2", borderColor: "#FECACA" }}
    >
      {message}
    </div>
  )
}

function ResendTimer({ countdown, onResend, isPending }: { countdown: number; onResend: () => void; isPending: boolean }) {
  return (
    <div className="text-center">
      {countdown > 0 ? (
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          Resend OTP in <span className="font-medium" style={{ color: "var(--text-primary)" }}>{countdown}s</span>
        </p>
      ) : (
        <button
          type="button"
          onClick={onResend}
          disabled={isPending}
          className="text-xs font-medium hover:underline disabled:opacity-60"
          style={{ color: "var(--brand-teal)" }}
        >
          {isPending ? "Sending..." : "Resend OTP"}
        </button>
      )}
    </div>
  )
}

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>
  </svg>
)
