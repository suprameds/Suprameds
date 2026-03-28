import { useState, useCallback, useEffect } from "react"
import { HttpTypes } from "@medusajs/types"
import {
  useReturnRequest,
  RETURN_REASON_LABELS,
  ReturnReason,
  ReturnRequestItem,
} from "@/lib/hooks/use-refunds"

// ============ ELIGIBILITY HELPERS ============

/**
 * An order is returnable if its status is "delivered" or "completed".
 * Medusa uses fulfillment_status for "delivered"; order.status for "completed".
 */
export function isOrderReturnable(order: {
  status: string
  fulfillment_status?: string
}): boolean {
  const fulfillmentStatus = (order as any).fulfillment_status as string | undefined
  return (
    order.status === "completed" ||
    fulfillmentStatus === "delivered"
  )
}

/**
 * Returns true if the order is still within the 48-hour return window.
 * Uses created_at as a proxy when a real delivered_at is unavailable.
 */
export function isWithinReturnWindow(
  createdAt: string,
  windowHours = 48
): boolean {
  const created = new Date(createdAt).getTime()
  const now = Date.now()
  const diffHours = (now - created) / (1000 * 60 * 60)
  return diffHours <= windowHours
}

// ============ ICONS ============

const CloseIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const WarningIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--brand-amber-dark)"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="flex-shrink-0 mt-0.5"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const CheckCircleIcon = () => (
  <svg
    width="36"
    height="36"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#065F46"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
)

const SpinnerIcon = () => (
  <svg
    className="animate-spin"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
)

// ============ TYPES ============

type OrderItem = {
  id: string
  product_title?: string | null
  title?: string | null
  variant_title?: string | null
  quantity: number
  thumbnail?: string | null
}

type Props = {
  order: {
    id: string
    items: OrderItem[]
    status: string
    created_at: string
    fulfillment_status?: string
  }
  isOpen: boolean
  onClose: () => void
}

type LineItemState = {
  selected: boolean
  returnQty: number
  reason: ReturnReason
}

// ============ COMPONENT ============

