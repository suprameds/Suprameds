import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge, Button, Container, Drawer, Heading, Input,
  Label, Select, Table, Text, Textarea, toast,
} from "@medusajs/ui"
import {
  ArchiveBox, ArrowDownTray, ArrowPath, ExclamationCircle,
  MagnifyingGlass, PlusMini, XMark,
} from "@medusajs/icons"
import { useCallback, useEffect, useMemo, useState } from "react"
import { sdk } from "../../../lib/client"

/* ================================================================
   TYPES
   ================================================================ */

type BatchDetail = {
  id: string
  lot_number: string
  expiry_date: string | null
  days_to_expiry: number | null
  available_quantity: number
  reserved_quantity: number
  received_quantity: number
  status: "active" | "quarantine" | "recalled" | "expired" | "depleted"
  batch_mrp_paise: number | null
  supplier_name: string | null
  grn_number: string | null
}

type ProductSummary = {
  product_id: string
  product_title: string
  total_stock: number
  batch_count: number
  active_batches: number
  expired_batches: number
  quarantined_batches: number
  earliest_expiry: string | null
  near_expiry_count: number
  batches: BatchDetail[]
}

type ReportTotals = {
  total_products: number
  total_batches: number
  total_stock: number
  near_expiry_count?: number
  out_of_stock_products?: number
}

type SortOption = "name_asc" | "stock_low" | "stock_high"

/* ================================================================
   HELPERS
   ================================================================ */

const fmtDate = (d?: string | null) => {
  if (!d) return "\u2014"
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  })
}

const fmtCurrency = (paise: number | null) => {
  if (paise == null) return "\u2014"
  return `\u20B9${(paise / 100).toFixed(2)}`
}

const cap = (s: string) =>
  s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")

const batchStatusColor = (s: string): "green" | "orange" | "red" | "grey" => {
  const map: Record<string, "green" | "orange" | "red" | "grey"> = {
    active: "green",
    quarantine: "orange",
    recalled: "red",
    expired: "grey",
    depleted: "grey",
  }
  return map[s] || "grey"
}

const stockColor = (product: ProductSummary): string => {
  const allExpired = product.batch_count > 0 && product.expired_batches === product.batch_count
  if (allExpired) return "text-ui-fg-disabled"
  if (product.total_stock <= 0) return "text-ui-tag-red-text"
  if (product.total_stock <= 10) return "text-ui-tag-orange-text"
  return "text-ui-tag-green-text"
}

const stockBgColor = (product: ProductSummary): string => {
  const allExpired = product.batch_count > 0 && product.expired_batches === product.batch_count
  if (allExpired) return "bg-ui-bg-disabled"
  if (product.total_stock <= 0) return "bg-ui-tag-red-bg"
  if (product.total_stock <= 10) return "bg-ui-tag-orange-bg"
  return "bg-ui-tag-green-bg"
}

const expiryColor = (days: number | null): "red" | "orange" | "green" | "grey" => {
  if (days === null) return "grey"
  if (days < 0) return "red"
  if (days < 30) return "red"
  if (days < 90) return "orange"
  return "green"
}

/* ================================================================
   STAT CARD
   ================================================================ */

const StatCard = ({ label, value, sub }: {
  label: string; value: string | number; sub?: string
}) => (
  <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-base">
    <Text className="text-xs text-ui-fg-subtle uppercase tracking-wide">{label}</Text>
    <Text className="text-2xl font-semibold mt-1">{value}</Text>
    {sub && <Text className="text-xs text-ui-fg-muted mt-0.5">{sub}</Text>}
  </div>
)

/* ================================================================
   EXPIRY BADGE (for batch table)
   ================================================================ */

