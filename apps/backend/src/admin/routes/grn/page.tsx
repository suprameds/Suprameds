import {
  Badge, Button, Container, Drawer, Heading, Input,
  Label, Select, Table, Text, Textarea, toast,
} from "@medusajs/ui"
import { ArrowPath, CheckCircleSolid, PlusMini, XMark } from "@medusajs/icons"
import { useCallback, useEffect, useState } from "react"
import { sdk } from "../../lib/client"

/* ================================================================
   TYPES
   ================================================================ */

type GrnItem = {
  product_id: string
  variant_id: string
  product_name: string
  batch_number: string
  expiry_date: string
  quantity: number
  qc_status?: "pass" | "fail" | "pending"
  rejection_reason?: string
}

type GrnRecord = {
  id: string
  grn_number: string
  supplier_id: string
  supplier_invoice_no: string
  received_by: string
  qc_approved_by: string | null
  received_at: string
  qc_approved_at: string | null
  items: GrnItem[]
  status: "pending_qc" | "approved" | "partially_rejected" | "rejected"
  created_at?: string
}

type LineItemForm = {
  key: string
  product_id: string
  variant_id: string
  product_name: string
  batch_number: string
  expiry_date: string
  quantity: number
}

/* ================================================================
   HELPERS
   ================================================================ */

const fmtDate = (d?: string | null) => {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  })
}