export function ReturnRequestForm({ order, isOpen, onClose }: Props) {
  const mutation = useReturnRequest(order.id)

  // Per-item state
  const [itemStates, setItemStates] = useState<Record<string, LineItemState>>(
    () =>
      Object.fromEntries(
        (order.items ?? []).map((item) => [
          item.id,
          { selected: false, returnQty: 1, reason: "wrong_product" as ReturnReason },
        ])
      )
  )
  const [notes, setNotes] = useState("")
  const [submitted, setSubmitted] = useState(false)

  // Reset state every time modal opens
  useEffect(() => {
    if (isOpen) {
      setItemStates(
        Object.fromEntries(
          (order.items ?? []).map((item) => [
            item.id,
            { selected: false, returnQty: 1, reason: "wrong_product" as ReturnReason },
          ])
        )
      )
      setNotes("")
      setSubmitted(false)
      mutation.reset()
    }
  }, [isOpen, order.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCount = Object.values(itemStates).filter((s) => s.selected).length

  const handleToggle = useCallback((itemId: string) => {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], selected: !prev[itemId].selected },
    }))
  }, [])

  const handleQtyChange = useCallback(
    (itemId: string, qty: number, max: number) => {
      setItemStates((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], returnQty: Math.min(Math.max(1, qty), max) },
      }))
    },
    []
  )

  const handleReasonChange = useCallback((itemId: string, reason: ReturnReason) => {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], reason },
    }))
  }, [])

  const handleSubmit = useCallback(async () => {
    const items: ReturnRequestItem[] = Object.entries(itemStates)
      .filter(([, state]) => state.selected)
      .map(([itemId, state]) => ({
        line_item_id: itemId,
        quantity: state.returnQty,
        reason: state.reason,
      }))

    if (!items.length) return

    try {
      await mutation.mutateAsync({ items, notes: notes.trim() || undefined })
      setSubmitted(true)
    } catch {
      // error is surfaced via mutation.error
    }
  }, [itemStates, notes, mutation])

  const handleClose = useCallback(() => {
    mutation.reset()
    onClose()
  }, [mutation, onClose])

  if (!isOpen) return null

  const withinWindow = isWithinReturnWindow(order.created_at)

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(13, 27, 42, 0.55)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      {/* Modal panel */}
      <div
        className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl"
        style={{ background: "var(--bg-secondary)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ background: "var(--bg-inverse)", borderRadius: "inherit" }}
        >
          <h2 className="text-base font-semibold text-white">Request a Return</h2>
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-white/10 text-white/70 hover:text-white"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 p-5">
          {/* Success state */}
          {submitted ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <CheckCircleIcon />
              <div>
                <p className="text-base font-semibold" style={{ color: "#065F46" }}>
                  Return Request Submitted
                </p>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  Our team will review your request and contact you within 24 hours.
                  Pickup will be arranged if approved.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="mt-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: "var(--bg-inverse)" }}
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Warning banner */}
              <div
                className="flex items-start gap-2.5 rounded-xl p-3.5"
                style={{ background: "#FEF3C7", border: "1px solid #FCD34D" }}
              >
                <WarningIcon />
                <p className="text-xs leading-relaxed" style={{ color: "var(--brand-amber-dark)" }}>
                  Returns must be requested within 48 hours of delivery.{" "}
                  <strong>Opened medicines cannot be returned.</strong>
                </p>
              </div>

              {/* Window expired notice */}
              {!withinWindow && (
                <div
                  className="rounded-xl p-3.5 text-sm"
                  style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B" }}
                >
                  The 48-hour return window for this order has passed. If you believe
                  you have a valid exception (e.g. batch recall), please contact our
                  support team directly.
                </div>
              )}

              {/* Line items */}
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Select items to return
                </p>

                {(order.items ?? []).length === 0 && (
                  <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                    No items found for this order.
                  </p>
                )}

                {(order.items ?? []).map((item) => {
                  const state = itemStates[item.id]
                  if (!state) return null
                  const productName =
                    item.product_title || item.title || "Unknown product"

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border p-4 flex flex-col gap-3 transition-colors"
                      style={{
                        borderColor: state.selected ? "var(--brand-teal)" : "var(--border-primary)",
                        background: state.selected ? "#F0FDFA" : "var(--bg-primary)",
                      }}
                    >
                      {/* Item header: checkbox + name */}
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={state.selected}
                          onChange={() => handleToggle(item.id)}
                          disabled={!withinWindow}
                          className="mt-0.5 w-4 h-4 rounded accent-teal-600 flex-shrink-0"
                          style={{ accentColor: "var(--brand-teal)" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium leading-snug"
                            style={{ color: "#111827" }}
                          >
                            {productName}
                          </p>
                          {item.variant_title &&
                            item.variant_title !== "Default Variant" && (
                              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                                {item.variant_title}
                              </p>
                            )}
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                            Qty ordered: {item.quantity}
                          </p>
                        </div>
                      </label>

                      {/* Expanded controls when selected */}
                      {state.selected && (
                        <div className="flex flex-col gap-3 pl-7">
                          {/* Return quantity */}
                          <div className="flex items-center gap-3">
                            <label
                              className="text-xs font-medium flex-shrink-0"
                              style={{ color: "#374151" }}
                            >
                              Qty to return
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={item.quantity}
                              value={state.returnQty}
                              onChange={(e) =>
                                handleQtyChange(
                                  item.id,
                                  parseInt(e.target.value, 10) || 1,
                                  item.quantity
                                )
                              }
                              className="w-16 rounded-lg border px-2 py-1 text-sm text-center focus:outline-none focus:ring-2"
                              style={{
                                borderColor: "#D1D5DB",
                                color: "#111827",
                                // @ts-ignore
                                "--tw-ring-color": "var(--brand-teal)",
                              }}
                            />
                          </div>

                          {/* Reason */}
                          <div className="flex flex-col gap-1.5">
                            <label
                              className="text-xs font-medium"
                              style={{ color: "#374151" }}
                            >
                              Reason
                            </label>
                            <select
                              value={state.reason}
                              onChange={(e) =>
                                handleReasonChange(
                                  item.id,
                                  e.target.value as ReturnReason
                                )
                              }
                              className="rounded-lg border px-3 py-2 text-sm bg-[var(--bg-secondary)] focus:outline-none focus:ring-2"
                              style={{
                                borderColor: "#D1D5DB",
                                color: "#111827",
                                // @ts-ignore
                                "--tw-ring-color": "var(--brand-teal)",
                              }}
                            >
                              {(
                                Object.entries(RETURN_REASON_LABELS) as [
                                  ReturnReason,
                                  string,
                                ][]
                              ).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="return-notes"
                  className="text-sm font-medium"
                  style={{ color: "#374151" }}
                >
                  Additional details{" "}
                  <span className="font-normal" style={{ color: "var(--text-tertiary)" }}>
                    (optional)
                  </span>
                </label>
                <textarea
                  id="return-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe the issue or provide any relevant context…"
                  disabled={!withinWindow}
                  className="rounded-xl border px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 disabled:opacity-50"
                  style={{
                    borderColor: "#D1D5DB",
                    color: "#111827",
                    // @ts-ignore
                    "--tw-ring-color": "var(--brand-teal)",
                  }}
                />
              </div>

              {/* Error message */}
              {mutation.isError && (
                <div
                  className="rounded-xl border px-4 py-3 text-sm"
                  style={{
                    background: "#FEF2F2",
                    borderColor: "#FECACA",
                    color: "#991B1B",
                  }}
                >
                  {(mutation.error as any)?.message ||
                    "Something went wrong. Please try again or contact support."}
                </div>
              )}

              {/* Footer actions */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleSubmit}
                  disabled={
                    selectedCount === 0 ||
                    mutation.isPending ||
                    !withinWindow
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "var(--brand-teal)" }}
                >
                  {mutation.isPending && <SpinnerIcon />}
                  {mutation.isPending
                    ? "Submitting…"
                    : `Submit Return Request${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
                </button>
                <button
                  onClick={handleClose}
                  disabled={mutation.isPending}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium border transition-all hover:bg-gray-50 disabled:opacity-50"
                  style={{ color: "var(--text-secondary)", borderColor: "#D1D5DB" }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReturnRequestForm
