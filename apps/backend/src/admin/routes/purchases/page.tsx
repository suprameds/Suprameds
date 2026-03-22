import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge, Button, Container, Drawer, Heading, Input, Label, Select,
  Table, Tabs, Text, Textarea, toast,
} from "@medusajs/ui"
import { ArrowDownTray, ArrowPath, PlusMini, XMark, CheckCircleSolid } from "@medusajs/icons"
import { useCallback, useEffect, useRef, useState } from "react"
import { sdk } from "../../lib/client"
import { GrnPage as GoodsReceiptTab } from "../grn/page"

/* ================================================================
   TYPES
   ================================================================ */

type POLine = {
  id: string; product_name: string; lot_number: string; expiry_date: string
  ordered_quantity: number; received_quantity: number
  mrp_paise: number | null; purchase_price_paise: number; line_total_paise: number
  batch_id: string | null; line_status: string
}

type PurchaseOrder = {
  id: string; po_number: string; supplier_name: string; supplier_contact?: string
  order_date: string; expected_delivery_date?: string; received_date?: string
  status: string; grn_number?: string; notes?: string
  total_items: number; total_quantity: number; total_cost_paise: number
  lines?: POLine[]
}

type ProductVariant = { id: string; title: string; sku: string | null }
type ProductResult = { id: string; title: string; handle: string; variants: ProductVariant[] }

type LineItemForm = {
  key: string; productQuery: string; productId: string; variantId: string
  productName: string; lotNumber: string; expiryDate: string; mfgDate: string
  quantity: number; mrp: number; purchasePrice: number
}

type ReceiveEntry = {
  line_id: string; product_name: string
  ordered_quantity: number; received_quantity: number
}

/* ================================================================
   HELPERS
   ================================================================ */

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" }, { value: "ordered", label: "Ordered" },
  { value: "received", label: "Received" }, { value: "partial", label: "Partial" },
  { value: "cancelled", label: "Cancelled" },
]

const statusColor = (s: string) => {
  const map: Record<string, "grey" | "blue" | "green" | "orange" | "red"> = {
    draft: "grey", ordered: "blue", received: "green", partial: "orange",
    cancelled: "red", pending: "grey", rejected: "red",
  }
  return map[s] || "grey"
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const fmtDate = (d?: string | null) => {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

const fmtINR = (paise?: number | null) => {
  if (paise == null) return "—"
  return `₹${(Number(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const createEmptyLine = (): LineItemForm => ({
  key: crypto.randomUUID(),
  productQuery: "", productId: "", variantId: "", productName: "",
  lotNumber: "", expiryDate: "", mfgDate: "",
  quantity: 0, mrp: 0, purchasePrice: 0,
})

const genPoNum = () => `PO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")}`

/* ================================================================
   PRODUCT SEARCH
   ================================================================ */

const ProductSearchInput = ({ value, onSelect }: {
  value: string
  onSelect: (product: ProductResult, variant: ProductVariant) => void
}) => {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<ProductResult[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const cRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value) }, [value])
  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await sdk.client.fetch<{ products: ProductResult[] }>(
          "/admin/products",
          { query: { q: query, fields: "id,title,handle,variants.*" } }
        )
        setResults(data.products || []); setOpen(true)
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [query])
  useEffect(() => {
    const h = (e: MouseEvent) => { if (cRef.current && !cRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
  }, [])

  return (
    <div ref={cRef} className="relative">
      <Input size="small" value={query} onChange={(e) => {
        setQuery(e.target.value)
        if (!e.target.value) onSelect({ id: "", title: "", handle: "", variants: [] }, { id: "", title: "", sku: null })
      }} placeholder="Search products..." />
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-ui-bg-base border rounded-lg shadow-elevation-card-rest max-h-48 overflow-y-auto">
          {results.flatMap((p) => p.variants?.length ? p.variants.map((v) => (
            <button key={v.id} type="button" onClick={() => { onSelect(p, v); setQuery(p.title); setOpen(false) }}
              className="w-full px-3 py-2 text-left hover:bg-ui-bg-subtle-hover text-sm border-b last:border-b-0">
              <span className="font-medium">{p.title}</span>
              {v.sku && <span className="text-ui-fg-subtle ml-2 text-xs">SKU: {v.sku}</span>}
            </button>
          )) : [])}
          {results.length === 0 && <div className="px-3 py-2 text-sm text-ui-fg-subtle">{searching ? "Searching..." : "No products found"}</div>}
        </div>
      )}
      {searching && <div className="absolute right-2 top-1/2 -translate-y-1/2"><Text className="text-xs text-ui-fg-muted animate-pulse">...</Text></div>}
    </div>
  )
}

