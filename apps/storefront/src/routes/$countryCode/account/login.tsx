import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useLogin } from "@/lib/hooks/use-customer"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { useLocation } from "@tanstack/react-router"

export const Route = createFileRoute("/$countryCode/account/login")({
  component: LoginPage,
})

function LoginPage() {
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"
  const navigate = useNavigate()
  const login = useLogin()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email || !password) {
      setError("Please enter your email and password.")
      return
    }

    login.mutate(
      { email, password },
      {
        onSuccess: () => {
          navigate({
            to: "/$countryCode/account/profile",
            params: { countryCode },
          })
        },
        onError: () => {
          setError("Invalid email or password. Please try again.")
        },
      }
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#FAFAF8" }}>
      <div className="w-full max-w-md">
        <div className="bg-white border rounded-xl p-8 shadow-sm" style={{ borderColor: "#EDE9E1" }}>
          {/* Header */}
          <div className="mb-8 text-center">
            <div
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4"
              style={{ background: "#0D1B2A" }}
            >
              <PillIcon />
            </div>
            <h1 className="text-2xl font-serif font-semibold" style={{ color: "#0D1B2A" }}>
              Sign in to Suprameds
            </h1>
            <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
              Access your orders, prescriptions, and account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "#374151" }}>
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
                  borderColor: "#D1D5DB",
                  color: "#111827",
                  "--tw-ring-color": "#27AE60",
                } as React.CSSProperties}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" style={{ color: "#374151" }}>
                  Password
                </label>
                <a
                  href="/grievance"
                  className="text-xs hover:underline"
                  style={{ color: "#27AE60" }}
                >
                  Forgot password?
                </a>
              </div>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              disabled={login.isPending}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed mt-1"
              style={{ background: "#0D1B2A" }}
            >
              {login.isPending ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t text-center" style={{ borderColor: "#EDE9E1" }}>
            <p className="text-sm" style={{ color: "#6B7280" }}>
              New to Suprameds?{" "}
              <Link
                to="/$countryCode/account/register"
                params={{ countryCode }}
                className="font-medium hover:underline"
                style={{ color: "#27AE60" }}
              >
                Create an account
              </Link>
            </p>
          </div>

          {/* Trust footer */}
          <div
            className="mt-6 p-3 rounded-lg text-center"
            style={{ background: "#F8F9FA" }}
          >
            <p className="text-xs" style={{ color: "#9CA3AF" }}>
              Protected by 256-bit encryption · Licensed pharmacy under CDSCO
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
