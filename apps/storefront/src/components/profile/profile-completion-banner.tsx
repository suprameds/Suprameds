import { useCustomer } from "@/lib/hooks/use-customer"
import { computeProfileCompleteness } from "@/lib/utils/profile-completeness"

export function ProfileCompletionBanner() {
  const { data: customer } = useCustomer()
  if (!customer) return null
  const { percent, missing } = computeProfileCompleteness(customer)
  if (percent >= 80) return null

  return (
    <div
      className="rounded-lg p-4 border"
      style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-primary)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Complete your profile ({percent}%)
        </p>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {missing.length} {missing.length === 1 ? "field" : "fields"} remaining
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-primary)" }}>
        <div className="h-full transition-all" style={{ width: `${percent}%`, background: "var(--brand-teal)" }} />
      </div>
      <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
        Helps us personalize medication reminders and flag drug interactions.
      </p>
    </div>
  )
}
