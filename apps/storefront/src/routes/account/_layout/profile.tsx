import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useCustomer, useUpdateCustomer } from "@/lib/hooks/use-customer"
import { isNativeApp } from "@/lib/utils/capacitor"
import {
  authenticateBiometric,
  isBiometricAvailable,
  isBiometricEnabled,
  setBiometricEnabled,
} from "@/lib/utils/biometric"

export const Route = createFileRoute("/account/_layout/profile")({
  head: () => ({
    meta: [
      { title: "Profile | Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ProfilePage,
})

function ProfilePage() {
  const { data: customer } = useCustomer()
  const updateCustomer = useUpdateCustomer()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    first_name: customer?.first_name ?? "",
    last_name: customer?.last_name ?? "",
    phone: customer?.phone ?? "",
  })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const handleEdit = () => {
    setForm({
      first_name: customer?.first_name ?? "",
      last_name: customer?.last_name ?? "",
      phone: customer?.phone ?? "",
    })
    setEditing(true)
    setSaved(false)
    setError("")
  }

  const handleSave = () => {
    setError("")
    updateCustomer.mutate(form, {
      onSuccess: () => {
        setEditing(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      },
      onError: () => {
        setError("Failed to save changes. Please try again.")
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-serif font-semibold" style={{ color: "var(--text-primary)" }}>
          Profile
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
          Manage your personal information
        </p>
      </div>

      {/* Personal info card */}
      <div className="bg-[var(--bg-secondary)] border rounded-xl p-6" style={{ borderColor: "var(--border-primary)" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Personal information
          </h2>
          {!editing && (
            <button
              onClick={handleEdit}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-all hover:bg-gray-50"
              style={{ color: "var(--text-primary)", borderColor: "var(--border-primary)" }}
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  First name
                </label>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                  className="px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-offset-1"
                  style={{ borderColor: "var(--border-primary)" }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Last name
                </label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                  className="px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-offset-1"
                  style={{ borderColor: "var(--border-primary)" }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
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
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="flex-1 px-3 py-2 rounded-r-lg border text-sm outline-none focus:ring-2 focus:ring-offset-1"
                  style={{ borderColor: "var(--border-primary)" }}
                />
              </div>
            </div>
            {error && (
              <p className="text-sm" style={{ color: "#B91C1C" }}>{error}</p>
            )}
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleSave}
                disabled={updateCustomer.isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: "var(--bg-inverse)" }}
              >
                {updateCustomer.isPending ? "Saving..." : "Save changes"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-gray-50"
                style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow label="First name" value={customer?.first_name ?? "—"} />
            <InfoRow label="Last name" value={customer?.last_name ?? "—"} />
            <InfoRow label="Email address" value={customer?.email ?? "—"} />
            <InfoRow label="Mobile" value={customer?.phone ? `+91 ${customer.phone}` : "—"} />
          </div>
        )}

        {saved && (
          <div
            className="mt-4 text-sm px-3.5 py-2.5 rounded-lg border"
            style={{ color: "#065F46", background: "#ECFDF5", borderColor: "#A7F3D0" }}
          >
            Profile updated successfully.
          </div>
        )}
      </div>

      {/* Email notice */}
      <div className="bg-[var(--bg-secondary)] border rounded-xl p-6" style={{ borderColor: "var(--border-primary)" }}>
        <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Email address
        </h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {customer?.email}
        </p>
        <p className="text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>
          Email cannot be changed. Contact{" "}
          <a href="/grievance" className="underline" style={{ color: "var(--text-secondary)" }}>
            support
          </a>{" "}
          if you need to update your email.
        </p>
      </div>

      {/* Loyalty Points section — Coming Soon */}
      <div>
        <h2
          className="text-lg font-semibold mb-3"
          style={{ color: "var(--text-primary)", fontFamily: "Fraunces, Georgia, serif" }}
        >
          Loyalty Rewards
        </h2>
        <div
          className="bg-[var(--bg-secondary)] border rounded-xl p-6 text-center"
          style={{ borderColor: "var(--border-primary)" }}
        >
          <div className="text-2xl mb-2">🎁</div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Coming Soon</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            Earn points on every order and redeem for discounts. Stay tuned!
          </p>
        </div>
      </div>

      <BiometricToggle />
    </div>
  )
}

function BiometricToggle() {
  const [available, setAvailable] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isNativeApp()) return
    isBiometricAvailable().then(setAvailable)
    setEnabled(isBiometricEnabled())
  }, [])

  if (!isNativeApp() || !available) return null

  const handleToggle = async () => {
    setBusy(true)
    try {
      if (enabled) {
        setBiometricEnabled(false)
        setEnabled(false)
      } else {
        const ok = await authenticateBiometric("Enable biometric unlock for Suprameds")
        if (ok) {
          setBiometricEnabled(true)
          setEnabled(true)
        }
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)", fontFamily: "Fraunces, Georgia, serif" }}>
        Security
      </h2>
      <button
        onClick={handleToggle}
        disabled={busy}
        className="w-full flex items-center justify-between gap-4 bg-[var(--bg-secondary)] border rounded-xl p-4 text-left disabled:opacity-60"
        style={{ borderColor: "var(--border-primary)" }}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Biometric unlock
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            Require fingerprint or face ID to open your account.
          </p>
        </div>
        <span
          className="shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors"
          style={{ background: enabled ? "var(--brand-teal)" : "var(--bg-tertiary)" }}
        >
          <span
            className="h-5 w-5 rounded-full bg-white transition-transform"
            style={{ transform: enabled ? "translateX(22px)" : "translateX(2px)" }}
          />
        </span>
      </button>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium mb-0.5" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </p>
      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  )
}