const fmtDateTime = (d?: string | null) => {
  if (!d) return "—"
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

const cap = (s: string) =>
  s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")

const grnStatusColor = (s: string): "green" | "blue" | "orange" | "red" | "grey" => {
  const map: Record<string, "green" | "blue" | "orange" | "red" | "grey"> = {
    pending_qc: "orange",
    approved: "green",
    partially_rejected: "blue",
    rejected: "red",
  }
  return map[s] || "grey"
}

const genGrnNumber = () =>
  `GRN-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0")}`

const createEmptyLine = (): LineItemForm => ({
  key: crypto.randomUUID(),
  product_id: "",
  variant_id: "",
  product_name: "",
  batch_number: "",
  expiry_date: "",
  quantity: 0,
})

/* ================================================================
   MAIN PAGE
   ================================================================ */

const GrnPage = () => {
  const [records, setRecords] = useState<GrnRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")

  // Detail drawer
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRecord, setDetailRecord] = useState<GrnRecord | null>(null)

  // Create drawer
  const [createOpen, setCreateOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [grnNumber, setGrnNumber] = useState(genGrnNumber())
  const [supplierId, setSupplierId] = useState("")
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("")
  const [receivedBy, setReceivedBy] = useState("")
  const [notes, setNotes] = useState("")
  const [formLines, setFormLines] = useState<LineItemForm[]>([createEmptyLine()])

  // Action states
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [showRejectInput, setShowRejectInput] = useState(false)

  /* ── Fetch list ───────────────────────────────────────────────── */

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const query: Record<string, string> = {}
      if (statusFilter !== "all") query.status = statusFilter
      const json = await sdk.client.fetch<{ grn_records: GrnRecord[] }>(
        "/admin/warehouse/grn",
        { query }
      )
      setRecords(json.grn_records ?? [])
    } catch (err: any) {
      console.error("[grn-list]", err)
      toast.error("Failed to load GRN records", { description: err.message })
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  /* ── Open detail ──────────────────────────────────────────────── */

  const openDetail = (record: GrnRecord) => {
    setDetailRecord(record)
    setDetailOpen(true)
    setShowRejectInput(false)
    setRejectReason("")
  }

  /* ── Status actions ───────────────────────────────────────────── */

  const handleStatusAction = async (
    grnId: string,
    action: "inspect" | "approve" | "reject",
    reason?: string,
  ) => {
    setActionLoading(true)
    try {
      const body: Record<string, unknown> = { action }
      if (action === "inspect") {
        body.status = "pending_qc"
        body.inspected_at = new Date().toISOString()
      } else if (action === "approve") {
        body.status = "approved"
        body.qc_approved_at = new Date().toISOString()
      } else if (action === "reject") {
        body.status = reason ? "partially_rejected" : "rejected"
        body.rejection_reason = reason || "Quality check failed"
      }

      await sdk.client.fetch<{ success: boolean }>("/admin/warehouse/grn", {
        method: "POST",
        body: { grn_id: grnId, ...body },
      })

      const actionLabels = { inspect: "inspected", approve: "approved", reject: "rejected" }
      toast.success(`GRN ${actionLabels[action]} successfully`)

      // Update local state optimistically
      setRecords((prev) =>
        prev.map((r) => r.id === grnId ? { ...r, status: body.status as GrnRecord["status"] } : r)
      )
      if (detailRecord?.id === grnId) {
        setDetailRecord({ ...detailRecord, status: body.status as GrnRecord["status"] })
      }
      setShowRejectInput(false)
      setRejectReason("")
      fetchRecords()
    } catch (err: any) {
      toast.error(`Failed to ${action} GRN`, { description: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  /* ── Create form helpers ──────────────────────────────────────── */

  const updateLine = (key: string, updates: Partial<LineItemForm>) =>
    setFormLines((prev) => prev.map((l) => l.key === key ? { ...l, ...updates } : l))

  const removeLine = (key: string) =>
    setFormLines((prev) => {
      const filtered = prev.filter((l) => l.key !== key)
      return filtered.length ? filtered : [createEmptyLine()]
    })

  const resetForm = () => {
    setGrnNumber(genGrnNumber())
    setSupplierId("")
    setSupplierInvoiceNo("")
    setReceivedBy("")
    setNotes("")
    setFormLines([createEmptyLine()])
  }

  const handleCreate = async () => {
    if (!grnNumber.trim()) { toast.error("GRN Number is required"); return }
    if (!supplierId.trim()) { toast.error("Supplier is required"); return }
    if (!supplierInvoiceNo.trim()) { toast.error("Supplier Invoice No. is required"); return }
    if (!receivedBy.trim()) { toast.error("Received By is required"); return }

    const validLines = formLines.filter((l) => l.product_name.trim())
    if (!validLines.length) { toast.error("Add at least one item"); return }

    for (const line of validLines) {
      if (!line.batch_number.trim()) {
        toast.error(`Batch number required for "${line.product_name}"`)
        return
      }
      if (!line.expiry_date) {
        toast.error(`Expiry date required for "${line.product_name}"`)
        return
      }
      if (line.quantity <= 0) {
        toast.error(`Quantity must be > 0 for "${line.product_name}"`)
        return
      }
    }

    setSubmitting(true)
    try {
      await sdk.client.fetch<{ success: boolean }>("/admin/warehouse/grn", {
        method: "POST",
        body: {
          grn_number: grnNumber.trim(),
          supplier_id: supplierId.trim(),
          supplier_invoice_no: supplierInvoiceNo.trim(),
          received_by: receivedBy.trim(),
          received_at: new Date().toISOString(),
          notes: notes.trim() || null,
          items: validLines.map((l) => ({
            product_id: l.product_id || l.product_name,
            variant_id: l.variant_id || "",
            product_name: l.product_name,
            batch_number: l.batch_number.trim(),
            expiry_date: l.expiry_date,
            quantity: l.quantity,
          })),
        },
      })
      toast.success("GRN created successfully")
      setCreateOpen(false)
      resetForm()
      fetchRecords()
    } catch (err: any) {
      toast.error("Failed to create GRN", { description: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Status filter options ────────────────────────────────────── */

  const STATUS_OPTIONS = [
    { value: "all", label: "All Statuses" },
    { value: "pending_qc", label: "Pending QC" },
    { value: "approved", label: "Approved" },
    { value: "partially_rejected", label: "Partially Rejected" },
    { value: "rejected", label: "Rejected" },
  ]

  /* ── Render ───────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header + Table ──────────────────────────────────────── */}
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h1">Goods Receipt Notes</Heading>
            <Text className="text-ui-fg-subtle text-sm mt-1">
              Track inbound goods — quality inspection and approval per CDSCO guidelines.
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <Select.Trigger><Select.Value placeholder="Filter" /></Select.Trigger>
              <Select.Content>
                {STATUS_OPTIONS.map((o) => (
                  <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Button variant="secondary" size="small" onClick={fetchRecords}>
              <ArrowPath /> Refresh
            </Button>
            <Button variant="primary" size="small" onClick={() => { resetForm(); setCreateOpen(true) }}>
              <PlusMini /> New GRN
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-8">
            <Text className="text-ui-fg-subtle">Loading GRN records...</Text>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Text className="text-ui-fg-subtle mb-1">No GRN records found.</Text>
            <Text className="text-xs text-ui-fg-muted">
              Create a new GRN when goods are received from a supplier.
            </Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>GRN Number</Table.HeaderCell>
                <Table.HeaderCell>Supplier Invoice</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Received By</Table.HeaderCell>
                <Table.HeaderCell>Received At</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Items</Table.HeaderCell>
                <Table.HeaderCell>QC Approved</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {records.map((grn) => (
                <Table.Row
                  key={grn.id}
                  className="cursor-pointer hover:bg-ui-bg-subtle-hover"
                  onClick={() => openDetail(grn)}
                >
                  <Table.Cell>
                    <Text className="font-mono text-sm font-medium">{grn.grn_number}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm">{grn.supplier_invoice_no || "—"}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={grnStatusColor(grn.status)}>{cap(grn.status)}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm">{grn.received_by || "—"}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm text-ui-fg-subtle">{fmtDate(grn.received_at)}</Text>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Badge color="grey">{Array.isArray(grn.items) ? grn.items.length : 0}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm text-ui-fg-subtle">
                      {grn.qc_approved_at ? fmtDate(grn.qc_approved_at) : "—"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {grn.status === "pending_qc" && (
                        <>
                          <Button
                            variant="secondary"
                            size="small"
                            disabled={actionLoading}
                            onClick={() => handleStatusAction(grn.id, "approve")}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            disabled={actionLoading}
                            onClick={() => openDetail(grn)}
                          >
                            Review
                          </Button>
                        </>
                      )}
                      {grn.status === "approved" && (
                        <Badge color="green"><CheckCircleSolid className="w-3 h-3" /> Done</Badge>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Container>

      {/* ── Detail Drawer ─────────────────────────────────────── */}
      <Drawer open={detailOpen} onOpenChange={setDetailOpen}>
        <Drawer.Content className="!max-w-[900px]">
          <Drawer.Header>
            <Drawer.Title>
              {detailRecord ? detailRecord.grn_number : "GRN Detail"}
              {detailRecord && (
                <Badge color={grnStatusColor(detailRecord.status)} className="ml-2">
                  {cap(detailRecord.status)}
                </Badge>
              )}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="p-4 overflow-y-auto">
            {!detailRecord ? (
              <Text className="text-ui-fg-subtle">No record selected.</Text>
            ) : (
              <>
                {/* GRN Info */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6 text-sm">
                  <div>
                    <Text className="text-xs text-ui-fg-subtle">GRN Number</Text>
                    <Text className="font-mono font-medium">{detailRecord.grn_number}</Text>
                  </div>
                  <div>
                    <Text className="text-xs text-ui-fg-subtle">Supplier ID</Text>
                    <Text className="font-mono">{detailRecord.supplier_id || "—"}</Text>
                  </div>
                  <div>
                    <Text className="text-xs text-ui-fg-subtle">Supplier Invoice</Text>
                    <Text>{detailRecord.supplier_invoice_no || "—"}</Text>
                  </div>
                  <div>
                    <Text className="text-xs text-ui-fg-subtle">Received By</Text>
                    <Text>{detailRecord.received_by || "—"}</Text>
                  </div>
                  <div>
                    <Text className="text-xs text-ui-fg-subtle">Received At</Text>
                    <Text>{fmtDateTime(detailRecord.received_at)}</Text>
                  </div>
                  <div>
                    <Text className="text-xs text-ui-fg-subtle">QC Approved By</Text>
                    <Text>{detailRecord.qc_approved_by || "—"}</Text>
                  </div>
                  <div>
                    <Text className="text-xs text-ui-fg-subtle">QC Approved At</Text>
                    <Text>{fmtDateTime(detailRecord.qc_approved_at)}</Text>
                  </div>
                </div>

                {/* Line Items */}
                <Text className="text-sm font-medium mb-2">
                  Line Items ({Array.isArray(detailRecord.items) ? detailRecord.items.length : 0})
                </Text>
                {Array.isArray(detailRecord.items) && detailRecord.items.length > 0 ? (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-ui-bg-subtle text-left text-xs text-ui-fg-subtle">
                          <th className="py-2 px-3">Product</th>
                          <th className="py-2 px-3">Batch #</th>
                          <th className="py-2 px-3">Expiry</th>
                          <th className="py-2 px-3 text-right">Quantity</th>
                          <th className="py-2 px-3">QC Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailRecord.items.map((item, idx) => (
                          <tr key={idx} className="border-b last:border-b-0 hover:bg-ui-bg-subtle">
                            <td className="py-2 px-3 font-medium">
                              {item.product_name || item.product_id}
                            </td>
                            <td className="py-2 px-3 font-mono text-xs">{item.batch_number}</td>
                            <td className="py-2 px-3">{fmtDate(item.expiry_date)}</td>
                            <td className="py-2 px-3 text-right">{item.quantity}</td>
                            <td className="py-2 px-3">
                              <Badge color={
                                item.qc_status === "pass" ? "green"
                                  : item.qc_status === "fail" ? "red"
                                  : "orange"
                              }>
                                {cap(item.qc_status || "pending")}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Text className="text-ui-fg-subtle">No line items.</Text>
                )}

                {/* Reject reason input */}
                {showRejectInput && (
                  <div className="mt-4 p-3 border rounded-lg border-ui-border-error bg-ui-bg-subtle">
                    <Label className="text-xs text-ui-fg-error">Rejection Reason *</Label>
                    <Textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Describe why this GRN is being rejected..."
                      rows={3}
                      className="mt-1"
                    />
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="danger"
                        size="small"
                        disabled={actionLoading || !rejectReason.trim()}
                        onClick={() => handleStatusAction(detailRecord.id, "reject", rejectReason)}
                      >
                        {actionLoading ? "Rejecting..." : "Confirm Rejection"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => { setShowRejectInput(false); setRejectReason("") }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">Close</Button>
            </Drawer.Close>
            {detailRecord?.status === "pending_qc" && !showRejectInput && (
              <>
                <Button
                  variant="primary"
                  disabled={actionLoading}
                  onClick={() => handleStatusAction(detailRecord.id, "approve")}
                >
                  <CheckCircleSolid /> {actionLoading ? "Approving..." : "Approve GRN"}
                </Button>
                <Button
                  variant="danger"
                  disabled={actionLoading}
                  onClick={() => setShowRejectInput(true)}
                >
                  <XMark /> Reject
                </Button>
              </>
            )}
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      {/* ── Create GRN Drawer ─────────────────────────────────── */}
      <Drawer open={createOpen} onOpenChange={setCreateOpen}>
        <Drawer.Content className="!max-w-[900px]">
          <Drawer.Header>
            <Drawer.Title>Create Goods Receipt Note</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="p-4 overflow-y-auto">
            {/* GRN Details */}
            <div className="mb-6">
              <Text className="text-sm font-medium mb-3">GRN Details</Text>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">GRN Number *</Label>
                  <Input
                    size="small"
                    value={grnNumber}
                    onChange={(e) => setGrnNumber(e.target.value)}
                    placeholder="GRN-2026-0001"
                  />
                </div>
                <div>
                  <Label className="text-xs">Supplier ID *</Label>
                  <Input
                    size="small"
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    placeholder="Supplier identifier"
                  />
                </div>
                <div>
                  <Label className="text-xs">Supplier Invoice No. *</Label>
                  <Input
                    size="small"
                    value={supplierInvoiceNo}
                    onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                    placeholder="INV-12345"
                  />
                </div>
                <div>
                  <Label className="text-xs">Received By *</Label>
                  <Input
                    size="small"
                    value={receivedBy}
                    onChange={(e) => setReceivedBy(e.target.value)}
                    placeholder="Staff member name"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes about this receipt..."
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <Text className="text-sm font-medium">Line Items</Text>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setFormLines((prev) => [...prev, createEmptyLine()])}
                >
                  <PlusMini /> Add Item
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                {formLines.map((line) => (
                  <div key={line.key} className="border rounded-lg p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1">
                        <Label className="text-xs">Product Name *</Label>
                        <Input
                          size="small"
                          value={line.product_name}
                          onChange={(e) => updateLine(line.key, { product_name: e.target.value })}
                          placeholder="e.g. Paracetamol 500mg"
                        />
                      </div>
                      <Button
                        variant="transparent"
                        size="small"
                        onClick={() => removeLine(line.key)}
                        className="mt-4"
                      >
                        <XMark />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Batch Number *</Label>
                        <Input
                          size="small"
                          value={line.batch_number}
                          onChange={(e) => updateLine(line.key, { batch_number: e.target.value })}
                          placeholder="LOT-001"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Expiry Date *</Label>
                        <Input
                          size="small"
                          type="date"
                          value={line.expiry_date}
                          onChange={(e) => updateLine(line.key, { expiry_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Quantity *</Label>
                        <Input
                          size="small"
                          type="number"
                          min={0}
                          value={line.quantity || ""}
                          onChange={(e) => updateLine(line.key, { quantity: parseInt(e.target.value) || 0 })}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-ui-bg-subtle rounded-lg">
              <div className="text-center">
                <Text className="text-xs text-ui-fg-subtle">Total Items</Text>
                <Text className="text-lg font-semibold">
                  {formLines.filter((l) => l.product_name.trim()).length}
                </Text>
              </div>
              <div className="text-center">
                <Text className="text-xs text-ui-fg-subtle">Total Quantity</Text>
                <Text className="text-lg font-semibold">
                  {formLines.reduce((sum, l) => sum + (l.quantity || 0), 0)}
                </Text>
              </div>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary" disabled={submitting}>Cancel</Button>
            </Drawer.Close>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create GRN"}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}

// Sidebar entry removed — GRN is now a tab under Purchases.
// This component is exported for use by the Purchases page.
export { GrnPage }
export default GrnPage