const ExpiryBadge = ({ expiryDate, daysToExpiry }: {
  expiryDate: string | null
  daysToExpiry: number | null
}) => {
  const days = daysToExpiry
  if (days === null) return <Text className="text-sm text-ui-fg-subtle">{fmtDate(expiryDate)}</Text>

  if (days < 0) {
    return (
      <div className="flex items-center gap-1">
        <Badge color="red">Expired</Badge>
      </div>
    )
  }

  if (days < 30) {
    return (
      <div className="flex flex-col gap-0.5">
        <Text className="text-sm">{fmtDate(expiryDate)}</Text>
        <div className="flex items-center gap-1">
          <ExclamationCircle className="text-ui-fg-error w-3 h-3" />
          <Badge color="red">{days}d left</Badge>
        </div>
      </div>
    )
  }

  if (days < 90) {
    return (
      <div className="flex flex-col gap-0.5">
        <Text className="text-sm">{fmtDate(expiryDate)}</Text>
        <div className="flex items-center gap-1">
          <ExclamationCircle className="text-ui-fg-warning w-3 h-3" />
          <Badge color="orange">{days}d left</Badge>
        </div>
      </div>
    )
  }

  return <Text className="text-sm">{fmtDate(expiryDate)}</Text>
}

/* ================================================================
   STOCK ADJUSTMENT DRAWER
   ================================================================ */

