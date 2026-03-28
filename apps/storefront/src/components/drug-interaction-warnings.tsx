import { clsx } from "clsx"

type DrugInteraction = {
  drug_a: string
  drug_b: string
  severity: "major" | "moderate" | "minor"
  description: string
}

interface DrugInteractionWarningsProps {
  interactions: DrugInteraction[]
  /** Compact mode renders smaller cards — used in the cart drawer */
  compact?: boolean
  className?: string
}

const severityConfig = {
  major: {
    icon: "⚠️",
    label: "MAJOR INTERACTION",
    bg: "rgba(192,57,43,0.08)",
    border: "rgba(192,57,43,0.30)",
    labelColor: "var(--brand-red)",
    textColor: "#7F1D1D",
  },
  moderate: {
    icon: "⚡",
    label: "Moderate Interaction",
    bg: "rgba(214,137,16,0.08)",
    border: "rgba(214,137,16,0.30)",
    labelColor: "var(--brand-amber)",
    textColor: "#78350F",
  },
  minor: {
    icon: "ℹ️",
    label: "Minor Interaction",
    bg: "#F3F4F6",
    border: "#E5E7EB",
    labelColor: "var(--text-secondary)",
    textColor: "#374151",
  },
} as const

/**
 * Renders drug interaction warnings attached to a cart's metadata.
 * Sorts by severity (major first) for maximum visibility.
 */
export const DrugInteractionWarnings = ({
  interactions,
  compact = false,
  className,
}: DrugInteractionWarningsProps) => {
  if (!interactions || interactions.length === 0) return null

  const sorted = [...interactions].sort((a, b) => {
    const order = { major: 0, moderate: 1, minor: 2 }
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3)
  })

  const hasMajor = sorted.some((i) => i.severity === "major")

  return (
    <div className={clsx("flex flex-col gap-2", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg
          width={compact ? "14" : "16"}
          height={compact ? "14" : "16"}
          viewBox="0 0 24 24"
          fill="none"
          stroke={hasMajor ? "var(--brand-red)" : "var(--brand-amber)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span
          className={clsx(
            "font-semibold",
            compact ? "text-xs" : "text-sm"
          )}
          style={{ color: hasMajor ? "var(--brand-red)" : "var(--brand-amber)" }}
        >
          Drug Interaction{interactions.length > 1 ? "s" : ""} Detected
        </span>
      </div>

      {/* Individual warnings */}
      {sorted.map((interaction, idx) => {
        const config = severityConfig[interaction.severity]
        return (
          <div
            key={`${interaction.drug_a}-${interaction.drug_b}-${idx}`}
            className={clsx(
              "rounded-lg border",
              compact ? "px-3 py-2" : "px-4 py-3"
            )}
            style={{
              background: config.bg,
              borderColor: config.border,
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className={compact ? "text-xs" : "text-sm"}>
                {config.icon}
              </span>
              <span
                className={clsx(
                  "font-bold uppercase tracking-wide",
                  compact ? "text-[10px]" : "text-xs"
                )}
                style={{ color: config.labelColor }}
              >
                {config.label}
              </span>
            </div>
            <p
              className={clsx(
                "leading-relaxed",
                compact ? "text-[11px]" : "text-xs"
              )}
              style={{ color: config.textColor }}
            >
              <strong>{interaction.drug_a}</strong> + <strong>{interaction.drug_b}</strong>:{" "}
              {interaction.description}
            </p>
          </div>
        )
      })}

      {/* Consult note */}
      <p
        className={clsx(
          "flex items-center gap-1.5",
          compact ? "text-[10px]" : "text-xs"
        )}
        style={{ color: "var(--text-secondary)" }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        Please consult your doctor or pharmacist
      </p>
    </div>
  )
}

export default DrugInteractionWarnings