/* ================================================================
   MAIN PAGE
   ================================================================ */

const PurchaseOrdersPage = () => {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")

  // ── Create drawer state ─────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [poNumber, setPoNumber] = useState(genPoNum())
  const [supplierName, setSupplierName] = useState("")
  const [supplierContact, setSupplierContact] = useState("")
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0])
  const [expectedDelivery, setExpectedDelivery] = useState("")
  const [grnNumber, setGrnNumber] = useState("")
  const [notes, setNotes] = useState("")
  const [formLines, setFormLines] = useState<LineItemForm[]>([createEmptyLine()])

  // ── Detail drawer state ─────────────────────────────────────
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailPO, setDetailPO] = useState<PurchaseOrder | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // ── Receive drawer state ────────────────────────────────────
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receiveEntries, setReceiveEntries] = useState<ReceiveEntry[]>([])
  const [receiving, setReceiving] = useState(false)

  /* ── List fetch ──────────────────────────────────────────────── */

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const query: Record<string, string> = {}
      if (statusFilter !== "all") query.status = statusFilter
      const json = await sdk.client.fetch<{ purchase_orders: PurchaseOrder[] }>(
        "/admin/pharma/purchases",
        { query }
      )
      setOrders(json.purchase_orders ?? [])
    } catch (err: any) {
      toast.error("Failed to load purchase orders", { description: err.message }); setOrders([])
    } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  /* ── Detail fetch ────────────────────────────────────────────── */

  const openDetail = async (poId: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailPO(null)
    try {
      const json = await sdk.client.fetch<{ purchase_order: PurchaseOrder }>(
        `/admin/pharma/purchases/${poId}`
      )
      setDetailPO(json.purchase_order)
    } catch (err: any) {
      toast.error("Failed to load PO", { description: err.message })
      setDetailOpen(false)
    } finally { setDetailLoading(false) }
  }

  /* ── Receive flow ────────────────────────────────────────────── */

  const openReceive = () => {
    if (!detailPO?.lines) return
    setReceiveEntries(
      detailPO.lines.filter((l) => l.line_status !== "received").map((l) => ({
        line_id: l.id, product_name: l.product_name,
        ordered_quantity: l.ordered_quantity, received_quantity: l.ordered_quantity,
      }))
    )
    setReceiveOpen(true)
  }

  const handleReceive = async () => {
    if (!detailPO) return
    setReceiving(true)
    try {
      const body = {
        line_overrides: receiveEntries.map((e) => ({
          line_id: e.line_id,
          received_quantity: e.received_quantity,
          line_status: e.received_quantity === 0 ? "rejected" : e.received_quantity < e.ordered_quantity ? "partial" : "received",
        })),
      }
      const data = await sdk.client.fetch<{ batches_created?: number }>(
        `/admin/pharma/purchases/${detailPO.id}/receive`,
        { method: "POST", body }
      )
      toast.success(`Goods received — ${data.batches_created ?? 0} batch(es) created`)
      setReceiveOpen(false)
      // Refresh detail
      openDetail(detailPO.id)
      fetchOrders()
    } catch (err: any) {
      toast.error("Failed to receive", { description: err.message })
    } finally { setReceiving(false) }
  }

  /* ── Cancel PO ───────────────────────────────────────────────── */

  const handleCancelPO = async () => {
    if (!detailPO || !window.confirm("Cancel this purchase order? This cannot be undone.")) return
    try {
      await sdk.client.fetch<{ success: boolean }>(`/admin/pharma/purchases/${detailPO.id}`, { method: "DELETE" })
      toast.success("PO cancelled")
      setDetailOpen(false)
      fetchOrders()
    } catch (err: any) { toast.error(err.message) }
  }

  /* ── Create form helpers ─────────────────────────────────────── */

  const updateLine = (key: string, u: Partial<LineItemForm>) =>
    setFormLines((p) => p.map((l) => (l.key === key ? { ...l, ...u } : l)))

  const removeLine = (key: string) =>
    setFormLines((p) => { const f = p.filter((l) => l.key !== key); return f.length ? f : [createEmptyLine()] })

  const totalItems = formLines.filter((l) => l.productId).length
  const totalQty = formLines.reduce((s, l) => s + (l.quantity || 0), 0)
  const totalCost = formLines.reduce((s, l) => s + (l.quantity || 0) * (l.purchasePrice || 0), 0)

  const resetForm = () => {
    setPoNumber(genPoNum()); setSupplierName(""); setSupplierContact("")
    setOrderDate(new Date().toISOString().split("T")[0]); setExpectedDelivery("")
    setGrnNumber(""); setNotes(""); setFormLines([createEmptyLine()])
  }

  const handleCreate = async (status: "draft" | "ordered") => {
    if (!poNumber.trim()) { toast.error("PO Number required"); return }
    if (!supplierName.trim()) { toast.error("Supplier required"); return }
    const valid = formLines.filter((l) => l.productId)
    if (!valid.length) { toast.error("Add at least one product"); return }
    for (const l of valid) {
      if (!l.lotNumber.trim()) { toast.error(`Lot # required for "${l.productName}"`); return }
      if (!l.expiryDate) { toast.error(`Expiry required for "${l.productName}"`); return }
      if (l.quantity <= 0) { toast.error(`Qty must be > 0 for "${l.productName}"`); return }
      if (l.purchasePrice <= 0) { toast.error(`Price required for "${l.productName}"`); return }
    }
    setSubmitting(true)
    try {
      await sdk.client.fetch<{ purchase_order: PurchaseOrder }>("/admin/pharma/purchases", {
        method: "POST",
        body: {
          po_number: poNumber.trim(), supplier_name: supplierName.trim(),
          supplier_contact: supplierContact.trim() || null, order_date: orderDate,
          expected_delivery_date: expectedDelivery || null, grn_number: grnNumber.trim() || null,
          notes: notes.trim() || null, status,
          lines: valid.map((l) => ({
            product_id: l.productId, product_variant_id: l.variantId,
            product_name: l.productName, lot_number: l.lotNumber.trim(),
            expiry_date: l.expiryDate, manufactured_on: l.mfgDate || null,
            ordered_quantity: l.quantity,
            mrp_paise: Math.round(l.mrp * 100),
            purchase_price_paise: Math.round(l.purchasePrice * 100),
          })),
        },
      })
      toast.success(status === "draft" ? "PO saved as draft" : "PO created & marked ordered")
      setCreateOpen(false); resetForm(); fetchOrders()
    } catch (err: any) { toast.error("Failed to create PO", { description: err.message }) }
    finally { setSubmitting(false) }
  }

  /* ── Render ──────────────────────────────────────────────────── */

  const canReceive = detailPO && ["draft", "ordered", "partial"].includes(detailPO.status)
  const canCancel = detailPO && !["received", "cancelled"].includes(detailPO.status)

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header + Table ──────────────────────────────────────── */}
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Purchase Orders</Heading>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <Select.Trigger><Select.Value placeholder="Filter" /></Select.Trigger>
              <Select.Content>{STATUS_OPTIONS.map((o) => <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>)}</Select.Content>
            </Select>
            <Button variant="secondary" size="small" onClick={fetchOrders}><ArrowPath /> Refresh</Button>
            <Button variant="primary" size="small" onClick={() => { resetForm(); setCreateOpen(true) }}>
              <PlusMini /> Create Purchase Order
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-6"><Text className="text-ui-fg-subtle">Loading...</Text></div>
        ) : orders.length === 0 ? (
          <div className="flex justify-center p-6"><Text className="text-ui-fg-subtle">No purchase orders found.</Text></div>
        ) : (
          <Table>
            <Table.Header><Table.Row>
              <Table.HeaderCell>PO Number</Table.HeaderCell>
              <Table.HeaderCell>Supplier</Table.HeaderCell>
              <Table.HeaderCell>Date</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Items</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Total Cost</Table.HeaderCell>
              <Table.HeaderCell>Actions</Table.HeaderCell>
            </Table.Row></Table.Header>
            <Table.Body>
              {orders.map((po) => (
                <Table.Row key={po.id} className="cursor-pointer hover:bg-ui-bg-subtle-hover" onClick={() => openDetail(po.id)}>
                  <Table.Cell><Text className="font-mono text-sm font-medium">{po.po_number}</Text></Table.Cell>
                  <Table.Cell><Text className="text-sm">{po.supplier_name}</Text></Table.Cell>
                  <Table.Cell><Text className="text-sm">{fmtDate(po.order_date)}</Text></Table.Cell>
                  <Table.Cell><Badge color={statusColor(po.status)}>{cap(po.status)}</Badge></Table.Cell>
                  <Table.Cell className="text-right"><Text className="text-sm">{po.total_items}</Text></Table.Cell>
                  <Table.Cell className="text-right"><Text className="text-sm font-medium">{fmtINR(po.total_cost_paise)}</Text></Table.Cell>
                  <Table.Cell>
                    <Button variant="secondary" size="small" onClick={(e) => { e.stopPropagation(); openDetail(po.id) }}>View</Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Container>

      {/* ── Create PO Drawer ──────────────────────────────────── */}
      <Drawer open={createOpen} onOpenChange={setCreateOpen}>
        <Drawer.Content className="!max-w-[900px]">
          <Drawer.Header><Drawer.Title>Create Purchase Order</Drawer.Title></Drawer.Header>
          <Drawer.Body className="p-4 overflow-y-auto">
            <div className="mb-6">
              <Text className="text-sm font-medium mb-3">Purchase Order Details</Text>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">PO Number *</Label><Input size="small" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="PO-2026-001" /></div>
                <div><Label className="text-xs">Supplier *</Label><Input size="small" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Cipla Ltd" /></div>
                <div><Label className="text-xs">Contact</Label><Input size="small" value={supplierContact} onChange={(e) => setSupplierContact(e.target.value)} placeholder="Phone / email" /></div>
                <div><Label className="text-xs">Order Date *</Label><Input size="small" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></div>
                <div><Label className="text-xs">Expected Delivery</Label><Input size="small" type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} /></div>
                <div><Label className="text-xs">GRN Number</Label><Input size="small" value={grnNumber} onChange={(e) => setGrnNumber(e.target.value)} placeholder="GRN-2026-001" /></div>
                <div className="col-span-2"><Label className="text-xs">Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} /></div>
              </div>
            </div>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <Text className="text-sm font-medium">Line Items</Text>
                <Button variant="secondary" size="small" onClick={() => setFormLines((p) => [...p, createEmptyLine()])}><PlusMini /> Add Line</Button>
              </div>
              <div className="flex flex-col gap-3">
                {formLines.map((line) => (
                  <div key={line.key} className="border rounded-lg p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1"><Label className="text-xs">Product *</Label>
                        <ProductSearchInput value={line.productQuery} onSelect={(p, v) => updateLine(line.key, { productId: p.id, variantId: v.id, productName: p.title, productQuery: p.title })} />
                      </div>
                      <Button variant="transparent" size="small" onClick={() => removeLine(line.key)} className="mt-4"><XMark /></Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-xs">Lot # *</Label><Input size="small" value={line.lotNumber} onChange={(e) => updateLine(line.key, { lotNumber: e.target.value })} /></div>
                      <div><Label className="text-xs">Expiry *</Label><Input size="small" type="date" value={line.expiryDate} onChange={(e) => updateLine(line.key, { expiryDate: e.target.value })} /></div>
                      <div><Label className="text-xs">Mfg Date</Label><Input size="small" type="date" value={line.mfgDate} onChange={(e) => updateLine(line.key, { mfgDate: e.target.value })} /></div>
                      <div><Label className="text-xs">Qty *</Label><Input size="small" type="number" min={0} value={line.quantity || ""} onChange={(e) => updateLine(line.key, { quantity: parseInt(e.target.value) || 0 })} /></div>
                      <div><Label className="text-xs">MRP (₹)</Label><Input size="small" type="number" min={0} step="0.01" value={line.mrp || ""} onChange={(e) => updateLine(line.key, { mrp: parseFloat(e.target.value) || 0 })} /></div>
                      <div><Label className="text-xs">Cost (₹) *</Label><Input size="small" type="number" min={0} step="0.01" value={line.purchasePrice || ""} onChange={(e) => updateLine(line.key, { purchasePrice: parseFloat(e.target.value) || 0 })} /></div>
                    </div>
                    {line.quantity > 0 && line.purchasePrice > 0 && (
                      <Text className="text-xs text-ui-fg-subtle mt-1 text-right">Line: ₹{((line.quantity) * (line.purchasePrice)).toFixed(2)}</Text>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 p-3 bg-ui-bg-subtle rounded-lg">
              <div className="text-center"><Text className="text-xs text-ui-fg-subtle">Items</Text><Text className="text-lg font-semibold">{totalItems}</Text></div>
              <div className="text-center"><Text className="text-xs text-ui-fg-subtle">Total Qty</Text><Text className="text-lg font-semibold">{totalQty}</Text></div>
              <div className="text-center"><Text className="text-xs text-ui-fg-subtle">Total Cost</Text><Text className="text-lg font-semibold">₹{totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</Text></div>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild><Button variant="secondary" disabled={submitting}>Cancel</Button></Drawer.Close>
            <Button variant="secondary" onClick={() => handleCreate("draft")} disabled={submitting}>{submitting ? "Saving..." : "Save as Draft"}</Button>
            <Button variant="primary" onClick={() => handleCreate("ordered")} disabled={submitting}>{submitting ? "Saving..." : "Save & Mark Ordered"}</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      {/* ── Detail Drawer ─────────────────────────────────────── */}
      <Drawer open={detailOpen} onOpenChange={setDetailOpen}>
        <Drawer.Content className="!max-w-[900px]">
          <Drawer.Header>
            <Drawer.Title>
              {detailPO ? `${detailPO.po_number}` : "Purchase Order"}
              {detailPO && <Badge color={statusColor(detailPO.status)} className="ml-2">{cap(detailPO.status)}</Badge>}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="p-4 overflow-y-auto">
            {detailLoading ? (
              <Text className="text-ui-fg-subtle">Loading...</Text>
            ) : !detailPO ? (
              <Text className="text-ui-fg-error">PO not found</Text>
            ) : (
              <>
                {/* PO Info */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6 text-sm">
                  <div><Text className="text-xs text-ui-fg-subtle">Supplier</Text><Text className="font-medium">{detailPO.supplier_name}</Text></div>
                  <div><Text className="text-xs text-ui-fg-subtle">Contact</Text><Text>{detailPO.supplier_contact || "—"}</Text></div>
                  <div><Text className="text-xs text-ui-fg-subtle">Order Date</Text><Text>{fmtDate(detailPO.order_date)}</Text></div>
                  <div><Text className="text-xs text-ui-fg-subtle">Expected Delivery</Text><Text>{fmtDate(detailPO.expected_delivery_date)}</Text></div>
                  <div><Text className="text-xs text-ui-fg-subtle">Received Date</Text><Text>{fmtDate(detailPO.received_date)}</Text></div>
                  <div><Text className="text-xs text-ui-fg-subtle">GRN</Text><Text className="font-mono">{detailPO.grn_number || "—"}</Text></div>
                  <div><Text className="text-xs text-ui-fg-subtle">Total Cost</Text><Text className="font-medium">{fmtINR(detailPO.total_cost_paise)}</Text></div>
                  <div><Text className="text-xs text-ui-fg-subtle">Items</Text><Text>{detailPO.total_items}</Text></div>
                  <div><Text className="text-xs text-ui-fg-subtle">Total Qty</Text><Text>{detailPO.total_quantity}</Text></div>
                </div>
                {detailPO.notes && (
                  <div className="p-3 bg-ui-bg-subtle rounded-lg mb-4">
                    <Text className="text-xs text-ui-fg-subtle">Notes</Text>
                    <Text className="text-sm mt-1">{detailPO.notes}</Text>
                  </div>
                )}

                {/* Line Items */}
                <Text className="text-sm font-medium mb-2">Line Items ({detailPO.lines?.length || 0})</Text>
                {detailPO.lines?.length ? (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-ui-bg-subtle text-left text-xs text-ui-fg-subtle">
                        <th className="py-2 px-3">Product</th>
                        <th className="py-2 px-3">Lot #</th>
                        <th className="py-2 px-3">Expiry</th>
                        <th className="py-2 px-3 text-right">Ordered</th>
                        <th className="py-2 px-3 text-right">Received</th>
                        <th className="py-2 px-3 text-right">Cost</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Batch</th>
                      </tr></thead>
                      <tbody>
                        {detailPO.lines.map((l) => (
                          <tr key={l.id} className="border-b last:border-b-0 hover:bg-ui-bg-subtle">
                            <td className="py-2 px-3 font-medium">{l.product_name}</td>
                            <td className="py-2 px-3 font-mono text-xs">{l.lot_number}</td>
                            <td className="py-2 px-3">{fmtDate(l.expiry_date)}</td>
                            <td className="py-2 px-3 text-right">{l.ordered_quantity}</td>
                            <td className="py-2 px-3 text-right">{l.received_quantity}</td>
                            <td className="py-2 px-3 text-right">{fmtINR(l.purchase_price_paise)}</td>
                            <td className="py-2 px-3"><Badge color={statusColor(l.line_status)}>{cap(l.line_status)}</Badge></td>
                            <td className="py-2 px-3 font-mono text-xs text-ui-fg-subtle">{l.batch_id ? l.batch_id.slice(-8) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Text className="text-ui-fg-subtle">No line items</Text>
                )}
              </>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild><Button variant="secondary">Close</Button></Drawer.Close>
            {canReceive && (
              <Button variant="primary" onClick={openReceive}><CheckCircleSolid /> Receive Goods</Button>
            )}
            {canCancel && (
              <Button variant="danger" onClick={handleCancelPO}><XMark /> Cancel PO</Button>
            )}
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      {/* ── Receive Drawer ────────────────────────────────────── */}
      <Drawer open={receiveOpen} onOpenChange={setReceiveOpen}>
        <Drawer.Content>
          <Drawer.Header><Drawer.Title>Receive Goods — {detailPO?.po_number}</Drawer.Title></Drawer.Header>
          <Drawer.Body className="p-4 overflow-y-auto">
            <Text className="text-sm text-ui-fg-subtle mb-4">
              Enter received quantity for each line. Set to 0 to reject a line.
            </Text>
            <div className="flex flex-col gap-3">
              {receiveEntries.map((e) => (
                <div key={e.line_id} className="p-3 border rounded-lg">
                  <Text className="text-sm font-medium mb-2">{e.product_name}</Text>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Ordered</Label>
                      <Text className="text-sm font-mono mt-1">{e.ordered_quantity}</Text>
                    </div>
                    <div>
                      <Label className="text-xs">Received Qty</Label>
                      <Input type="number" min={0} max={e.ordered_quantity} value={e.received_quantity}
                        onChange={(ev) => setReceiveEntries((p) => p.map((x) =>
                          x.line_id === e.line_id ? { ...x, received_quantity: parseInt(ev.target.value) || 0 } : x
                        ))} />
                    </div>
                  </div>
                </div>
              ))}
              {receiveEntries.length === 0 && (
                <div className="text-center py-6">
                  <CheckCircleSolid className="w-6 h-6 text-ui-fg-subtle mx-auto mb-2" />
                  <Text className="text-ui-fg-subtle">All lines already received.</Text>
                </div>
              )}
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild><Button variant="secondary" disabled={receiving}>Cancel</Button></Drawer.Close>
            <Button variant="primary" onClick={handleReceive} disabled={receiving || !receiveEntries.length}>
              {receiving ? "Processing..." : "Confirm Receipt"}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}

/* ================================================================
   WRAPPER PAGE WITH TABS
   ================================================================ */

const PurchasesPage = () => (
  <div className="flex flex-col gap-4">
    <Container className="p-6">
      <Heading level="h1" className="mb-2">Procurement</Heading>
      <Text className="text-ui-fg-subtle">
        Manage purchase orders and receive goods with quality inspection.
      </Text>
    </Container>

    <Container className="p-6">
      <Tabs defaultValue="purchase-orders">
        <Tabs.List>
          <Tabs.Trigger value="purchase-orders">Purchase Orders</Tabs.Trigger>
          <Tabs.Trigger value="goods-receipt">Goods Receipt (GRN)</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="purchase-orders" className="pt-4">
          <PurchaseOrdersPage />
        </Tabs.Content>

        <Tabs.Content value="goods-receipt" className="pt-4">
          <GoodsReceiptTab />
        </Tabs.Content>
      </Tabs>
    </Container>
  </div>
)

export const config = defineRouteConfig({
  label: "Procurement",
  icon: ArrowDownTray,
})

export default PurchasesPage