const StockAdjustDrawer = ({
  open,
  onClose,
  batch,
  productTitle,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  batch: BatchDetail | null
  productTitle: string
  onSuccess: () => void
}) => {
  const [adjustType, setAdjustType] = useState<"add" | "reduce">("add")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setAdjustType("add")
      setQuantity("")
      setReason("")
    }
  }, [open])

  if (!batch) return null

  const qty = parseInt(quantity, 10)
  const validQty = !isNaN(qty) && qty > 0
  const newQuantity = validQty
    ? adjustType === "add"
      ? batch.available_quantity + qty
      : batch.available_quantity - qty
    : batch.available_quantity

  const canSave = validQty && reason.trim().length > 0 && (
    adjustType === "add" || newQuantity >= 0
  )

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await sdk.client.fetch("/admin/pharma/batches/adjust", {
        method: "POST",
        body: {
          batch_id: batch.id,
          adjustment_type: adjustType,
          quantity: qty,
          reason: reason.trim(),
        },
      })
      toast.success("Stock adjusted successfully", {
        description: `${cap(adjustType)}ed ${qty} units for batch ${batch.lot_number}`,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error("Failed to adjust stock", { description: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Drawer.Content className="!max-w-[480px]">
        <Drawer.Header>
          <Drawer.Title>Adjust Stock</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="p-4 overflow-y-auto">
          <div className="flex flex-col gap-4">
            <div>
              <Text className="text-sm font-medium">{productTitle}</Text>
              <Text className="text-xs text-ui-fg-subtle">
                Batch: {batch.lot_number} | Expiry: {fmtDate(batch.expiry_date)}
              </Text>
            </div>

            <div className="border-t border-ui-border-base pt-4">
              <Label className="mb-2 block">Adjustment Type</Label>
              <div className="flex gap-2">
                <Button
                  variant={adjustType === "add" ? "primary" : "secondary"}
                  size="small"
                  onClick={() => setAdjustType("add")}
                >
                  <PlusMini /> Add Stock
                </Button>
                <Button
                  variant={adjustType === "reduce" ? "danger" : "secondary"}
                  size="small"
                  onClick={() => setAdjustType("reduce")}
                >
                  Reduce Stock
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="current-qty" className="mb-1 block">Current Quantity</Label>
              <Input
                id="current-qty"
                value={String(batch.available_quantity)}
                readOnly
                className="bg-ui-bg-disabled"
              />
            </div>

            <div>
              <Label htmlFor="adjust-qty" className="mb-1 block">Adjustment Quantity</Label>
              <Input
                id="adjust-qty"
                type="number"
                min={1}
                placeholder="Enter quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              {adjustType === "reduce" && validQty && newQuantity < 0 && (
                <Text className="text-xs text-ui-fg-error mt-1">
                  Cannot reduce below zero. Max reducible: {batch.available_quantity}
                </Text>
              )}
            </div>

            <div>
              <Label htmlFor="new-qty" className="mb-1 block">New Quantity</Label>
              <Input
                id="new-qty"
                value={validQty ? String(newQuantity) : "\u2014"}
                readOnly
                className="bg-ui-bg-disabled"
              />
            </div>

            <div>
              <Label htmlFor="adjust-reason" className="mb-1 block">
                Reason <span className="text-ui-fg-error">*</span>
              </Label>
              <Textarea
                id="adjust-reason"
                placeholder="e.g. Physical stock count correction, Damage write-off..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary">Cancel</Button>
          </Drawer.Close>
          <Button
            variant="primary"
            disabled={!canSave || saving}
            onClick={handleSave}
          >
            {saving ? "Saving..." : "Save Adjustment"}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

/* ================================================================
   IMPORT BATCHES DRAWER
   ================================================================ */

type ImportPreviewRow = {
  product_name: string
  batch_no: string
  expiry_date: string
  quantity: number
  matched: boolean
}

const ImportBatchesDrawer = ({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) => {
  const [csvText, setCsvText] = useState("")
  const [preview, setPreview] = useState<ImportPreviewRow[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [parseError, setParseError] = useState("")

  useEffect(() => {
    if (open) {
      setCsvText("")
      setPreview(null)
      setParseError("")
    }
  }, [open])

  const parseCSV = useCallback(() => {
    setParseError("")
    const lines = csvText.trim().split("\n").filter((l) => l.trim())
    if (lines.length < 2) {
      setParseError("CSV must have a header row and at least one data row.")
      return
    }

    const header = lines[0].toLowerCase().split(",").map((h) => h.trim())
    const nameIdx = header.findIndex((h) => h.includes("product") || h.includes("name"))
    const batchIdx = header.findIndex((h) => h.includes("batch"))
    const expiryIdx = header.findIndex((h) => h.includes("expiry") || h.includes("exp"))
    const qtyIdx = header.findIndex((h) => h.includes("quantity") || h.includes("qty"))

    if (nameIdx === -1 || batchIdx === -1 || expiryIdx === -1 || qtyIdx === -1) {
      setParseError("CSV must have columns: product_name, batch_no, expiry_date, quantity")
      return
    }

    const rows: ImportPreviewRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim())
      if (cols.length < Math.max(nameIdx, batchIdx, expiryIdx, qtyIdx) + 1) continue
      rows.push({
        product_name: cols[nameIdx],
        batch_no: cols[batchIdx],
        expiry_date: cols[expiryIdx],
        quantity: parseInt(cols[qtyIdx], 10) || 0,
        matched: true, // The API will resolve matching
      })
    }

    if (rows.length === 0) {
      setParseError("No valid data rows found.")
      return
    }

    setPreview(rows)
  }, [csvText])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvText(text)
      setPreview(null)
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  const handleImport = async () => {
    if (!preview || preview.length === 0) return
    setImporting(true)
    try {
      await sdk.client.fetch("/admin/pharma/batches/import", {
        method: "POST",
        body: {
          batches: preview.map((r) => ({
            product_name: r.product_name,
            batch_no: r.batch_no,
            expiry_date: r.expiry_date,
            quantity: r.quantity,
          })),
        },
      })
      toast.success("Batches imported successfully", {
        description: `${preview.length} batch records processed`,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error("Import failed", { description: err.message })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Drawer.Content className="!max-w-[700px]">
        <Drawer.Header>
          <Drawer.Title>Import Batches</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="p-4 overflow-y-auto">
          <div className="flex flex-col gap-4">
            <div>
              <Label className="mb-1 block">Upload CSV File</Label>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="block w-full text-sm text-ui-fg-base file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-ui-border-base file:bg-ui-bg-base file:text-sm file:text-ui-fg-base file:cursor-pointer hover:file:bg-ui-bg-base-hover"
              />
              <Text className="text-xs text-ui-fg-muted mt-1">
                Required columns: product_name, batch_no, expiry_date, quantity
              </Text>
            </div>

            <div>
              <Label className="mb-1 block">Or Paste CSV Data</Label>
              <Textarea
                placeholder={`product_name,batch_no,expiry_date,quantity\nAtorcyn 10,BN-2026-001,2027-06-30,500\nRozucyn 20,BN-2026-002,2027-12-31,300`}
                value={csvText}
                onChange={(e) => { setCsvText(e.target.value); setPreview(null) }}
                rows={6}
                className="font-mono text-xs"
              />
            </div>

            {csvText.trim() && !preview && (
              <Button variant="secondary" size="small" onClick={parseCSV}>
                Parse & Preview
              </Button>
            )}

            {parseError && (
              <div className="p-3 rounded-md bg-ui-tag-red-bg border border-ui-tag-red-border">
                <Text className="text-sm text-ui-tag-red-text">{parseError}</Text>
              </div>
            )}

            {preview && preview.length > 0 && (
              <div>
                <Text className="text-sm font-medium mb-2">
                  Preview: {preview.length} rows parsed
                </Text>
                <div className="max-h-[300px] overflow-y-auto border border-ui-border-base rounded-md">
                  <Table>
                    <Table.Header>
                      <Table.Row>
                        <Table.HeaderCell>Product</Table.HeaderCell>
                        <Table.HeaderCell>Batch No.</Table.HeaderCell>
                        <Table.HeaderCell>Expiry</Table.HeaderCell>
                        <Table.HeaderCell className="text-right">Qty</Table.HeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {preview.map((row, i) => (
                        <Table.Row key={i}>
                          <Table.Cell>
                            <Text className="text-sm">{row.product_name}</Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Text className="text-sm font-mono">{row.batch_no}</Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Text className="text-sm">{row.expiry_date}</Text>
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            <Text className="text-sm">{row.quantity}</Text>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary">Cancel</Button>
          </Drawer.Close>
          <Button
            variant="primary"
            disabled={!preview || preview.length === 0 || importing}
            onClick={handleImport}
          >
            {importing ? "Importing..." : `Import ${preview?.length ?? 0} Batches`}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

/* ================================================================
   PRODUCT LIST ITEM (left panel)
   ================================================================ */

const ProductListItem = ({
  product,
  selected,
  onClick,
}: {
  product: ProductSummary
  selected: boolean
  onClick: () => void
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b border-ui-border-base transition-colors
        ${selected
          ? "bg-ui-bg-base-pressed border-l-2 border-l-ui-fg-interactive"
          : "bg-ui-bg-base hover:bg-ui-bg-base-hover border-l-2 border-l-transparent"
        }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Text className="text-sm font-medium truncate block">
            {product.product_title}
          </Text>
          <div className="flex items-center gap-2 mt-0.5">
            <Text className="text-xs text-ui-fg-muted">
              {product.batch_count} batch{product.batch_count !== 1 ? "es" : ""}
            </Text>
            {product.near_expiry_count > 0 && (
              <Badge color="orange" className="text-[10px]">
                {product.near_expiry_count} near expiry
              </Badge>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <span className={`inline-flex items-center justify-center min-w-[40px] px-2 py-0.5 rounded-md text-sm font-semibold ${stockBgColor(product)} ${stockColor(product)}`}>
            {product.total_stock}
          </span>
        </div>
      </div>
    </button>
  )
}

/* ================================================================
   STATUS FILTER OPTIONS
   ================================================================ */

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "quarantine", label: "Quarantine" },
  { value: "recalled", label: "Recalled" },
  { value: "expired", label: "Expired" },
  { value: "depleted", label: "Depleted" },
]

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "name_asc", label: "Name A\u2192Z" },
  { value: "stock_low", label: "Stock Low\u2192High" },
  { value: "stock_high", label: "Stock High\u2192Low" },
]

/* ================================================================
   MAIN PAGE COMPONENT
   ================================================================ */

const BatchInventoryPage = () => {
  /* --- State --- */
  const [report, setReport] = useState<ProductSummary[]>([])
  const [totals, setTotals] = useState<ReportTotals | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState<SortOption>("name_asc")
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)

  /* Drawer state */
  const [adjustDrawerOpen, setAdjustDrawerOpen] = useState(false)
  const [adjustBatch, setAdjustBatch] = useState<BatchDetail | null>(null)
  const [importDrawerOpen, setImportDrawerOpen] = useState(false)

  /* Recall state */
  const [recalling, setRecalling] = useState<string | null>(null)

  /* --- Data fetching --- */
  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const query: Record<string, string> = {}
      if (statusFilter !== "all") query.status = statusFilter

      const json = await sdk.client.fetch<{
        report?: ProductSummary[]
        totals?: ReportTotals
      }>("/admin/pharma/batches/report", { query })

      setReport(json.report ?? [])
      setTotals(json.totals ?? null)
    } catch (err: any) {
      console.error("[warehouse-inventory]", err)
      toast.error("Failed to load inventory", { description: err.message })
      setReport([])
      setTotals(null)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchReport() }, [fetchReport])

  /* --- Derived: filtered & sorted products --- */
  const filteredProducts = useMemo(() => {
    let list = report

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((p) =>
        p.product_title.toLowerCase().includes(q) ||
        p.product_id.toLowerCase().includes(q) ||
        p.batches.some((b) =>
          b.lot_number?.toLowerCase().includes(q) ||
          b.supplier_name?.toLowerCase().includes(q)
        )
      )
    }

    // Sort
    const sorted = [...list]
    switch (sortBy) {
      case "name_asc":
        sorted.sort((a, b) => a.product_title.localeCompare(b.product_title))
        break
      case "stock_low":
        sorted.sort((a, b) => a.total_stock - b.total_stock)
        break
      case "stock_high":
        sorted.sort((a, b) => b.total_stock - a.total_stock)
        break
    }

    return sorted
  }, [report, search, sortBy])

  /* --- Selected product --- */
  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return filteredProducts[0] ?? null
    return filteredProducts.find((p) => p.product_id === selectedProductId) ?? filteredProducts[0] ?? null
  }, [filteredProducts, selectedProductId])

  // Auto-select first product when data loads
  useEffect(() => {
    if (filteredProducts.length > 0 && !selectedProductId) {
      setSelectedProductId(filteredProducts[0].product_id)
    }
  }, [filteredProducts, selectedProductId])

  /* --- Stats from totals --- */
  const totalProducts = totals?.total_products ?? report.length
  const totalBatches = totals?.total_batches ?? report.reduce((s, p) => s + p.batch_count, 0)
  const nearExpiryTotal = totals?.near_expiry_count ?? report.reduce((s, p) => s + p.near_expiry_count, 0)
  const outOfStockProducts = totals?.out_of_stock_products ?? report.filter((p) => p.total_stock <= 0).length

  /* --- Batch actions --- */
  const handleRecall = async (batch: BatchDetail) => {
    setRecalling(batch.id)
    try {
      await sdk.client.fetch(`/admin/pharma/batches/${batch.id}/recall`, {
        method: "POST",
        body: { batch_id: batch.id },
      })
      toast.success(`Batch ${batch.lot_number} recalled successfully`)
      fetchReport()
    } catch (err: any) {
      toast.error("Failed to recall batch", { description: err.message })
    } finally {
      setRecalling(null)
    }
  }

  const openAdjustDrawer = (batch: BatchDetail) => {
    setAdjustBatch(batch)
    setAdjustDrawerOpen(true)
  }

  /* --- Batches for selected product (optionally filtered by status) --- */
  const displayedBatches = useMemo(() => {
    if (!selectedProduct) return []
    if (statusFilter === "all") return selectedProduct.batches
    return selectedProduct.batches.filter((b) => b.status === statusFilter)
  }, [selectedProduct, statusFilter])

  /* ================================================================
     RENDER
     ================================================================ */

  return (
    <div className="flex flex-col gap-4">
      {/* Page Header */}
      <Container className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h1" className="mb-1">Batch Inventory</Heading>
            <Text className="text-ui-fg-subtle">
              Monitor pharmaceutical batch inventory — stock levels, expiry dates, and batch status by product.
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="small" onClick={() => setImportDrawerOpen(true)}>
              <ArrowDownTray /> Import Batches
            </Button>
            <Button variant="secondary" size="small" onClick={fetchReport}>
              <ArrowPath /> Refresh
            </Button>
          </div>
        </div>
      </Container>

      {/* Stats Cards */}
      <Container className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Products with Stock"
            value={totalProducts}
            sub="Unique products"
          />
          <StatCard
            label="Active Batches"
            value={totalBatches}
            sub="Across all products"
          />
          <StatCard
            label="Near Expiry"
            value={nearExpiryTotal}
            sub="Within 90 days"
          />
          <StatCard
            label="Out of Stock"
            value={outOfStockProducts}
            sub="Zero quantity products"
          />
        </div>
      </Container>

      {/* Split View: Product List + Batch Details */}
      <Container className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Text className="text-ui-fg-subtle">Loading inventory report...</Text>
          </div>
        ) : report.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <ArchiveBox className="w-10 h-10 text-ui-fg-muted mb-3" />
            <Text className="text-ui-fg-subtle mb-1">No batches found.</Text>
            <Text className="text-xs text-ui-fg-muted">
              Inventory batches are created when GRNs are processed.
            </Text>
          </div>
        ) : (
          <div className="flex" style={{ minHeight: "500px" }}>
            {/* ====== LEFT PANEL: Product List (40%) ====== */}
            <div className="w-[40%] border-r border-ui-border-base flex flex-col">
              {/* Search & Sort */}
              <div className="p-3 border-b border-ui-border-base bg-ui-bg-subtle">
                <div className="relative mb-2">
                  <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ui-fg-muted" />
                  <input
                    type="text"
                    className="w-full rounded-md border border-ui-border-base bg-ui-bg-field pl-8 pr-3 py-1.5 text-sm text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:ring-1 focus:ring-ui-border-interactive"
                    placeholder="Search products..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select size="small" value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                      <Select.Trigger className="w-full">
                        <Select.Value placeholder="Sort by" />
                      </Select.Trigger>
                      <Select.Content>
                        {SORT_OPTIONS.map((o) => (
                          <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Select size="small" value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                      <Select.Trigger className="w-full">
                        <Select.Value placeholder="Status" />
                      </Select.Trigger>
                      <Select.Content>
                        {STATUS_OPTIONS.map((o) => (
                          <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Product list */}
              <div className="flex-1 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <Text className="text-sm text-ui-fg-subtle">No products match your search.</Text>
                  </div>
                ) : (
                  filteredProducts.map((product) => (
                    <ProductListItem
                      key={product.product_id}
                      product={product}
                      selected={selectedProduct?.product_id === product.product_id}
                      onClick={() => setSelectedProductId(product.product_id)}
                    />
                  ))
                )}
              </div>

              {/* Product count footer */}
              <div className="px-3 py-2 border-t border-ui-border-base bg-ui-bg-subtle">
                <Text className="text-xs text-ui-fg-muted">
                  {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}
                  {search.trim() ? " (filtered)" : ""}
                </Text>
              </div>
            </div>

            {/* ====== RIGHT PANEL: Batch Details (60%) ====== */}
            <div className="w-[60%] flex flex-col">
              {selectedProduct ? (
                <>
                  {/* Product header */}
                  <div className="p-4 border-b border-ui-border-base bg-ui-bg-subtle">
                    <div className="flex items-start justify-between">
                      <div>
                        <Heading level="h2" className="text-lg">
                          {selectedProduct.product_title}
                        </Heading>
                        <div className="flex items-center gap-3 mt-1">
                          <Text className="text-sm text-ui-fg-subtle">
                            Total Stock: <span className={`font-semibold ${stockColor(selectedProduct)}`}>
                              {selectedProduct.total_stock}
                            </span>
                          </Text>
                          <Text className="text-sm text-ui-fg-subtle">
                            Batches: <span className="font-semibold">{selectedProduct.batch_count}</span>
                          </Text>
                          {selectedProduct.active_batches > 0 && (
                            <Badge color="green">{selectedProduct.active_batches} active</Badge>
                          )}
                          {selectedProduct.expired_batches > 0 && (
                            <Badge color="grey">{selectedProduct.expired_batches} expired</Badge>
                          )}
                          {selectedProduct.quarantined_batches > 0 && (
                            <Badge color="orange">{selectedProduct.quarantined_batches} quarantine</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Batch table */}
                  <div className="flex-1 overflow-y-auto">
                    {displayedBatches.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <Text className="text-sm text-ui-fg-subtle">
                          No batches match the current status filter.
                        </Text>
                      </div>
                    ) : (
                      <Table>
                        <Table.Header>
                          <Table.Row>
                            <Table.HeaderCell>Batch No.</Table.HeaderCell>
                            <Table.HeaderCell>Exp. Date</Table.HeaderCell>
                            <Table.HeaderCell className="text-right">Available</Table.HeaderCell>
                            <Table.HeaderCell className="text-right">Reserved</Table.HeaderCell>
                            <Table.HeaderCell>Status</Table.HeaderCell>
                            <Table.HeaderCell className="text-right">MRP</Table.HeaderCell>
                            <Table.HeaderCell>Supplier</Table.HeaderCell>
                            <Table.HeaderCell>Actions</Table.HeaderCell>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {displayedBatches.map((batch) => (
                            <Table.Row key={batch.id}>
                              <Table.Cell>
                                <div>
                                  <Text className="text-sm font-mono font-medium">
                                    {batch.lot_number || "\u2014"}
                                  </Text>
                                  {batch.grn_number && (
                                    <Text className="text-[11px] text-ui-fg-muted">
                                      GRN: {batch.grn_number}
                                    </Text>
                                  )}
                                </div>
                              </Table.Cell>
                              <Table.Cell>
                                <ExpiryBadge
                                  expiryDate={batch.expiry_date}
                                  daysToExpiry={batch.days_to_expiry}
                                />
                              </Table.Cell>
                              <Table.Cell className="text-right">
                                <Text className={`text-sm font-semibold ${
                                  batch.available_quantity <= 0
                                    ? "text-ui-fg-error"
                                    : batch.available_quantity <= 10
                                    ? "text-ui-tag-orange-text"
                                    : "text-ui-fg-base"
                                }`}>
                                  {batch.available_quantity}
                                </Text>
                              </Table.Cell>
                              <Table.Cell className="text-right">
                                <Text className="text-sm text-ui-fg-subtle">
                                  {batch.reserved_quantity}
                                </Text>
                              </Table.Cell>
                              <Table.Cell>
                                <Badge color={batchStatusColor(batch.status)}>
                                  {cap(batch.status)}
                                </Badge>
                              </Table.Cell>
                              <Table.Cell className="text-right">
                                <Text className="text-sm">
                                  {fmtCurrency(batch.batch_mrp_paise)}
                                </Text>
                              </Table.Cell>
                              <Table.Cell>
                                <Text className="text-sm text-ui-fg-subtle truncate max-w-[120px]" title={batch.supplier_name ?? undefined}>
                                  {batch.supplier_name || "\u2014"}
                                </Text>
                              </Table.Cell>
                              <Table.Cell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="secondary"
                                    size="small"
                                    onClick={() => openAdjustDrawer(batch)}
                                  >
                                    Adjust
                                  </Button>
                                  {batch.status === "active" && (
                                    <Button
                                      variant="danger"
                                      size="small"
                                      disabled={recalling === batch.id}
                                      onClick={() => handleRecall(batch)}
                                    >
                                      {recalling === batch.id ? "..." : "Recall"}
                                    </Button>
                                  )}
                                </div>
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table>
                    )}
                  </div>

                  {/* Batch count footer */}
                  <div className="px-4 py-2 border-t border-ui-border-base bg-ui-bg-subtle">
                    <Text className="text-xs text-ui-fg-muted">
                      Showing {displayedBatches.length} of {selectedProduct.batch_count} batch{selectedProduct.batch_count !== 1 ? "es" : ""}
                    </Text>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 py-16">
                  <ArchiveBox className="w-8 h-8 text-ui-fg-muted mb-2" />
                  <Text className="text-sm text-ui-fg-subtle">
                    Select a product to view batch details
                  </Text>
                </div>
              )}
            </div>
          </div>
        )}
      </Container>

      {/* Stock Adjustment Drawer */}
      <StockAdjustDrawer
        open={adjustDrawerOpen}
        onClose={() => { setAdjustDrawerOpen(false); setAdjustBatch(null) }}
        batch={adjustBatch}
        productTitle={selectedProduct?.product_title ?? ""}
        onSuccess={fetchReport}
      />

      {/* Import Batches Drawer */}
      <ImportBatchesDrawer
        open={importDrawerOpen}
        onClose={() => setImportDrawerOpen(false)}
        onSuccess={fetchReport}
      />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Batch Inventory",
  icon: ArchiveBox,
})

export default BatchInventoryPage
