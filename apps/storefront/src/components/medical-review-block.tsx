/**
 * MedicalReviewBlock — displays the named pharmacist who reviewed the page and
 * when. Required on every YMYL content page (drug pages, blog posts, FAQ,
 * prescription policy, salt landing pages) for Google E-E-A-T and IT Rules
 * 2021 / D&C Rules disclosure expectations.
 *
 * Pure display component — no side effects, no data fetching. Pass the
 * reviewer details + dates in; safe defaults match the registered pharmacist
 * on file in CLAUDE.md.
 */

type MedicalReviewBlockProps = {
  /** When the content was last reviewed by the pharmacist. */
  lastReviewedAt: Date | string | null | undefined
  /** Optional next-review-due date (180 days after lastReviewedAt is typical). */
  nextReviewAt?: Date | string | null
  /** Pharmacist full name. Defaults to the registered pharmacist on file. */
  reviewerName?: string
  /** Pharmacist post-nominal qualifications. */
  reviewerCredential?: string
  /** State Pharmacy Council registration number. */
  reviewerRegNo?: string
  /** Council that issued the registration. */
  reviewerCouncil?: string
  /** Layout variant. */
  variant?: "card" | "compact"
}

const DEFAULT_REVIEWER_NAME = "Mirza Askary Ali"
const DEFAULT_REVIEWER_CREDENTIAL = "B.Pharm, Registered Pharmacist"
const DEFAULT_REVIEWER_REG_NO = "TSPC #031171/A1"
const DEFAULT_REVIEWER_COUNCIL = "Telangana State Pharmacy Council"

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default function MedicalReviewBlock({
  lastReviewedAt,
  nextReviewAt,
  reviewerName = DEFAULT_REVIEWER_NAME,
  reviewerCredential = DEFAULT_REVIEWER_CREDENTIAL,
  reviewerRegNo = DEFAULT_REVIEWER_REG_NO,
  reviewerCouncil = DEFAULT_REVIEWER_COUNCIL,
  variant = "card",
}: MedicalReviewBlockProps) {
  const reviewed = toDate(lastReviewedAt)
  const nextDue = toDate(nextReviewAt)

  if (variant === "compact") {
    return (
      <div
        className="text-xs leading-relaxed"
        style={{ color: "var(--text-tertiary)" }}
      >
        <span>Medically reviewed by </span>
        <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
          {reviewerName}
        </span>
        <span>{`, ${reviewerCredential} · ${reviewerRegNo}`}</span>
        {reviewed && (
          <>
            <span> · Last reviewed </span>
            <time dateTime={isoDate(reviewed)}>{formatDate(reviewed)}</time>
          </>
        )}
      </div>
    )
  }

  return (
    <aside
      aria-label="Medical review information"
      className="rounded-xl p-5"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-primary)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
          style={{
            background: "color-mix(in srgb, var(--brand-teal) 12%, transparent)",
            color: "var(--brand-teal)",
          }}
          aria-hidden="true"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[11px] font-semibold uppercase tracking-widest mb-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            Medically reviewed by
          </p>
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {reviewerName}
          </p>
          <p
            className="text-xs leading-relaxed mt-0.5"
            style={{ color: "var(--text-secondary)" }}
          >
            {reviewerCredential} · {reviewerRegNo}
            <br />
            {reviewerCouncil}
          </p>

          {reviewed && (
            <div
              className="mt-3 pt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs"
              style={{
                borderTop: "1px solid var(--border-primary)",
                color: "var(--text-tertiary)",
              }}
            >
              <span>
                Last reviewed:{" "}
                <time
                  dateTime={isoDate(reviewed)}
                  style={{ color: "var(--text-secondary)" }}
                >
                  {formatDate(reviewed)}
                </time>
              </span>
              {nextDue && (
                <span>
                  Next review due:{" "}
                  <time
                    dateTime={isoDate(nextDue)}
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {formatDate(nextDue)}
                  </time>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
