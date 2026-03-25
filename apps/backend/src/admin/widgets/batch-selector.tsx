import { defineWidgetConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Text,
  Badge,
  Button,
  Input,
  toast,
} from "@medusajs/ui"
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
}

type AuditEntry = {
  id: string
  action: string
  field_name?: string
  old_value?: string
  new_value?: string
  actor_id?: string
  actor_type: string
  order_id?: string
  reason?: string
  created_at: string
}

const STATUS_COLORS: Record<
  string,
  "green" | "orange" | "red" | "grey" | "blue"
> = {
  active: "green",
  quarantine: "orange",
  recalled: "red",
  expired: "grey",
  depleted: "grey",
}

const formatDate = (d?: string) => {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const formatDateInput = (d?: string) => {
  if (!d) return ""
  return new Date(d).toISOString().slice(0, 10)
}

const daysUntilExpiry = (d: string) => {
  const diff = new Date(d).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const formatINR = (paise?: number) => {
  if (!paise && paise !== 0) return "—"
  return `₹${(Number(paise) / 100).toFixed(2)}`
}

// ─── Inline Edit Form ────────────────────────────────────────────────

const BatchEditForm = ({
  batch,
  onSave,
  onCancel,
}: {
  batch: Batch
  onSave: () => void
  onCancel: () => void
}) => {
  const [form, setForm] = useState({
    lot_number: batch.lot_number,
    expiry_date: formatDateInput(batch.expiry_date),
    manufactured_on: formatDateInput(batch.manufactured_on),
    available_quantity: String(batch.available_quantity),
    received_quantity: String(batch.received_quantity),
    batch_mrp_inr: batch.batch_mrp_paise
      ? String(Number(batch.batch_mrp_paise) / 100)
      : "",
    purchase_price_inr: batch.purchase_price_paise
      ? String(Number(batch.purchase_price_paise) / 100)
      : "",
    supplier_name: batch.supplier_name || "",
    grn_number: batch.grn_number || "",
    status: batch.status,
  })
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: Record<string, any> = { _reason: reason || undefined }

      if (form.lot_number !== batch.lot_number)
        payload.lot_number = form.lot_number
      if (form.expiry_date !== formatDateInput(batch.expiry_date))
        payload.expiry_date = form.expiry_date
      if (form.manufactured_on !== formatDateInput(batch.manufactured_on))
        payload.manufactured_on = form.manufactured_on || null
      if (Number(form.available_quantity) !== batch.available_quantity)
        payload.available_quantity = Number(form.available_quantity)
      if (Number(form.received_quantity) !== batch.received_quantity)
        payload.received_quantity = Number(form.received_quantity)
      if (form.status !== batch.status) payload.status = form.status
      if (form.supplier_name !== (batch.supplier_name || ""))
        payload.supplier_name = form.supplier_name || null
      if (form.grn_number !== (batch.grn_number || ""))
        payload.grn_number = form.grn_number || null

      const newMrpPaise = form.batch_mrp_inr
        ? Number(form.batch_mrp_inr) * 100
        : null
      const oldMrpPaise = batch.batch_mrp_paise
        ? Number(batch.batch_mrp_paise)
        : null
      if (newMrpPaise !== oldMrpPaise) payload.batch_mrp_paise = newMrpPaise

      const newCostPaise = form.purchase_price_inr
        ? Number(form.purchase_price_inr) * 100
        : null
      const oldCostPaise = batch.purchase_price_paise
        ? Number(batch.purchase_price_paise)
        : null
      if (newCostPaise !== oldCostPaise)
        payload.purchase_price_paise = newCostPaise

      // Only send if something actually changed
      const changedKeys = Object.keys(payload).filter(
        (k) => !k.startsWith("_")
      )
      if (!changedKeys.length) {
        toast.info("No changes detected")
        onCancel()
        return
      }

      const resp = await fetch(`/admin/pharma/batches/${batch.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.message || "Update failed")
      }

      const result = await resp.json()
      toast.success(
        `Batch updated — ${result.changes_logged} change(s) logged`
      )
      onSave()
    } catch (err: any) {
      toast.error(err?.message || "Failed to update batch")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border rounded-lg p-4 mb-2 bg-ui-bg-subtle">
      <div className="flex items-center justify-between mb-3">
        <Heading level="h3">
          Edit Batch: {batch.lot_number}
        </Heading>
        <Badge color={STATUS_COLORS[batch.status] || "grey"}>
          {batch.status}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-ui-fg-subtle">
            Lot Number
          </label>
          <Input
            size="small"
            value={form.lot_number}
            onChange={(e) => setForm({ ...form, lot_number: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ui-fg-subtle">
            Expiry Date
          </label>
          <Input
            size="small"
            type="date"
            value={form.expiry_date}
            onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ui-fg-subtle">
            Manufactured On
          </label>
          <Input
            size="small"
            type="date"
            value={form.manufactured_on}
            onChange={(e) =>
              setForm({ ...form, manufactured_on: e.target.value })
            }
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ui-fg-subtle">
            Available Qty
          </label>
          <Input
            size="small"
            type="number"
            value={form.available_quantity}
            onChange={(e) =>
              setForm({ ...form, available_quantity: e.target.value })
            }
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ui-fg-subtle">
            Received Qty
          </label>
          <Input
            size="small"
            type="number"
            value={form.received_quantity}
            onChange={(e) =>
              setForm({ ...form, received_quantity: e.target.value })
            }
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ui-fg-subtle">
            Status
          </label>
          <select
            className="w-full rounded-md border border-ui-border-base bg-ui-bg-field px-2 py-1.5 text-sm"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as any })}
          >
            <option value="active">Active</option>
            <option value="quarantine">Quarantine</option>
            <option value="recalled">Recalled</option>
            <option value="expired">Expired</option>
            <option value="depleted">Depleted</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-ui-fg-subtle">
            MRP (₹)
          </label>
          <Input
            size="small"
            type="number"
            step="0.01"
            value={form.batch_mrp_inr}
            onChange={(e) =>
              setForm({ ...form, batch_mrp_inr: e.target.value })
            }
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ui-fg-subtle">
            Purchase Price (₹)
          </label>
          <Input
            size="small"
            type="number"
            step="0.01"
            value={form.purchase_price_inr}
            onChange={(e) =>
              setForm({ ...form, purchase_price_inr: e.target.value })
            }
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ui-fg-subtle">
            Supplier
          </label>
          <Input
            size="small"
            value={form.supplier_name}
            onChange={(e) =>
              setForm({ ...form, supplier_name: e.target.value })
            }
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ui-fg-subtle">
            GRN Number
          </label>
          <Input
            size="small"
            value={form.grn_number}
            onChange={(e) => setForm({ ...form, grn_number: e.target.value })}
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-ui-fg-subtle">
            Reason for change (audit trail)
          </label>
          <Input
            size="small"
            placeholder="e.g. Corrected MRP from supplier invoice"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <Button
          size="small"
          onClick={handleSave}
          isLoading={saving}
          disabled={saving}
        >
          Save Changes
        </Button>
        <Button size="small" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ─── Audit Log Viewer ────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  created: "Created",
  qty_adjusted: "Qty Adjusted",
  status_changed: "Status Changed",
  field_edited: "Field Edited",
  deduction_sale: "Sale Deduction",
  deduction_reversed: "Deduction Reversed",
  deduction_return: "Return Deduction",
  fulfillment_override: "Fulfillment Override",
}

const AuditLogPanel = ({ batchId }: { batchId: string }) => {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await fetch(`/admin/pharma/batches/${batchId}`, {
          credentials: "include",
        })
        const json = await resp.json()
        setLogs(json.audit_log ?? [])
      } catch {
        // Audit log may not be available
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [batchId])

  if (loading) return <Text className="text-xs text-ui-fg-subtle">Loading audit log…</Text>
  if (!logs.length) return <Text className="text-xs text-ui-fg-muted">No audit history yet.</Text>

  return (
    <div className="mt-2 max-h-48 overflow-y-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-left text-ui-fg-subtle">
            <th className="py-1 px-1">When</th>
            <th className="py-1 px-1">Action</th>
            <th className="py-1 px-1">Field</th>
            <th className="py-1 px-1">Old</th>
            <th className="py-1 px-1">New</th>
            <th className="py-1 px-1">By</th>
            <th className="py-1 px-1">Reason</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b">
              <td className="py-1 px-1 text-ui-fg-subtle whitespace-nowrap">
                {new Date(log.created_at).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td className="py-1 px-1">
                <Badge
                  color={
                    log.action.includes("deduction")
                      ? "red"
                      : log.action === "created"
                        ? "green"
                        : "orange"
                  }
                  className="text-[10px]"
                >
                  {ACTION_LABELS[log.action] || log.action}
                </Badge>
              </td>
              <td className="py-1 px-1 font-mono">{log.field_name || "—"}</td>
              <td className="py-1 px-1 text-ui-fg-subtle">
                {log.old_value || "—"}
              </td>
              <td className="py-1 px-1 font-medium">
                {log.new_value || "—"}
              </td>
              <td className="py-1 px-1 text-ui-fg-subtle">
                {log.actor_type === "admin"
                  ? "Admin"
                  : log.actor_type === "job"
                    ? "System Job"
                    : log.actor_type === "workflow"
                      ? "Workflow"
                      : "System"}
              </td>
              <td className="py-1 px-1 text-ui-fg-subtle max-w-[120px] truncate">
                {log.reason || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Widget ─────────────────────────────────────────────────────

const BatchManagementWidget = ({ data }: { data: { id: string } }) => {
  const productId = data.id
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null)
  const [auditBatchId, setAuditBatchId] = useState<string | null>(null)
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
      const resp = await fetch(
        `/admin/pharma/batches?product_id=${productId}`,
        { credentials: "include" }
      )
      const json = await resp.json()
      setBatches(json.batches ?? [])
    } catch {
      toast.error("Failed to load batches")
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    fetchBatches()
  }, [fetchBatches])

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !newBatch.lot_number ||
      !newBatch.expiry_date ||
      !newBatch.received_quantity
    ) {
      toast.error("Lot number, expiry date, and quantity are required")
      return
    }
    setSubmitting(true)
    try {
      const prodResp = await fetch(
        `/admin/products/${productId}?fields=variants.*`,
        { credentials: "include" }
      )
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
          batch_mrp_paise: newBatch.batch_mrp_inr
            ? Number(newBatch.batch_mrp_inr) * 100
            : null,
          purchase_price_paise: newBatch.purchase_price_inr
            ? Number(newBatch.purchase_price_inr) * 100
            : null,
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

  const totalAvailable = batches
    .filter((b) => b.status === "active")
    .reduce((sum, b) => sum + b.available_quantity, 0)

  const nearingExpiry = batches.filter(
    (b) =>
      b.status === "active" &&
      daysUntilExpiry(b.expiry_date) <= 90 &&
      daysUntilExpiry(b.expiry_date) > 0
  )

  return (
    <Container>
      <div className="flex items-center justify-between mb-4">
        <div>
          <Heading level="h2">Inventory Batches (FEFO)</Heading>
          <Text className="text-ui-fg-subtle">
            Total available: <strong>{totalAvailable}</strong> units across{" "}
            <strong>
              {batches.filter((b) => b.status === "active").length}
            </strong>{" "}
            active batches
          </Text>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setShowAddForm(!showAddForm)
            setEditingBatchId(null)
          }}
        >
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
              {b.lot_number}: expires {formatDate(b.expiry_date)} (
              {daysUntilExpiry(b.expiry_date)} days)
            </Text>
          ))}
        </div>
      )}

      {showAddForm && (
        <form
          onSubmit={handleAddBatch}
          className="border rounded-lg p-4 mb-4 bg-ui-bg-subtle"
        >
          <Heading level="h3" className="mb-3">
            New Batch (Stock Receipt / GRN)
          </Heading>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Lot Number *</label>
              <Input
                placeholder="LOT-2026-001"
                value={newBatch.lot_number}
                onChange={(e) =>
                  setNewBatch({ ...newBatch, lot_number: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Received Quantity *</label>
              <Input
                type="number"
                placeholder="100"
                value={newBatch.received_quantity}
                onChange={(e) =>
                  setNewBatch({
                    ...newBatch,
                    received_quantity: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Expiry Date *</label>
              <Input
                type="date"
                value={newBatch.expiry_date}
                onChange={(e) =>
                  setNewBatch({ ...newBatch, expiry_date: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Manufactured On</label>
              <Input
                type="date"
                value={newBatch.manufactured_on}
                onChange={(e) =>
                  setNewBatch({ ...newBatch, manufactured_on: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Batch MRP (₹)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="120.00"
                value={newBatch.batch_mrp_inr}
                onChange={(e) =>
                  setNewBatch({ ...newBatch, batch_mrp_inr: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Purchase Price (₹)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="38.00"
                value={newBatch.purchase_price_inr}
                onChange={(e) =>
                  setNewBatch({
                    ...newBatch,
                    purchase_price_inr: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Supplier</label>
              <Input
                placeholder="Cipla Ltd"
                value={newBatch.supplier_name}
                onChange={(e) =>
                  setNewBatch({ ...newBatch, supplier_name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">GRN Number</label>
              <Input
                placeholder="GRN-2026-001"
                value={newBatch.grn_number}
                onChange={(e) =>
                  setNewBatch({ ...newBatch, grn_number: e.target.value })
                }
              />
            </div>
          </div>
          <div className="mt-4">
            <Button
              type="submit"
              isLoading={submitting}
              disabled={submitting}
            >
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
          <Text className="text-sm mt-1">
            Click "+ Add Batch" to record a stock receipt.
          </Text>
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
                const expiryWarning =
                  days <= 0
                    ? "text-red-600 font-medium"
                    : days <= 90
                      ? "text-amber-600"
                      : ""
                const isEditing = editingBatchId === batch.id
                const isShowingAudit = auditBatchId === batch.id

                return (
                  <tr key={batch.id} className="border-b group">
                    <td colSpan={isEditing || isShowingAudit ? 10 : undefined} className={isEditing || isShowingAudit ? "py-2 px-2" : undefined}>
                      {isEditing ? (
                        <BatchEditForm
                          batch={batch}
                          onSave={() => {
                            setEditingBatchId(null)
                            fetchBatches()
                          }}
                          onCancel={() => setEditingBatchId(null)}
                        />
                      ) : isShowingAudit ? (
                        <div className="py-2">
                          <div className="flex items-center justify-between mb-2">
                            <Text className="text-xs font-semibold">
                              Audit Log — {batch.lot_number}
                            </Text>
                            <button
                              className="text-xs text-ui-fg-subtle hover:text-ui-fg-base"
                              onClick={() => setAuditBatchId(null)}
                            >
                              Close
                            </button>
                          </div>
                          <AuditLogPanel batchId={batch.id} />
                        </div>
                      ) : null}
                    </td>
                    {!isEditing && !isShowingAudit && (
                      <>
                        <td className="py-2 px-2 font-mono text-xs">
                          {batch.lot_number}
                        </td>
                        <td className="py-2 px-2">
                          <Badge
                            color={STATUS_COLORS[batch.status] || "grey"}
                          >
                            {batch.status}
                          </Badge>
                        </td>
                        <td className={`py-2 px-2 ${expiryWarning}`}>
                          {formatDate(batch.expiry_date)}
                          {days <= 0 && " (EXPIRED)"}
                          {days > 0 && days <= 90 && ` (${days}d)`}
                        </td>
                        <td className="py-2 px-2 text-right font-medium">
                          {batch.available_quantity}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {batch.reserved_quantity}
                        </td>
                        <td className="py-2 px-2 text-right text-ui-fg-subtle">
                          {batch.received_quantity}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {formatINR(batch.batch_mrp_paise as any)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {formatINR(batch.purchase_price_paise as any)}
                        </td>
                        <td className="py-2 px-2 text-ui-fg-subtle text-xs">
                          {batch.supplier_name || "—"}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex gap-1">
                            <button
                              className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
                              onClick={() => {
                                setEditingBatchId(batch.id)
                                setAuditBatchId(null)
                                setShowAddForm(false)
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-600 hover:bg-gray-100"
                              onClick={() => {
                                setAuditBatchId(
                                  auditBatchId === batch.id ? null : batch.id
                                )
                                setEditingBatchId(null)
                              }}
                            >
                              Log
                            </button>
                          </div>
                        </td>
                      </>
                    )}
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
            FEFO: First Expiry First Out — batches with the earliest expiry date
            are allocated first during order fulfillment. All changes are tracked
            in the audit log for CDSCO compliance.
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
