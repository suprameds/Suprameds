import { clsx } from "clsx"

type ThumbnailProps = {
  thumbnail?: string | null
  alt: string
  className?: string
  dosageForm?: string | null
}

/** Dosage form icon — renders the appropriate medicine shape */
function MedicineIcon({ form }: { form?: string | null }) {
  const f = form?.toLowerCase() ?? ""

  // Tablet — round pill
  if (f.includes("tablet")) {
    return (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="22" fill="#E6F4F0" stroke="var(--brand-teal)" strokeWidth="1.5" />
        <line x1="10" y1="32" x2="54" y2="32" stroke="var(--brand-teal)" strokeWidth="1.5" strokeDasharray="2 2" />
        <circle cx="32" cy="32" r="6" fill="var(--brand-teal)" opacity="0.15" />
      </svg>
    )
  }

  // Capsule — two-tone pill
  if (f.includes("capsule")) {
    return (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
        <rect x="12" y="22" width="40" height="20" rx="10" fill="#E6F4F0" stroke="var(--brand-teal)" strokeWidth="1.5" />
        <rect x="32" y="22" width="20" height="20" rx="10" fill="var(--brand-teal)" opacity="0.2" />
        <line x1="32" y1="22" x2="32" y2="42" stroke="var(--brand-teal)" strokeWidth="1.5" />
      </svg>
    )
  }

  // Syrup / suspension — bottle
  if (f.includes("syrup") || f.includes("suspension") || f.includes("drops")) {
    return (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
        <rect x="22" y="8" width="20" height="8" rx="2" fill="#E6F4F0" stroke="var(--brand-teal)" strokeWidth="1.5" />
        <rect x="18" y="16" width="28" height="40" rx="4" fill="#E6F4F0" stroke="var(--brand-teal)" strokeWidth="1.5" />
        <rect x="22" y="32" width="20" height="20" rx="2" fill="var(--brand-teal)" opacity="0.12" />
        <line x1="26" y1="38" x2="38" y2="38" stroke="var(--brand-teal)" strokeWidth="1.5" />
      </svg>
    )
  }

  // Cream / tube
  if (f.includes("cream") || f.includes("gel") || f.includes("ointment")) {
    return (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
        <rect x="24" y="6" width="16" height="10" rx="3" fill="#E6F4F0" stroke="var(--brand-teal)" strokeWidth="1.5" />
        <path d="M20 16h24l4 40H16L20 16z" fill="#E6F4F0" stroke="var(--brand-teal)" strokeWidth="1.5" strokeLinejoin="round" />
        <line x1="24" y1="36" x2="40" y2="36" stroke="var(--brand-teal)" strokeWidth="1.5" />
      </svg>
    )
  }

  // Injection / vial
  if (f.includes("injection") || f.includes("vial")) {
    return (
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
        <rect x="28" y="6" width="8" height="12" rx="2" fill="#E6F4F0" stroke="var(--brand-teal)" strokeWidth="1.5" />
        <rect x="24" y="18" width="16" height="34" rx="4" fill="#E6F4F0" stroke="var(--brand-teal)" strokeWidth="1.5" />
        <circle cx="32" cy="35" r="5" fill="var(--brand-teal)" opacity="0.15" />
        <line x1="32" y1="30" x2="32" y2="40" stroke="var(--brand-teal)" strokeWidth="1.5" />
        <line x1="27" y1="35" x2="37" y2="35" stroke="var(--brand-teal)" strokeWidth="1.5" />
      </svg>
    )
  }

  // Default — generic pill shape
  return (
    <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
      <path
        d="M18.5 45.5l27-27a9.9 9.9 0 10-14-14l-27 27a9.9 9.9 0 1014 14z"
        fill="#E6F4F0"
        stroke="var(--brand-teal)"
        strokeWidth="1.5"
      />
      <line x1="24" y1="24" x2="40" y2="40" stroke="var(--brand-teal)" strokeWidth="1.5" strokeDasharray="2 2" />
    </svg>
  )
}

export const Thumbnail = ({ thumbnail, alt, className, dosageForm }: ThumbnailProps) => {
  if (thumbnail) {
    return (
      <img
        src={thumbnail}
        alt={alt}
        className={clsx("w-20 h-20 object-cover bg-[var(--bg-tertiary)]", className)}
      />
    )
  }

  return (
    <div
      className={clsx(
        "w-20 h-20 flex flex-col items-center justify-center gap-1",
        className
      )}
      style={{ background: "var(--bg-primary)" }}
    >
      <MedicineIcon form={dosageForm} />
      <span
        className="text-[8px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--brand-teal)", opacity: 0.5 }}
      >
        Suprameds
      </span>
    </div>
  )
}
