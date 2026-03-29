import { defineWidgetConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Text,
  Badge,
  Button,
  Input,
  Label,
  toast,
} from "@medusajs/ui"
import { useEffect, useState, useCallback } from "react"

type BatchAllocation = {
  line_item_id: string
  product_title: string
  variant_id: string
  product_id: string
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

type NewBatchForm = {
  lot_number: string
  expiry_date: string
  quantity: string
  supplier_name: string
  batch_mrp: string
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
  const [allocating, setAllocating] = useState(false)
  const [addBatchItem, setAddBatchItem] = useState<string | null>(null)
  const [newBatch, setNewBatch] = useState<NewBatchForm>({
    lot_number: "",
    expiry_date: "",
    quantity: "",
    supplier_name: "",
    batch_mrp: "",
  })
  const [savingBatch, setSavingBatch] = useState(false)
  const [orderItems, setOrderItems] = useState<Array<{ id: string; title: string; variant_id: string; product_id: string; quantity: number }>>([])

  // Fetch order items for the "add batch" form in empty state
  const fetchOrderItems = useCallback(async () => {
    try {
      const resp = await fetch(
        `/admin/orders/${orderId}?fields=id,items.*`,
        { credentials: "include" }
      )
      if (resp.ok) {
        const json = await resp.json()
        setOrderItems(
          (json.order?.items ?? []).map((i: any) => ({
            id: i.id,
            title: i.title,
            variant_id: i.variant_id,
            product_id: i.product_id,
            quantity: i.quantity,
          }))
        )
      }
    } catch { /* best effort */ }
  }, [orderId])

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

  const handleAllocateNow = async () => {
    setAllocating(true)
    try {
      const resp = await fetch(
        `/admin/warehouse/pick-lists/${orderId}/allocate`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }
      )
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || "Allocation failed")
      }
      const result = await resp.json()
      if (result.fully_allocated) {
        toast.success(`All items allocated (${result.total_allocated} units)`)
      } else if (result.total_allocated > 0) {
        toast.success(`Partially allocated: ${result.total_allocated} units. Some items have insufficient stock.`)
      } else {
        toast.error("No batches available for allocation. Check inventory.")
      }
      fetchPickList()
    } catch (err: any) {
      toast.error(err?.message || "Failed to allocate batches")
    } finally {
      setAllocating(false)
    }
  }

  const handleAddBatch = async (item: BatchAllocation) => {
    if (!newBatch.lot_number || !newBatch.expiry_date || !newBatch.quantity) {
      toast.error("Lot number, expiry date, and quantity are required")
      return
    }

    const qty = Number(newBatch.quantity)
    if (qty <= 0 || isNaN(qty)) {
      toast.error("Quantity must be a positive number")
      return
    }

    setSavingBatch(true)
    try {
      // 1. Create the batch
      const batchResp = await fetch("/admin/pharma/batches", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_variant_id: item.variant_id,
          product_id: item.product_id,
          lot_number: newBatch.lot_number,
          expiry_date: newBatch.expiry_date,
          received_quantity: qty,
          supplier_name: newBatch.supplier_name || null,
          batch_mrp_paise: newBatch.batch_mrp
            ? Math.round(Number(newBatch.batch_mrp) * 100)
            : null,
          status: "active",
          _reason: `Created from order page for order ${orderId}`,
        }),
      })

      if (!batchResp.ok) {
        const err = await batchResp.json().catch(() => ({}))
        throw new Error(err.message || "Failed to create batch")
      }

      const { batch } = await batchResp.json()

      // 2. Allocate from this batch to the order line item
      const allocQty = Math.min(qty, item.quantity_unallocated || item.quantity_ordered)
      if (allocQty > 0) {
        const allocResp = await fetch(
          `/admin/warehouse/pick-lists/${orderId}/allocate`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          }
        )
        if (!allocResp.ok) {
          toast.success(`Batch ${newBatch.lot_number} created. Auto-allocation may have partial results.`)
        } else {
          const result = await allocResp.json()
          toast.success(
            `Batch ${newBatch.lot_number} created & ${result.total_allocated} unit(s) allocated`
          )
        }
      } else {
        toast.success(`Batch ${newBatch.lot_number} created (${qty} units in stock)`)
      }

      // Reset form
      setNewBatch({ lot_number: "", expiry_date: "", quantity: "", supplier_name: "", batch_mrp: "" })
      setAddBatchItem(null)
      fetchPickList()
    } catch (err: any) {
      toast.error(err?.message || "Failed to add batch")
    } finally {
      setSavingBatch(false)
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

  // Show empty state with manual allocation trigger + add batch
  if (!loading && !pickList.length) {
    return (
      <Container>
        <Heading level="h2" className="mb-2">
          Batch Allocation
        </Heading>
        <Text className="text-ui-fg-subtle text-sm mb-3">
          No batch allocations yet. You can trigger FEFO allocation or add a new batch manually.
        </Text>
        <div className="flex gap-2 mb-4">
          <Button
            variant="primary"
            size="small"
            isLoading={allocating}
            disabled={allocating}
            onClick={handleAllocateNow}
          >
            Allocate Now (FEFO)
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={() => {
              if (!orderItems.length) fetchOrderItems()
              setAddBatchItem(addBatchItem ? null : "__empty__")
            }}
          >
            {addBatchItem ? "Cancel" : "+ Add New Batch"}
          </Button>
        </div>

        {addBatchItem && orderItems.length > 0 && (
          <div className="border border-dashed border-ui-border-strong rounded-lg p-4">
            <Text className="text-xs font-semibold mb-3">
              Select item to add batch for:
            </Text>
            {orderItems.map((oi) => (
              <div key={oi.id} className="mb-4 border rounded p-3" style={{ background: "#FAFAFA" }}>
                <Text className="text-sm font-medium mb-2">{oi.title} (x{oi.quantity})</Text>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs" htmlFor={`lot_${oi.id}`}>Lot / Batch No. *</Label>
                    <Input
                      id={`lot_${oi.id}`}
                      size="small"
                      placeholder="e.g. BN2026-0401"
                      value={newBatch.lot_number}
                      onChange={(e) => setNewBatch({ ...newBatch, lot_number: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs" htmlFor={`exp_${oi.id}`}>Expiry Date *</Label>
                    <Input
                      id={`exp_${oi.id}`}
                      size="small"
                      type="date"
                      value={newBatch.expiry_date}
                      onChange={(e) => setNewBatch({ ...newBatch, expiry_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs" htmlFor={`qty_${oi.id}`}>Quantity *</Label>
                    <Input
                      id={`qty_${oi.id}`}
                      size="small"
                      type="number"
                      min="1"
                      placeholder="Units"
                      value={newBatch.quantity}
                      onChange={(e) => setNewBatch({ ...newBatch, quantity: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs" htmlFor={`mrp_${oi.id}`}>MRP (₹)</Label>
                    <Input
                      id={`mrp_${oi.id}`}
                      size="small"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 45.00"
                      value={newBatch.batch_mrp}
                      onChange={(e) => setNewBatch({ ...newBatch, batch_mrp: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs" htmlFor={`sup_${oi.id}`}>Supplier</Label>
                    <Input
                      id={`sup_${oi.id}`}
                      size="small"
                      placeholder="e.g. Cipla Ltd"
                      value={newBatch.supplier_name}
                      onChange={(e) => setNewBatch({ ...newBatch, supplier_name: e.target.value })}
                    />
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="small"
                  className="mt-3"
                  isLoading={savingBatch}
                  disabled={savingBatch}
                  onClick={() =>
                    handleAddBatch({
                      line_item_id: oi.id,
                      product_title: oi.title,
                      variant_id: oi.variant_id,
                      product_id: oi.product_id,
                      variant_sku: null,
                      quantity_ordered: oi.quantity,
                      quantity_unallocated: oi.quantity,
                      batches: [],
                    })
                  }
                >
                  Create Batch & Allocate
                </Button>
              </div>
            ))}
          </div>
        )}
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
        {!fullyAllocated && (
          <Button
            variant="secondary"
            size="small"
            isLoading={allocating}
            disabled={allocating}
            onClick={handleAllocateNow}
          >
            Allocate Remaining
          </Button>
        )}
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
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => {
                      if (addBatchItem === item.line_item_id) {
                        setAddBatchItem(null)
                      } else {
                        setAddBatchItem(item.line_item_id)
                        setOverrideItem(null)
                        setNewBatch({ lot_number: "", expiry_date: "", quantity: "", supplier_name: "", batch_mrp: "" })
                      }
                    }}
                  >
                    {addBatchItem === item.line_item_id ? "Cancel" : "+ Add Batch"}
                  </Button>
                  {item.batches.length > 0 && (
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => {
                        if (overrideItem === item.line_item_id) {
                          setOverrideItem(null)
                        } else {
                          setOverrideItem(item.line_item_id)
                          setAddBatchItem(null)
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
              {/* Add New Batch form */}
              {addBatchItem === item.line_item_id && (
                <div className="mt-3 border-t pt-3">
                  <Text className="text-xs font-semibold mb-3">
                    Add New Batch for {item.product_title}
                  </Text>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs" htmlFor="lot_number">Lot / Batch No. *</Label>
                      <Input
                        id="lot_number"
                        size="small"
                        placeholder="e.g. BN2026-0401"
                        value={newBatch.lot_number}
                        onChange={(e) => setNewBatch({ ...newBatch, lot_number: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs" htmlFor="expiry_date">Expiry Date *</Label>
                      <Input
                        id="expiry_date"
                        size="small"
                        type="date"
                        value={newBatch.expiry_date}
                        onChange={(e) => setNewBatch({ ...newBatch, expiry_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs" htmlFor="quantity">Quantity *</Label>
                      <Input
                        id="quantity"
                        size="small"
                        type="number"
                        min="1"
                        placeholder="Units received"
                        value={newBatch.quantity}
                        onChange={(e) => setNewBatch({ ...newBatch, quantity: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs" htmlFor="batch_mrp">MRP (₹)</Label>
                      <Input
                        id="batch_mrp"
                        size="small"
                        type="number"
                        step="0.01"
                        placeholder="e.g. 45.00"
                        value={newBatch.batch_mrp}
                        onChange={(e) => setNewBatch({ ...newBatch, batch_mrp: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs" htmlFor="supplier_name">Supplier</Label>
                      <Input
                        id="supplier_name"
                        size="small"
                        placeholder="e.g. Cipla Ltd"
                        value={newBatch.supplier_name}
                        onChange={(e) => setNewBatch({ ...newBatch, supplier_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="primary"
                      size="small"
                      isLoading={savingBatch}
                      disabled={savingBatch}
                      onClick={() => handleAddBatch(item)}
                    >
                      Create Batch & Allocate
                    </Button>
                    <Button
                      variant="secondary"
                      size="small"
                      disabled={savingBatch}
                      onClick={() => setAddBatchItem(null)}
                    >
                      Cancel
                    </Button>
                  </div>
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
