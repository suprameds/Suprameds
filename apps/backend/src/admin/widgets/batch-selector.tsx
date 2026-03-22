import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge, Button, Input, toast } from "@medusajs/ui"
import { useEffect, useState, useCallback } from "react"

type Batch = {
  id: string
  lot_number: string
  expiry_date: string
  manufactured_on?: string
  received_quantity: number
  available_quantity: number
  reserved_quantity: number
  status: "active" | "quarantine" | "recalled" | "expired" | "depleted"
  batch_mrp_paise?: number
  purchase_price_paise?: number
  supplier_name?: string
  grn_number?: string
  received_on?: string
  product_variant_id: string
  product_id: string
  deductions?: Array<{
    id: string
    order_id: string
    order_line_item_id: string
    quantity: number
    deduction_type: string
  }>
}

const STATUS_COLORS: Record<string, "green" | "orange" | "red" | "grey" | "blue"> = {
  active: "green",
  quarantine: "orange",
  recalled: "red",
  expired: "grey",
  depleted: "grey",
}

const formatDate = (d?: string) => {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

const daysUntilExpiry = (d: string) => {
  const diff = new Date(d).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const formatINR = (paise?: number) => {
  if (!paise && paise !== 0) return "—"
  return `₹${(paise / 100).toFixed(2)}`
}

const BatchManagementWidget = ({ data }: { data: { id: string } }) => {
  const productId = data.id
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newBatch, setNewBatch] = useState({
    lot_number: "",
    expiry_date: "",
    manufactured_on: "",
    received_quantity: "",
    batch_mrp_inr: "",
    purchase_price_inr: "",
    supplier_name: "",
    grn_number: "",
  })

  const fetchBatches = useCallback(async () => {
    try {
      setLoading(true)
      const resp = await fetch(`/admin/pharma/batches?product_id=${productId}`, {
        credentials: "include",
      })
      const json = await resp.json()
      setBatches(json.batches ?? [])
    } catch {
      toast.error("Failed to load batches")
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => { fetchBatches() }, [fetchBatches])

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBatch.lot_number || !newBatch.expiry_date || !newBatch.received_quantity) {
      toast.error("Lot number, expiry date, and quantity are required")
      return
    }
    setSubmitting(true)
    try {
      // We need a variant_id — fetch the first variant of this product
      const prodResp = await fetch(`/admin/products/${productId}?fields=variants.*`, {
        credentials: "include",
      })
      const prodJson = await prodResp.json()
      const variantId = prodJson.product?.variants?.[0]?.id
      if (!variantId) {
        toast.error("No variant found for this product")
        return
      }

      const resp = await fetch("/admin/pharma/batches", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_variant_id: variantId,
          product_id: productId,
          lot_number: newBatch.lot_number,
          expiry_date: newBatch.expiry_date,
          manufactured_on: newBatch.manufactured_on || null,
          received_quantity: Number(newBatch.received_quantity),
          batch_mrp_paise: newBatch.batch_mrp_inr ? Number(newBatch.batch_mrp_inr) * 100 : null,
          purchase_price_paise: newBatch.purchase_price_inr ? Number(newBatch.purchase_price_inr) * 100 : null,
          supplier_name: newBatch.supplier_name || null,
          grn_number: newBatch.grn_number || null,
        }),
      })

      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.message || "Failed to create batch")
      }

      toast.success("Batch created successfully")
      setShowAddForm(false)
      setNewBatch({
        lot_number: "",
        expiry_date: "",
        manufactured_on: "",
        received_quantity: "",
        batch_mrp_inr: "",
        purchase_price_inr: "",
        supplier_name: "",
        grn_number: "",
      })
      fetchBatches()
    } catch (err: any) {
      toast.error(err?.message || "Failed to create batch")
    } finally {
      setSubmitting(false)
    }
  }

  const updateBatchStatus = async (batchId: string, status: string) => {
    try {
      const resp = await fetch(`/admin/pharma/batches/${batchId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!resp.ok) throw new Error("Update failed")
      toast.success(`Batch status → ${status}`)
      fetchBatches()
    } catch {
      toast.error("Failed to update batch status")
    }
  }

  const totalAvailable = batches
    .filter((b) => b.status === "active")
    .reduce((sum, b) => sum + b.available_quantity, 0)

  const nearingExpiry = batches.filter(
    (b) => b.status === "active" && daysUntilExpiry(b.expiry_date) <= 90 && daysUntilExpiry(b.expiry_date) > 0
  )

  return (
    <Container>
      <div className="flex items-center justify-between mb-4">
        <div>
          <Heading level="h2">Inventory Batches (FEFO)</Heading>
          <Text className="text-ui-fg-subtle">
            Total available: <strong>{totalAvailable}</strong> units across{" "}
            <strong>{batches.filter((b) => b.status === "active").length}</strong> active batches
          </Text>
        </div>
        <Button variant="secondary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? "Cancel" : "+ Add Batch"}
        </Button>
      </div>

      {nearingExpiry.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <Text className="text-amber-800 font-medium">
            ⚠ {nearingExpiry.length} batch(es) expiring within 90 days
          </Text>
          {nearingExpiry.map((b) => (
            <Text key={b.id} className="text-amber-700 text-sm">
              {b.lot_number}: expires {formatDate(b.expiry_date)} ({daysUntilExpiry(b.expiry_date)} days)
            </Text>
          ))}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleAddBatch} className="border rounded-lg p-4 mb-4 bg-ui-bg-subtle">
          <Heading level="h3" className="mb-3">
            New Batch (Stock Receipt / GRN)
          </Heading>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Lot Number *</label>
              <Input
                placeholder="LOT-2026-001"
                value={newBatch.lot_number}
                onChange={(e) => setNewBatch({ ...newBatch, lot_number: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Received Quantity *</label>
              <Input
                type="number"
                placeholder="100"
                value={newBatch.received_quantity}
                onChange={(e) => setNewBatch({ ...newBatch, received_quantity: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Expiry Date *</label>
              <Input
                type="date"
                value={newBatch.expiry_date}
                onChange={(e) => setNewBatch({ ...newBatch, expiry_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Manufactured On</label>
              <Input
                type="date"
                value={newBatch.manufactured_on}
                onChange={(e) => setNewBatch({ ...newBatch, manufactured_on: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Batch MRP (₹)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="120.00"
                value={newBatch.batch_mrp_inr}
                onChange={(e) => setNewBatch({ ...newBatch, batch_mrp_inr: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Purchase Price (₹)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="38.00"
                value={newBatch.purchase_price_inr}
                onChange={(e) => setNewBatch({ ...newBatch, purchase_price_inr: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Supplier</label>
              <Input
                placeholder="Cipla Ltd"
                value={newBatch.supplier_name}
                onChange={(e) => setNewBatch({ ...newBatch, supplier_name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">GRN Number</label>
              <Input
                placeholder="GRN-2026-001"
                value={newBatch.grn_number}
                onChange={(e) => setNewBatch({ ...newBatch, grn_number: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4">
            <Button type="submit" isLoading={submitting} disabled={submitting}>
              Create Batch
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <Text className="text-ui-fg-subtle">Loading batches…</Text>
      ) : batches.length === 0 ? (
        <div className="text-center py-6 text-ui-fg-muted">
          <Text>No batches recorded for this product yet.</Text>
          <Text className="text-sm mt-1">Click "+ Add Batch" to record a stock receipt.</Text>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-ui-fg-subtle">
                <th className="py-2 px-2">Lot Number</th>
                <th className="py-2 px-2">Status</th>
                <th className="py-2 px-2">Expiry</th>
                <th className="py-2 px-2 text-right">Available</th>
                <th className="py-2 px-2 text-right">Reserved</th>
                <th className="py-2 px-2 text-right">Received</th>
                <th className="py-2 px-2 text-right">MRP</th>
                <th className="py-2 px-2 text-right">Cost</th>
                <th className="py-2 px-2">Supplier</th>
                <th className="py-2 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => {
                const days = daysUntilExpiry(batch.expiry_date)
                const expiryWarning = days <= 0 ? "text-red-600 font-medium" : days <= 90 ? "text-amber-600" : ""

                return (
                  <tr key={batch.id} className="border-b hover:bg-ui-bg-subtle">
                    <td className="py-2 px-2 font-mono text-xs">{batch.lot_number}</td>
                    <td className="py-2 px-2">
                      <Badge color={STATUS_COLORS[batch.status] || "grey"}>
                        {batch.status}
                      </Badge>
                    </td>
                    <td className={`py-2 px-2 ${expiryWarning}`}>
                      {formatDate(batch.expiry_date)}
                      {days <= 0 && " (EXPIRED)"}
                      {days > 0 && days <= 90 && ` (${days}d)`}
                    </td>
                    <td className="py-2 px-2 text-right font-medium">{batch.available_quantity}</td>
                    <td className="py-2 px-2 text-right">{batch.reserved_quantity}</td>
                    <td className="py-2 px-2 text-right text-ui-fg-subtle">{batch.received_quantity}</td>
                    <td className="py-2 px-2 text-right">{formatINR(batch.batch_mrp_paise as any)}</td>
                    <td className="py-2 px-2 text-right">{formatINR(batch.purchase_price_paise as any)}</td>
                    <td className="py-2 px-2 text-ui-fg-subtle text-xs">{batch.supplier_name || "—"}</td>
                    <td className="py-2 px-2">
                      <div className="flex gap-1">
                        {batch.status === "active" && (
                          <>
                            <button
                              className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200"
                              onClick={() => updateBatchStatus(batch.id, "quarantine")}
                            >
                              Quarantine
                            </button>
                            <button
                              className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                              onClick={() => updateBatchStatus(batch.id, "recalled")}
                            >
                              Recall
                            </button>
                          </>
                        )}
                        {batch.status === "quarantine" && (
                          <button
                            className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200"
                            onClick={() => updateBatchStatus(batch.id, "active")}
                          >
                            Release
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {batches.length > 0 && (
        <div className="mt-4 p-3 bg-ui-bg-subtle rounded-lg">
          <Text className="text-xs text-ui-fg-subtle">
            FEFO: First Expiry First Out — batches with the earliest expiry date are allocated first during order fulfillment.
            Deductions are automatically linked to order line items for full traceability.
          </Text>
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default BatchManagementWidget
