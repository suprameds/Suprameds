import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useForgotPassword } from "@/lib/hooks/use-customer"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { useLocation } from "@tanstack/react-router"

export const Route = createFileRoute("/$countryCode/account/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot Password | Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"
  const navigate = useNavigate()
  const forgotPassword = useForgotPassword()

  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email.trim()) {
      setError("Please enter your email address.")
      return
    }

    forgotPassword.mutate(email, {
      onSuccess: () => {
        setSent(true)
      },
      onError: () => {
        setError("Something went wrong. Please try again or contact support.")
      },
    })
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-primary)" }}>
        <div className="w-full max-w-md">
          <div className="bg-[var(--bg-secondary)] border rounded-xl p-8 shadow-sm" style={{ borderColor: "var(--border-primary)" }}>
            <div className="mb-6 text-center">
              <div
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4"
                style={{ background: "var(--brand-green)" }}
              >
                <CheckIcon />
              </div>
              <h1 className="text-xl font-serif font-semibold" style={{ color: "var(--text-primary)" }}>
                Check your email
              </h1>
              <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
                If an account exists for <strong>{email}</strong>, we’ve sent instructions to reset your password.
              </p>
            </div>
            <Link
              to="/$countryCode/account/login"
              params={{ countryCode }}
              search={{ redirectTo: undefined }}
              className="block w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-center text-white transition-all hover:opacity-90"
              style={{ background: "var(--bg-inverse)" }}
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-primary)" }}>
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
              Forgot password?
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Enter your email and we’ll send you a link to reset your password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                style={{
                  borderColor: "var(--border-primary)",
                  color: "var(--text-primary)",
                  "--tw-ring-color": "var(--brand-green)",
                } as React.CSSProperties}
              />
            </div>

            {error && (
              <div
                className="text-sm px-3.5 py-2.5 rounded-lg border"
                style={{ color: "#B91C1C", background: "#FEF2F2", borderColor: "#FECACA" }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={forgotPassword.isPending}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed mt-1"
              style={{ background: "var(--bg-inverse)" }}
            >
              {forgotPassword.isPending ? "Sending..." : "Send reset link"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t text-center" style={{ borderColor: "var(--border-primary)" }}>
            <Link
              to="/$countryCode/account/login"
              params={{ countryCode }}
              search={{ redirectTo: undefined }}
              className="text-sm font-medium hover:underline"
              style={{ color: "var(--brand-green)" }}
            >
              Back to sign in
            </Link>
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

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
