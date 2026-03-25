import { defineWidgetConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Text,
  Badge,
  Button,
  toast,
} from "@medusajs/ui"
import { useEffect, useState, useCallback } from "react"

type BatchAllocation = {
  line_item_id: string
  product_title: string
  variant_id: string
  variant_sku: string | null
  quantity_ordered: number
  quantity_unallocated: number
  batches: Array<{
    deduction_id: string
    batch_id: string
    lot_number: string
    expiry_date: string | null
    quantity_allocated: number
    available_after_pick: number | null
    supplier: string | null
  }>
}

type AvailableBatch = {
  id: string
  lot_number: string
  expiry_date: string
  available_quantity: number
  reserved_quantity: number
  batch_mrp_paise?: number
  status: string
  supplier_name?: string
}

const formatDate = (d?: string | null) => {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const daysUntilExpiry = (d: string) => {
  const diff = new Date(d).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/**
 * Order-level batch allocation viewer + override widget.
 * Appears on the order detail page in the admin panel.
 *
 * Shows:
 * - Current FEFO allocation per line item (from BatchDeduction records)
 * - Available batches for each variant with ability to swap/override
 * - All overrides are logged to BatchAuditLog for traceability
 */
const BatchFulfillmentOverride = ({ data }: { data: { id: string } }) => {
  const orderId = data.id
  const [pickList, setPickList] = useState<BatchAllocation[]>([])
  const [loading, setLoading] = useState(true)
  const [fullyAllocated, setFullyAllocated] = useState(false)
  const [overrideItem, setOverrideItem] = useState<string | null>(null)
  const [availableBatches, setAvailableBatches] = useState<AvailableBatch[]>(
    []
  )
  const [loadingBatches, setLoadingBatches] = useState(false)

  const fetchPickList = useCallback(async () => {
    try {
      setLoading(true)
      const resp = await fetch(
        `/admin/warehouse/pick-lists/${orderId}`,
        { credentials: "include" }
      )
      if (!resp.ok) {
        if (resp.status === 404) {
          setPickList([])
          return
        }
        throw new Error("Failed to load")
      }
      const json = await resp.json()
      setPickList(json.items ?? [])
      setFullyAllocated(json.fully_allocated ?? false)
    } catch {
      // Quietly fail — may not have allocations yet
      setPickList([])
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    fetchPickList()
  }, [fetchPickList])

  const loadAvailableBatches = async (variantId: string) => {
    setLoadingBatches(true)
    try {
      const resp = await fetch(
        `/admin/pharma/batches?variant_id=${variantId}&status=active`,
        { credentials: "include" }
      )
      const json = await resp.json()
      setAvailableBatches(json.batches ?? [])
    } catch {
      toast.error("Failed to load available batches")
    } finally {
      setLoadingBatches(false)
    }
  }

  const handleOverride = async (
    lineItemId: string,
    oldDeductionId: string,
    oldBatchId: string,
    newBatchId: string,
    quantity: number
  ) => {
    try {
      // 1. Reverse the old deduction (restore stock to old batch)
      await fetch(`/admin/pharma/batches/${oldBatchId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _reason: `Fulfillment override: replaced by batch ${newBatchId}`,
          _order_id: orderId,
        }),
      })

      // 2. Call dedicated override endpoint
      const resp = await fetch(
        `/admin/warehouse/pick-lists/${orderId}/override`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            line_item_id: lineItemId,
            old_deduction_id: oldDeductionId,
            new_batch_id: newBatchId,
            quantity,
          }),
        }
      )

      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.error || "Override failed")
      }

      toast.success("Batch allocation overridden — audit logged")
      setOverrideItem(null)
      fetchPickList()
    } catch (err: any) {
      toast.error(err?.message || "Failed to override batch")
    }
  }

  // Don't render if no items and not loading
  if (!loading && !pickList.length) {
    return (
      <Container>
        <Heading level="h2" className="mb-2">
          Batch Allocation
        </Heading>
        <Text className="text-ui-fg-subtle text-sm">
          No batch allocations yet. Allocations are created automatically when
          payment is captured (auto-allocate job) or during fulfillment (FEFO
          hook).
        </Text>
      </Container>
    )
  }

  return (
    <Container>
      <div className="flex items-center justify-between mb-3">
        <div>
          <Heading level="h2">Batch Allocation</Heading>
          <Text className="text-ui-fg-subtle text-xs">
            {fullyAllocated ? (
              <span className="text-green-600 font-medium">
                ✓ All items fully allocated
              </span>
            ) : (
              <span className="text-amber-600 font-medium">
                ⚠ Some items are not yet allocated
              </span>
            )}
          </Text>
        </div>
      </div>

      {loading ? (
        <Text className="text-ui-fg-subtle">Loading allocations…</Text>
      ) : (
        <div className="flex flex-col gap-3">
          {pickList.map((item) => (
            <div
              key={item.line_item_id}
              className="border rounded-lg p-3"
              style={{ background: "#FAFAFA" }}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <Text className="font-medium text-sm">
                    {item.product_title}
                  </Text>
                  <Text className="text-xs text-ui-fg-subtle">
                    {item.variant_sku && `SKU: ${item.variant_sku} · `}
                    Ordered: {item.quantity_ordered}
                    {item.quantity_unallocated > 0 && (
                      <span className="text-amber-600 ml-2">
                        ({item.quantity_unallocated} unallocated)
                      </span>
                    )}
                  </Text>
                </div>
                {item.batches.length > 0 && (
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => {
                      if (overrideItem === item.line_item_id) {
                        setOverrideItem(null)
                      } else {
                        setOverrideItem(item.line_item_id)
                        loadAvailableBatches(item.variant_id)
                      }
                    }}
                  >
                    {overrideItem === item.line_item_id
                      ? "Cancel Override"
                      : "Override Batch"}
                  </Button>
                )}
              </div>

              {/* Current allocations */}
              {item.batches.length > 0 ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-ui-fg-subtle border-b">
                      <th className="py-1 px-1">Lot</th>
                      <th className="py-1 px-1">Expiry</th>
                      <th className="py-1 px-1 text-right">Qty Picked</th>
                      <th className="py-1 px-1 text-right">Remaining</th>
                      <th className="py-1 px-1">Supplier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.batches.map((b) => {
                      const days = b.expiry_date
                        ? daysUntilExpiry(b.expiry_date)
                        : null
                      return (
                        <tr key={b.deduction_id} className="border-b">
                          <td className="py-1 px-1 font-mono">
                            {b.lot_number}
                          </td>
                          <td
                            className={`py-1 px-1 ${days !== null && days <= 90 ? "text-amber-600" : ""} ${days !== null && days <= 0 ? "text-red-600 font-medium" : ""}`}
                          >
                            {formatDate(b.expiry_date)}
                            {days !== null && days <= 90 && days > 0
                              ? ` (${days}d)`
                              : ""}
                            {days !== null && days <= 0 ? " EXPIRED" : ""}
                          </td>
                          <td className="py-1 px-1 text-right font-medium">
                            {b.quantity_allocated}
                          </td>
                          <td className="py-1 px-1 text-right text-ui-fg-subtle">
                            {b.available_after_pick ?? "—"}
                          </td>
                          <td className="py-1 px-1 text-ui-fg-subtle">
                            {b.supplier || "—"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <Text className="text-xs text-ui-fg-muted">
                  No batches allocated yet for this item.
                </Text>
              )}

              {/* Override panel */}
              {overrideItem === item.line_item_id && (
                <div className="mt-3 border-t pt-3">
                  <Text className="text-xs font-semibold mb-2">
                    Available Batches — Select replacement
                  </Text>
                  {loadingBatches ? (
                    <Text className="text-xs text-ui-fg-subtle">
                      Loading…
                    </Text>
                  ) : !availableBatches.length ? (
                    <Text className="text-xs text-ui-fg-muted">
                      No active batches available for this variant.
                    </Text>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-ui-fg-subtle border-b">
                          <th className="py-1 px-1">Lot</th>
                          <th className="py-1 px-1">Expiry</th>
                          <th className="py-1 px-1 text-right">Available</th>
                          <th className="py-1 px-1 text-right">MRP</th>
                          <th className="py-1 px-1">Supplier</th>
                          <th className="py-1 px-1"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {availableBatches.map((ab) => {
                          const effectiveAvail =
                            ab.available_quantity - (ab.reserved_quantity || 0)
                          const isCurrentlyUsed = item.batches.some(
                            (b) => b.batch_id === ab.id
                          )
                          const days = daysUntilExpiry(ab.expiry_date)

                          return (
                            <tr
                              key={ab.id}
                              className={`border-b ${isCurrentlyUsed ? "bg-green-50" : ""}`}
                            >
                              <td className="py-1 px-1 font-mono">
                                {ab.lot_number}
                                {isCurrentlyUsed && (
                                  <Badge
                                    color="green"
                                    className="ml-1 text-[9px]"
                                  >
                                    current
                                  </Badge>
                                )}
                              </td>
                              <td
                                className={`py-1 px-1 ${days <= 90 ? "text-amber-600" : ""} ${days <= 0 ? "text-red-600" : ""}`}
                              >
                                {formatDate(ab.expiry_date)}
                                {days <= 90 && days > 0
                                  ? ` (${days}d)`
                                  : ""}
                              </td>
                              <td className="py-1 px-1 text-right">
                                {effectiveAvail}
                              </td>
                              <td className="py-1 px-1 text-right">
                                {ab.batch_mrp_paise
                                  ? `₹${(Number(ab.batch_mrp_paise) / 100).toFixed(2)}`
                                  : "—"}
                              </td>
                              <td className="py-1 px-1 text-ui-fg-subtle">
                                {ab.supplier_name || "—"}
                              </td>
                              <td className="py-1 px-1">
                                {!isCurrentlyUsed &&
                                  effectiveAvail > 0 &&
                                  days > 0 && (
                                    <button
                                      className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
                                      onClick={() => {
                                        const currentAlloc = item.batches[0]
                                        if (!currentAlloc) return
                                        handleOverride(
                                          item.line_item_id,
                                          currentAlloc.deduction_id,
                                          currentAlloc.batch_id,
                                          ab.id,
                                          currentAlloc.quantity_allocated
                                        )
                                      }}
                                    >
                                      Use This
                                    </button>
                                  )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 p-2 bg-ui-bg-subtle rounded">
        <Text className="text-[10px] text-ui-fg-subtle">
          Overriding a batch allocation will reverse the current deduction,
          restore stock to the original batch, allocate from the new batch,
          and log the change to the audit trail for CDSCO compliance.
        </Text>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default BatchFulfillmentOverride
