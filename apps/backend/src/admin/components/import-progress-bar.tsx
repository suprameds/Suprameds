import { Text } from "@medusajs/ui"

/**
 * Shared progress state used by all import flows in the admin.
 * Pass this into <ImportProgressBar progress={...} />.
 */
export type ImportProgressState = {
  /** "idle" = hidden; other values show the bar */
  state: "idle" | "reading" | "uploading" | "done" | "error"
  /** Human-readable status line */
  message: string
  /** Total rows parsed from the file */
  totalRows: number
  /** Rows sent so far */
  rowsSent: number
  /** Rows successfully saved */
  rowsImported: number
  /** Rows skipped / already exist */
  rowsSkipped: number
  /** Rows that failed */
  rowsErrored: number
  /** 0–100 */
  percent: number
}

export const IDLE_IMPORT: ImportProgressState = {
  state: "idle",
  message: "",
  totalRows: 0,
  rowsSent: 0,
  rowsImported: 0,
  rowsSkipped: 0,
  rowsErrored: 0,
  percent: 0,
}

type Props = {
  progress: ImportProgressState
}

export const ImportProgressBar = ({ progress }: Props) => {
  if (progress.state === "idle") return null

  const { state, percent, message, totalRows, rowsSent, rowsImported, rowsSkipped, rowsErrored } = progress

  const barColor =
    state === "error" ? "#EF4444"
    : state === "done" ? "#22C55E"
    : "#3B82F6"

  const stateLabel =
    state === "reading" ? "Reading file..."
    : state === "uploading" ? "Uploading..."
    : state === "done" ? "Import complete"
    : "Import failed"

  return (
    <div className="mt-4 p-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <Text className="text-sm font-medium">{stateLabel}</Text>
        <Text className="text-sm font-semibold" style={{ color: barColor }}>
          {percent}%
        </Text>
      </div>

      {/* Progress bar track */}
      <div className="w-full h-3 rounded-full bg-ui-bg-base overflow-hidden border border-ui-border-base">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percent}%`, backgroundColor: barColor }}
        />
      </div>

      {/* Counter pills */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
        {totalRows > 0 && (
          <Text className="text-xs text-ui-fg-subtle">
            Total: <strong>{totalRows.toLocaleString()}</strong>
          </Text>
        )}
        {rowsSent > 0 && (
          <Text className="text-xs text-ui-fg-subtle">
            Sent: <strong>{rowsSent.toLocaleString()}</strong>
          </Text>
        )}
        {rowsImported > 0 && (
          <Text className="text-xs" style={{ color: "#22C55E" }}>
            ✓ Created: <strong>{rowsImported.toLocaleString()}</strong>
          </Text>
        )}
        {rowsSkipped > 0 && (
          <Text className="text-xs text-ui-fg-subtle">
            Skipped: <strong>{rowsSkipped.toLocaleString()}</strong>
          </Text>
        )}
        {rowsErrored > 0 && (
          <Text className="text-xs" style={{ color: "#EF4444" }}>
            ✗ Errors: <strong>{rowsErrored.toLocaleString()}</strong>
          </Text>
        )}
      </div>

      {/* Status message */}
      <Text
        className="text-xs mt-2 leading-relaxed"
        style={{
          color:
            state === "error" ? "#EF4444"
            : state === "done" ? "#22C55E"
            : "#6B7280",
        }}
      >
        {message}
      </Text>
    </div>
  )
}
