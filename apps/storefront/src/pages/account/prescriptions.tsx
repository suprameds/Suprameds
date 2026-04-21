import { AccountListSkeleton } from "@/components/ui/skeletons"
import { useCustomerPrescriptions, type PrescriptionSummary } from "@/lib/hooks/use-prescriptions"
import { useCustomer } from "@/lib/hooks/use-customer"
import { Link } from "@tanstack/react-router"
import { useState } from "react"

type StatusFilter = "all" | "pending_review" | "approved" | "rejected" | "expired"

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending_review", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "expired", label: "Expired" },
]

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending_review: { bg: "rgba(245,158,11,0.1)", color: "var(--brand-amber)", label: "Pending Review" },
  approved: { bg: "rgba(22,163,74,0.1)", color: "var(--price-color)", label: "Approved" },
  rejected: { bg: "rgba(239,68,68,0.1)", color: "var(--brand-red)", label: "Rejected" },
  expired: { bg: "rgba(107,114,128,0.1)", color: "var(--text-tertiary)", label: "Expired" },
  used: { bg: "rgba(14,124,134,0.1)", color: "var(--brand-teal)", label: "Used" },
}

export default function PrescriptionsPage() {
  const { data: customer } = useCustomer()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const { data: prescriptions, isLoading, isError } = useCustomerPrescriptions({
    status: statusFilter === "all" ? undefined : statusFilter,
    enabled: !!customer,
  })

  const filtered = prescriptions ?? []

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="text-xl lg:text-2xl font-semibold"
            style={{ color: "var(--text-primary)", fontFamily: "Fraunces, Georgia, serif" }}
          >
            My Prescriptions
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            View and manage your uploaded prescriptions
          </p>
        </div>
        <Link
          to="/upload-rx"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
          style={{ background: "var(--brand-teal)", color: "var(--text-inverse)" }}
        >
          <UploadIcon />
          Upload New
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: statusFilter === tab.key ? "var(--bg-inverse)" : "var(--bg-secondary)",
              color: statusFilter === tab.key ? "var(--text-inverse)" : "var(--text-primary)",
              border: `1px solid ${statusFilter === tab.key ? "var(--bg-inverse)" : "var(--border-primary)"}`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <AccountListSkeleton rows={3} />
      ) : isError ? (
        <div
          className="rounded-xl border p-8 text-center"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border-primary)" }}
        >
          <p className="text-sm" style={{ color: "var(--brand-red)" }}>
            Failed to load prescriptions. Please try again.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState statusFilter={statusFilter} />
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((rx) => (
            <PrescriptionCard key={rx.id} rx={rx} />
          ))}
        </div>
      )}
    </div>
  )
}

function PrescriptionCard({ rx }: { rx: PrescriptionSummary }) {
  const style = STATUS_STYLES[rx.status] ?? STATUS_STYLES.pending_review
  const uploadDate = new Date(rx.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  const validUntil = rx.valid_until
    ? new Date(rx.valid_until).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null

  return (
    <div
      className="rounded-xl border p-5 transition-all hover:shadow-sm"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border-primary)" }}
    >
      <div className="flex items-start gap-4">
        {/* Thumbnail / file preview */}
        <div
          className="w-16 h-20 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
          style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)" }}
        >
          {rx.file_url ? (
            <img
              src={rx.file_url}
              alt="Prescription"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none"
                ;(e.target as HTMLImageElement).parentElement!.innerHTML =
                  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
              }}
            />
          ) : (
            <FileIcon />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: style.bg, color: style.color }}
            >
              {style.label}
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              #{rx.id.slice(-8).toUpperCase()}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            {rx.doctor_name && (
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Dr. {rx.doctor_name}
              </p>
            )}
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Uploaded {uploadDate}
              {rx.original_filename && (
                <span style={{ color: "var(--text-tertiary)" }}> · {rx.original_filename}</span>
              )}
            </p>
            {validUntil && (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Valid until {validUntil}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {rx.file_url && (
            <a
              href={rx.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
              style={{ color: "var(--brand-teal)", background: "rgba(14,124,134,0.06)" }}
            >
              View
            </a>
          )}
          {(rx.status === "rejected" || rx.status === "expired") && (
            <Link
              to="/upload-rx"
              className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
              style={{ color: "var(--brand-amber)", background: "rgba(245,158,11,0.06)" }}
            >
              Re-upload
            </Link>
          )}
        </div>
      </div>

      {/* Rejection reason */}
      {rx.status === "rejected" && (rx as any).rejection_reason && (
        <div
          className="mt-3 p-3 rounded-lg text-xs"
          style={{ background: "rgba(239,68,68,0.04)", color: "var(--brand-red)" }}
        >
          <span className="font-semibold">Reason: </span>
          {(rx as any).rejection_reason}
        </div>
      )}
    </div>
  )
}

function EmptyState({ statusFilter }: { statusFilter: StatusFilter }) {
  const messages: Record<StatusFilter, string> = {
    all: "You haven't uploaded any prescriptions yet.",
    pending_review: "No prescriptions are currently under review.",
    approved: "No approved prescriptions found.",
    rejected: "No rejected prescriptions.",
    expired: "No expired prescriptions.",
  }

  return (
    <div
      className="rounded-xl border p-12 text-center"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border-primary)" }}
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ background: "var(--bg-tertiary)" }}
      >
        <FileIcon />
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
        {messages[statusFilter]}
      </p>
      {statusFilter === "all" && (
        <>
          <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
            Upload a prescription to order Schedule H/H1 medicines.
          </p>
          <Link
            to="/upload-rx"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: "var(--brand-teal)", color: "var(--text-inverse)" }}
          >
            <UploadIcon />
            Upload Prescription
          </Link>
        </>
      )}
    </div>
  )
}

const UploadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

const FileIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)
