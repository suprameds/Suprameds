import { createFileRoute } from "@tanstack/react-router"
import { lazy, Suspense, useState } from "react"
import { useCustomer, useUpdateCustomer } from "@/lib/hooks/use-customer"

const LoyaltyDashboard = lazy(() => import("@/components/loyalty-dashboard"))

export const Route = createFileRoute("/$countryCode/account/_layout/profile")({
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
        <h1 className="text-xl font-serif font-semibold" style={{ color: "#0D1B2A" }}>
          Profile
        </h1>
        <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>
          Manage your personal information
        </p>
      </div>

      {/* Personal info card */}
      <div className="bg-white border rounded-xl p-6" style={{ borderColor: "#EDE9E1" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold" style={{ color: "#374151" }}>
            Personal information
          </h2>
          {!editing && (
            <button
              onClick={handleEdit}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-all hover:bg-gray-50"
              style={{ color: "#0D1B2A", borderColor: "#D1D5DB" }}
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "#6B7280" }}>
                  First name
                </label>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                  className="px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-offset-1"
                  style={{ borderColor: "#D1D5DB" }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "#6B7280" }}>
                  Last name
                </label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                  className="px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-offset-1"
                  style={{ borderColor: "#D1D5DB" }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "#6B7280" }}>
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
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="flex-1 px-3 py-2 rounded-r-lg border text-sm outline-none focus:ring-2 focus:ring-offset-1"
                  style={{ borderColor: "#D1D5DB" }}
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
                style={{ background: "#0D1B2A" }}
              >
                {updateCustomer.isPending ? "Saving..." : "Save changes"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-gray-50"
                style={{ borderColor: "#D1D5DB", color: "#374151" }}
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
      <div className="bg-white border rounded-xl p-6" style={{ borderColor: "#EDE9E1" }}>
        <h2 className="text-sm font-semibold mb-1" style={{ color: "#374151" }}>
          Email address
        </h2>
        <p className="text-sm" style={{ color: "#6B7280" }}>
          {customer?.email}
        </p>
        <p className="text-xs mt-2" style={{ color: "#9CA3AF" }}>
          Email cannot be changed. Contact{" "}
          <a href="/grievance" className="underline" style={{ color: "#6B7280" }}>
            support
          </a>{" "}
          if you need to update your email.
        </p>
      </div>

      {/* Loyalty Points section */}
      <div>
        <h2
          className="text-lg font-semibold mb-3"
          style={{ color: "#0D1B2A", fontFamily: "Fraunces, Georgia, serif" }}
        >
          Loyalty Rewards
        </h2>
        <Suspense
          fallback={
            <div className="bg-white border rounded-xl p-6 animate-pulse" style={{ borderColor: "#EDE9E1" }}>
              <div className="h-4 w-32 rounded" style={{ background: "#E5E7EB" }} />
            </div>
          }
        >
          <LoyaltyDashboard />
        </Suspense>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium mb-0.5" style={{ color: "#9CA3AF" }}>
        {label}
      </p>
      <p className="text-sm font-medium" style={{ color: "#111827" }}>
        {value}
      </p>
    </div>
  )
}
