import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { sdk } from "@/lib/utils/sdk"

export const Route = createFileRoute("/account/_layout/change-password")({
  head: () => ({
    meta: [
      { title: "Change Password | Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ChangePasswordPage,
})

function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const passwordChecks = [
    { label: "8+ characters", met: newPassword.length >= 8 },
    { label: "Uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "Lowercase letter", met: /[a-z]/.test(newPassword) },
    { label: "Number", met: /\d/.test(newPassword) },
  ]
  const allChecksMet = passwordChecks.every((c) => c.met)

  const changePassword = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      // Step 1: Verify current password by attempting login
      try {
        await sdk.auth.login("customer", "emailpass", {
          email: "", // Will be filled by session
          password: currentPassword,
        })
      } catch {
        throw new Error("Current password is incorrect")
      }

      // Step 2: Update to new password
      // Medusa v2: use the auth session to update the provider
      await sdk.client.fetch("/auth/customer/emailpass/update", {
        method: "POST",
        body: { password: newPassword },
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess(false)

    if (!currentPassword) {
      setError("Please enter your current password.")
      return
    }
    if (!allChecksMet) {
      setError("New password does not meet strength requirements.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.")
      return
    }
    if (currentPassword === newPassword) {
      setError("New password must be different from current password.")
      return
    }

    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setSuccess(true)
          setCurrentPassword("")
          setNewPassword("")
          setConfirmPassword("")
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Failed to change password. Please try again.")
        },
      }
    )
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)", fontFamily: "Fraunces, Georgia, serif" }}>
        Change Password
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        Update your account password
      </p>

      <div
        className="bg-[var(--bg-secondary)] border rounded-xl p-6 max-w-lg"
        style={{ borderColor: "var(--border-primary)" }}
      >
        {success && (
          <div
            className="mb-6 px-4 py-3 rounded-lg border text-sm"
            style={{ color: "#166534", background: "#F0FDF4", borderColor: "#BBF7D0" }}
          >
            ✓ Password changed successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Current password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Current password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter current password"
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1"
                style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)", "--tw-ring-color": "var(--brand-teal)" } as React.CSSProperties}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((p) => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--bg-tertiary)]"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              New password
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1"
                style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)", "--tw-ring-color": "var(--brand-teal)" } as React.CSSProperties}
              />
              <button
                type="button"
                onClick={() => setShowNew((p) => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--bg-tertiary)]"
                tabIndex={-1}
              >
                {showNew ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {newPassword.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                {passwordChecks.map((c) => (
                  <span
                    key={c.label}
                    className="text-xs flex items-center gap-1"
                    style={{ color: c.met ? "var(--brand-green)" : "var(--text-tertiary)" }}
                  >
                    {c.met ? "✓" : "•"} {c.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Confirm new password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Confirm new password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Re-enter new password"
              className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1"
              style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)", "--tw-ring-color": "var(--brand-teal)" } as React.CSSProperties}
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs" style={{ color: "#B91C1C" }}>Passwords do not match</p>
            )}
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
            disabled={changePassword.isPending || !allChecksMet || newPassword !== confirmPassword}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "var(--brand-teal)" }}
          >
            {changePassword.isPending ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
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
