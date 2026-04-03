import { usePharmacistPrescriptions, type PharmacistPrescription } from "@/lib/hooks/use-pharmacist"
import { Link, useLocation } from "@tanstack/react-router"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { useState } from "react"

type StatusFilter = "pending_review" | "approved" | "all"

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "pending_review", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "all", label: "All" },
]

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending_review: { bg: "rgba(245,158,11,0.1)", color: "var(--brand-amber)", label: "Pending" },
  approved: { bg: "rgba(22,163,74,0.1)", color: "var(--price-color)", label: "Approved" },
  rejected: { bg: "rgba(239,68,68,0.1)", color: "var(--brand-red)", label: "Rejected" },
  expired: { bg: "rgba(107,114,128,0.1)", color: "var(--text-tertiary)", label: "Expired" },
  used: { bg: "rgba(14,124,134,0.1)", color: "var(--brand-teal)", label: "Used" },
}

export default function RxQueuePage() {
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending_review")

  const queryStatus = statusFilter === "all" ? undefined : statusFilter
  const { data: prescriptions, isLoading } = usePharmacistPrescriptions(queryStatus)

  const count = prescriptions?.length ?? 0

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1
            className="text-xl lg:text-2xl font-semibold"
            style={{ color: "var(--text-primary)", fontFamily: "Fraunces, Georgia, serif" }}
          >
            Rx Queue
          </h1>
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: "rgba(14,124,134,0.1)", color: "var(--brand-teal)" }}
          >
            Pharmacist
          </span>
        </div>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Review prescriptions and create orders for customers.
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: statusFilter === tab.key ? "var(--bg-inverse)" : "var(--bg-secondary)",
              color: statusFilter === tab.key ? "var(--text-inverse)" : "var(--text-primary)",
              border: `1px solid ${statusFilter === tab.key ? "var(--bg-inverse)" : "var(--border-primary)"}`,
            }}
          >
            {tab.label}
          </button>
        ))}
        {!isLoading && (
          <span className="self-center text-xs ml-2" style={{ color: "var(--text-tertiary)" }}>
            {count} prescription{count !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border p-5 animate-pulse"
              style={{ background: "var(--bg-secondary)", borderColor: "var(--border-primary)" }}
            >
              <div className="flex items-start gap-4">
                <div className="w-16 h-20 rounded-lg" style={{ background: "var(--bg-tertiary)" }} />
                <div className="flex-1">
                  <div className="h-4 w-24 rounded mb-2" style={{ background: "var(--bg-tertiary)" }} />
                  <div className="h-3 w-40 rounded mb-1.5" style={{ background: "var(--bg-tertiary)" }} />
                  <div className="h-3 w-32 rounded" style={{ background: "var(--bg-tertiary)" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : count === 0 ? (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border-primary)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {statusFilter === "pending_review"
              ? "No prescriptions pending review."
              : statusFilter === "approved"
                ? "No approved prescriptions."
                : "No prescriptions found."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {prescriptions!.map((rx) => (
            <RxCard key={rx.id} rx={rx} countryCode={countryCode} />
          ))}
        </div>
      )}
    </div>
  )
}

function RxCard({ rx, countryCode }: { rx: PharmacistPrescription; countryCode: string }) {
  const style = STATUS_STYLES[rx.status] ?? STATUS_STYLES.pending_review
  const uploadDate = new Date(rx.created_at).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })

  return (
    <Link
      to="/$countryCode/account/pharmacist/prescription/$prescriptionId"
      params={{ countryCode, prescriptionId: rx.id }}
      className="rounded-xl border p-5 transition-all hover:shadow-sm block"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border-primary)" }}
    >
      <div className="flex items-start gap-4">
        {/* Thumbnail */}
        <div
          className="w-14 h-18 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
          style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)" }}
        >
          {rx.file_url && rx.mime_type?.startsWith("image/") ? (
            <img src={rx.file_url} alt="Rx" className="w-full h-full object-cover" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: style.bg, color: style.color }}
            >
              {style.label}
            </span>
            <span className="text-[11px] font-mono" style={{ color: "var(--text-tertiary)" }}>
              #{rx.id.slice(-8).toUpperCase()}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            {rx.patient_name && (
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Patient: {rx.patient_name}
              </p>
            )}
            {rx.doctor_name && (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Dr. {rx.doctor_name}
              </p>
            )}
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              Uploaded {uploadDate}
              {rx.customer_id && (
                <span> · Customer: {rx.customer_id.slice(-6).toUpperCase()}</span>
              )}
            </p>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex-shrink-0 self-center" style={{ color: "var(--text-tertiary)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </Link>
  )
}
