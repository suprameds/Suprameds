import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useRegister } from "@/lib/hooks/use-customer"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { useLocation } from "@tanstack/react-router"

export const Route = createFileRoute("/$countryCode/account/register")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirectTo: typeof search.redirectTo === "string" ? search.redirectTo : undefined,
  }),
  component: RegisterPage,
})

function RegisterPage() {
  const location = useLocation()
  const { redirectTo } = Route.useSearch()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"
  const navigate = useNavigate()
  const register = useRegister()

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
  })
  const [error, setError] = useState("")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!form.first_name || !form.last_name || !form.email || !form.password) {
      setError("Please fill in all required fields.")
      return
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.")
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
      },
      {
        onSuccess: () => {
          if (redirectTo && redirectTo.startsWith("/")) {
            navigate({ to: redirectTo as never })
          } else {
            navigate({ to: "/$countryCode/account/profile", params: { countryCode } })
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
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "#FAFAF8" }}>
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
              Create your account
            </h1>
            <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
              Join Suprameds for safe, licensed pharmacy delivery
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: "#374151" }}>
                  First name <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  name="first_name"
                  type="text"
                  autoComplete="given-name"
                  value={form.first_name}
                  onChange={handleChange}
                  placeholder="Aarav"
                  className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1"
                  style={{ borderColor: "#D1D5DB", color: "#111827" }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: "#374151" }}>
                  Last name <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  name="last_name"
                  type="text"
                  autoComplete="family-name"
                  value={form.last_name}
                  onChange={handleChange}
                  placeholder="Sharma"
                  className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1"
                  style={{ borderColor: "#D1D5DB", color: "#111827" }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "#374151" }}>
                Email address <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1"
                style={{ borderColor: "#D1D5DB", color: "#111827" }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "#374151" }}>
                Mobile number
              </label>
              <div className="relative flex">
                <span
                  className="flex items-center px-3 rounded-l-lg border border-r-0 text-sm"
                  style={{ borderColor: "#D1D5DB", color: "#6B7280", background: "#F9FAFB" }}
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
                  style={{ borderColor: "#D1D5DB", color: "#111827" }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "#374151" }}>
                Password <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                placeholder="Min. 8 characters"
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1"
                style={{ borderColor: "#D1D5DB", color: "#111827" }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "#374151" }}>
                Confirm password <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                value={form.confirm_password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1"
                style={{ borderColor: "#D1D5DB", color: "#111827" }}
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

            <p className="text-xs leading-relaxed" style={{ color: "#9CA3AF" }}>
              By creating an account, you agree to our{" "}
              <a href="/terms" className="underline hover:opacity-80" style={{ color: "#6B7280" }}>
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="underline hover:opacity-80" style={{ color: "#6B7280" }}>
                Privacy Policy
              </a>
              .
            </p>

            <button
              type="submit"
              disabled={register.isPending}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed mt-1"
              style={{ background: "#0D1B2A" }}
            >
              {register.isPending ? "Creating account..." : "Create account"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t text-center" style={{ borderColor: "#EDE9E1" }}>
            <p className="text-sm" style={{ color: "#6B7280" }}>
              Already have an account?{" "}
              <Link
                to="/$countryCode/account/login"
                params={{ countryCode }}
                className="font-medium hover:underline"
                style={{ color: "#27AE60" }}
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
