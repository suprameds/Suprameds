import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import {
  useCustomerAddresses,
  useCreateAddress,
  useDeleteAddress,
} from "@/lib/hooks/use-customer"

export const Route = createFileRoute(
  "/$countryCode/account/_layout/addresses"
)({
  head: () => ({
    meta: [
      { title: "Addresses | Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AddressesPage,
})

type AddressForm = {
  first_name: string
  last_name: string
  address_1: string
  address_2: string
  city: string
  province: string
  postal_code: string
  phone: string
}

const emptyForm: AddressForm = {
  first_name: "",
  last_name: "",
  address_1: "",
  address_2: "",
  city: "",
  province: "",
  postal_code: "",
  phone: "",
}

function AddressesPage() {
  const { data: addresses, isLoading } = useCustomerAddresses()
  const createAddress = useCreateAddress()
  const deleteAddress = useDeleteAddress()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<AddressForm>(emptyForm)
  const [formError, setFormError] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }))
  }

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")

    if (!form.first_name || !form.last_name || !form.address_1 || !form.city || !form.postal_code) {
      setFormError("Please fill in all required fields.")
      return
    }

    createAddress.mutate(
      {
        first_name: form.first_name,
        last_name: form.last_name,
        address_1: form.address_1,
        address_2: form.address_2 || undefined,
        city: form.city,
        province: form.province || undefined,
        postal_code: form.postal_code,
        country_code: "in",
        phone: form.phone || undefined,
      },
      {
        onSuccess: () => {
          setForm(emptyForm)
          setShowForm(false)
        },
        onError: () => {
          setFormError("Failed to save address. Please try again.")
        },
      }
    )
  }

  const handleDelete = (id: string) => {
    setDeletingId(id)
    deleteAddress.mutate(id, {
      onSettled: () => setDeletingId(null),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-serif font-semibold" style={{ color: "var(--text-primary)" }}>
            Addresses
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
            Manage your delivery addresses
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "var(--bg-inverse)" }}
          >
            + Add address
          </button>
        )}
      </div>

      {/* Add address form */}
      {showForm && (
        <div className="bg-[var(--bg-secondary)] border rounded-xl p-6" style={{ borderColor: "var(--brand-green)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
            New delivery address
          </h2>
          <form onSubmit={handleAddAddress} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name *" name="first_name" value={form.first_name} onChange={handleChange} placeholder="Aarav" />
              <Field label="Last name *" name="last_name" value={form.last_name} onChange={handleChange} placeholder="Sharma" />
            </div>
            <Field label="Address line 1 *" name="address_1" value={form.address_1} onChange={handleChange} placeholder="Flat / House No., Street" />
            <Field label="Address line 2" name="address_2" value={form.address_2} onChange={handleChange} placeholder="Landmark, Area (optional)" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="City *" name="city" value={form.city} onChange={handleChange} placeholder="Bengaluru" />
              <Field label="State" name="province" value={form.province} onChange={handleChange} placeholder="Karnataka" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="PIN code *" name="postal_code" value={form.postal_code} onChange={handleChange} placeholder="560001" />
              <Field label="Phone" name="phone" value={form.phone} onChange={handleChange} placeholder="98765 43210" />
            </div>

            {formError && (
              <p className="text-sm" style={{ color: "var(--brand-red)" }}>{formError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={createAddress.isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: "var(--bg-inverse)" }}
              >
                {createAddress.isPending ? "Saving..." : "Save address"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(emptyForm); setFormError("") }}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-gray-50"
                style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="bg-[var(--bg-secondary)] border rounded-xl p-8 text-center" style={{ borderColor: "var(--border-primary)" }}>
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading addresses...</p>
        </div>
      ) : !addresses?.length && !showForm ? (
        <div className="bg-[var(--bg-secondary)] border rounded-xl p-12 text-center" style={{ borderColor: "var(--border-primary)" }}>
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
            style={{ background: "var(--bg-tertiary)" }}
          >
            <PinIcon />
          </div>
          <h3 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            No addresses saved
          </h3>
          <p className="text-sm mb-6" style={{ color: "var(--text-tertiary)" }}>
            Add a delivery address to speed up checkout.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-block px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "var(--bg-inverse)" }}
          >
            Add address
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {addresses?.map((address) => (
            <div
              key={address.id}
              className="bg-[var(--bg-secondary)] border rounded-xl p-5 flex flex-col justify-between gap-4"
              style={{ borderColor: "var(--border-primary)" }}
            >
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {address.first_name} {address.last_name}
                </p>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {address.address_1}
                  {address.address_2 && `, ${address.address_2}`}
                  <br />
                  {address.city}{address.province ? `, ${address.province}` : ""} — {address.postal_code}
                  <br />
                  India
                </p>
                {address.phone && (
                  <p className="text-xs mt-1.5" style={{ color: "var(--text-tertiary)" }}>
                    +91 {address.phone}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleDelete(address.id)}
                  disabled={deletingId === address.id}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-all hover:bg-red-50 disabled:opacity-60"
                  style={{ color: "var(--brand-red)", borderColor: "#FECACA" }}
                >
                  {deletingId === address.id ? "Removing..." : "Remove"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
}: {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </label>
      <input
        name={name}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-offset-1"
        style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
      />
    </div>
  )
}

const PinIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
)
