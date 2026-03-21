import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useResetPassword } from "@/lib/hooks/use-customer"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { useLocation } from "@tanstack/react-router"

export const Route = createFileRoute("/$countryCode/account/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const location = useLocation()
  const { token } = Route.useSearch()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"
  const navigate = useNavigate()
  const resetPassword = useResetPassword()

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!token) {
      setError("Invalid or missing reset link. Please request a new one.")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    resetPassword.mutate(
      { token, password },
      {
        onSuccess: () => {
          setSuccess(true)
        },
        onError: () => {
          setError("Reset link may have expired. Please request a new one.")
        },
      }
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#FAFAF8" }}>
        <div className="w-full max-w-md">
          <div className="bg-white border rounded-xl p-8 shadow-sm" style={{ borderColor: "#EDE9E1" }}>
            <div className="mb-6 text-center">
              <div
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4"
                style={{ background: "#27AE60" }}
              >
                <CheckIcon />
              </div>
              <h1 className="text-xl font-serif font-semibold" style={{ color: "#0D1B2A" }}>
                Password updated
              </h1>
              <p className="text-sm mt-2" style={{ color: "#6B7280" }}>
                You can now sign in with your new password.
              </p>
            </div>
            <Link
              to="/$countryCode/account/login"
              params={{ countryCode }}
              search={{ redirectTo: undefined }}
              className="block w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-center text-white transition-all hover:opacity-90"
              style={{ background: "#0D1B2A" }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#FAFAF8" }}>
        <div className="w-full max-w-md">
          <div className="bg-white border rounded-xl p-8 shadow-sm" style={{ borderColor: "#EDE9E1" }}>
            <p className="text-sm text-center" style={{ color: "#6B7280" }}>
              This reset link is invalid or has expired.{" "}
              <Link to="/$countryCode/account/forgot-password" params={{ countryCode }} className="font-medium" style={{ color: "#27AE60" }}>
                Request a new one
              </Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#FAFAF8" }}>
      <div className="w-full max-w-md">
        <div className="bg-white border rounded-xl p-8 shadow-sm" style={{ borderColor: "#EDE9E1" }}>
          <div className="mb-8 text-center">
            <div
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4"
              style={{ background: "#0D1B2A" }}
            >
              <PillIcon />
            </div>
            <h1 className="text-2xl font-serif font-semibold" style={{ color: "#0D1B2A" }}>
              Set new password
            </h1>
            <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
              Enter your new password below.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "#374151" }}>
                New password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1"
                style={{
                  borderColor: "#D1D5DB",
                  color: "#111827",
                  "--tw-ring-color": "#27AE60",
                } as React.CSSProperties}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "#374151" }}>
                Confirm password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1"
                style={{
                  borderColor: "#D1D5DB",
                  color: "#111827",
                  "--tw-ring-color": "#27AE60",
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
              disabled={resetPassword.isPending}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed mt-1"
              style={{ background: "#0D1B2A" }}
            >
              {resetPassword.isPending ? "Updating..." : "Update password"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t text-center" style={{ borderColor: "#EDE9E1" }}>
            <Link
              to="/$countryCode/account/login"
              params={{ countryCode }}
              search={{ redirectTo: undefined }}
              className="text-sm font-medium hover:underline"
              style={{ color: "#27AE60" }}
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
