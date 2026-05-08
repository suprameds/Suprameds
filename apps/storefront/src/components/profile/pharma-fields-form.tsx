import { useState } from "react"
import { useUpdateCustomer } from "@/lib/hooks/use-customer"
import type { PharmaCustomerMetadata } from "@/lib/types/pharma-customer"

const INPUT_CLS = "w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-offset-1"

export function PharmaFieldsForm({ initial }: { initial: PharmaCustomerMetadata }) {
  const [dob, setDob] = useState(initial.dob ?? "")
  const [gender, setGender] = useState<PharmaCustomerMetadata["gender"]>(initial.gender)
  const [language, setLanguage] = useState<PharmaCustomerMetadata["preferred_language"]>(initial.preferred_language)
  const [allergies, setAllergies] = useState<string>((initial.allergies ?? []).join(", "))
  const [conditions, setConditions] = useState<string>((initial.chronic_conditions ?? []).join(", "))
  const [abhaId, setAbhaId] = useState(initial.abha_id ?? "")
  const [gst, setGst] = useState(initial.gst_number ?? "")
  const [emergencyName, setEmergencyName] = useState(initial.emergency_contact?.name ?? "")
  const [emergencyPhone, setEmergencyPhone] = useState(initial.emergency_contact?.phone ?? "")

  const update = useUpdateCustomer()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const metadata: Partial<PharmaCustomerMetadata> = {
      dob: dob || undefined,
      gender,
      preferred_language: language,
      allergies: allergies ? allergies.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      chronic_conditions: conditions ? conditions.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      abha_id: abhaId || undefined,
      gst_number: gst || undefined,
      emergency_contact: emergencyName && emergencyPhone
        ? { name: emergencyName, phone: emergencyPhone }
        : undefined,
    }
    update.mutate(
      { metadata },
      {
        onSuccess: () => {
          setSaved(true)
          setTimeout(() => setSaved(false), 3000)
        },
        onError: () => setError("Couldn't save medical details. Please try again."),
      }
    )
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Date of birth">
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={INPUT_CLS} style={{ borderColor: "var(--border-primary)" }} />
      </Field>
      <Field label="Gender">
        <select
          value={gender ?? ""}
          onChange={(e) => setGender((e.target.value || undefined) as PharmaCustomerMetadata["gender"])}
          className={INPUT_CLS}
          style={{ borderColor: "var(--border-primary)" }}
        >
          <option value="">Select…</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
          <option value="prefer_not_to_say">Prefer not to say</option>
        </select>
      </Field>
      <Field label="Preferred language">
        <select
          value={language ?? ""}
          onChange={(e) => setLanguage((e.target.value || undefined) as PharmaCustomerMetadata["preferred_language"])}
          className={INPUT_CLS}
          style={{ borderColor: "var(--border-primary)" }}
        >
          <option value="">Select…</option>
          <option value="en">English</option>
          <option value="hi">हिन्दी</option>
          <option value="ml">മലയാളം</option>
          <option value="te">తెలుగు</option>
          <option value="ta">தமிழ்</option>
        </select>
      </Field>
      <Field label="ABHA ID (optional)">
        <input value={abhaId} onChange={(e) => setAbhaId(e.target.value)} placeholder="14-digit ABHA" className={INPUT_CLS} style={{ borderColor: "var(--border-primary)" }} />
      </Field>
      <Field label="Allergies (comma-separated)" wide>
        <input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="e.g. Penicillin, Sulfa" className={INPUT_CLS} style={{ borderColor: "var(--border-primary)" }} />
      </Field>
      <Field label="Chronic conditions (comma-separated)" wide>
        <input value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="e.g. Diabetes, Hypertension" className={INPUT_CLS} style={{ borderColor: "var(--border-primary)" }} />
      </Field>
      <Field label="GST number (for business invoices)" wide>
        <input value={gst} onChange={(e) => setGst(e.target.value)} placeholder="22AAAAA0000A1Z5" className={INPUT_CLS} style={{ borderColor: "var(--border-primary)" }} />
      </Field>
      <Field label="Emergency contact name">
        <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} placeholder="Spouse, parent, etc." className={INPUT_CLS} style={{ borderColor: "var(--border-primary)" }} />
      </Field>
      <Field label="Emergency contact phone">
        <input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="+91 9876543210" className={INPUT_CLS} style={{ borderColor: "var(--border-primary)" }} />
      </Field>
      {error && (
        <p className="md:col-span-2 text-sm" style={{ color: "#B91C1C" }}>{error}</p>
      )}
      <div className="md:col-span-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={update.isPending}
          className="px-4 py-2 rounded-lg text-white font-medium disabled:opacity-60"
          style={{ background: "var(--brand-teal)" }}
        >
          {update.isPending ? "Saving…" : "Save medical details"}
        </button>
        {saved && <span className="text-sm" style={{ color: "var(--brand-teal)" }}>Saved ✓</span>}
      </div>
    </form>
  )
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "md:col-span-2" : undefined}>
      <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
        {label}
      </label>
      {children}
    </div>
  )
}
