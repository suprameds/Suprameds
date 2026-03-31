import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CommandLineSolid, XCircle, CheckCircleSolid } from "@medusajs/icons"
import { Container, Heading, Input, Label, Select, Button, Textarea, Switch, toast, Text } from "@medusajs/ui"
import { useRef, useState } from "react"
import { sdk } from "../../../lib/client"
import {
  ImportProgressBar,
  type ImportProgressState,
  IDLE_IMPORT,
} from "../../../components/import-progress-bar"

// ── CSV helpers ────────────────────────────────────────────────────────────
function parseImportLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === "," && !inQuotes) {
      result.push(current); current = ""
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseImportCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split("\n")
  if (lines.length < 2) return []
  const headers = parseImportLine(lines[0]).map((h) => h.trim())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseImportLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = (values[idx] || "").trim() })
    if (row.brand_name) rows.push(row)
  }
  return rows
}

type FormData = {
  brand_name: string
  generic_name: string
  composition: string
  strength: string
  dosage_form: string
  pack_size: string
  unit_type: string
  schedule: string
  therapeutic_class: string
  description: string
  selling_price: string
  mrp: string
  gst_rate: string
  hsn_code: string
  stock_qty: string
  manufacturer: string
  indications: string
  contraindications: string
  side_effects: string
  storage_instructions: string
  dosage_instructions: string
  is_chronic: boolean
  habit_forming: boolean
  requires_refrigeration: boolean
}

const INITIAL: FormData = {
  brand_name: "",
  generic_name: "",
  composition: "",
  strength: "",
  dosage_form: "tablet",
  pack_size: "",
  unit_type: "strip",
  schedule: "OTC",
  therapeutic_class: "",
  description: "",
  selling_price: "",
  mrp: "",
  gst_rate: "12",
  hsn_code: "",
  stock_qty: "50",
  manufacturer: "",
  indications: "",
  contraindications: "",
  side_effects: "",
  storage_instructions: "Store below 30°C in a dry place",
  dosage_instructions: "",
  is_chronic: false,
  habit_forming: false,
  requires_refrigeration: false,
}

const DOSAGE_FORMS = [
  { value: "tablet", label: "Tablet" },
  { value: "capsule", label: "Capsule" },
  { value: "syrup", label: "Syrup" },
  { value: "suspension", label: "Suspension" },
  { value: "cream", label: "Cream / Ointment" },
  { value: "drops", label: "Drops" },
  { value: "injection", label: "Injection" },
  { value: "inhaler", label: "Inhaler" },
  { value: "patch", label: "Patch" },
  { value: "other", label: "Other" },
]

const UNIT_TYPES = [
  { value: "strip", label: "Strip" },
  { value: "bottle", label: "Bottle" },
  { value: "tube", label: "Tube" },
  { value: "box", label: "Box" },
  { value: "sachet", label: "Sachet" },
  { value: "vial", label: "Vial" },
  { value: "ampoule", label: "Ampoule" },
  { value: "tablet", label: "Tablet (loose)" },
]

const SCHEDULES = [
  { value: "OTC", label: "OTC — Over the Counter" },
  { value: "H", label: "Schedule H — Rx Required" },
  { value: "H1", label: "Schedule H1 — Strict Rx" },
  { value: "X", label: "Schedule X — Prohibited Online" },
]

const GST_RATES = [
  { value: "0", label: "0% (Exempt)" },
  { value: "5", label: "5% (Life-saving drugs)" },
  { value: "12", label: "12% (Standard pharma)" },
  { value: "18", label: "18% (OTC / Devices)" },
]

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

const CreateMedicinePage = () => {
  const [form, setForm] = useState<FormData>({ ...INITIAL })
  const [submitting, setSubmitting] = useState(false)

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.brand_name || !form.generic_name || !form.selling_price) {
      toast.error("Brand name, generic name, and selling price are required.")
      return
    }

    setSubmitting(true)
    try {
      const handle = slugify(form.brand_name)
      const sku = `SUPRA-${handle.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`.slice(0, 48)

      // Create the Medusa product via Admin API
      const { product } = await sdk.admin.product.create({
        title: form.brand_name,
        handle,
        description: form.description || `${form.brand_name} — ${form.composition}`,
        status: "draft",
        options: [{ title: "Pack", values: ["default"] }],
        variants: [
          {
            title: form.brand_name,
            sku,
            options: { Pack: "default" },
            prices: [
              { currency_code: "inr", amount: Number(form.selling_price) || 1 },
            ],
            manage_inventory: true,
            allow_backorder: false,
          },
        ],
        metadata: {
          source: "admin-create-medicine",
          pharma: true,
          manufacturer: form.manufacturer || null,
        },
      })

      // Create pharma metadata via custom API
      await sdk.client.fetch("/admin/pharma/drug-products", {
        method: "POST",
        body: {
          product_id: product.id,
          schedule: form.schedule,
          generic_name: form.generic_name,
          composition: form.composition || null,
          strength: form.strength || null,
          dosage_form: form.dosage_form,
          pack_size: form.pack_size || null,
          unit_type: form.unit_type,
          therapeutic_class: form.therapeutic_class || null,
          gst_rate: Number(form.gst_rate) || 12,
          hsn_code: form.hsn_code || null,
          manufacturer_license: null,
          mrp_paise: form.mrp ? Number(form.mrp) * 100 : null,
          indications: form.indications || null,
          contraindications: form.contraindications || null,
          side_effects: form.side_effects || null,
          storage_instructions: form.storage_instructions || null,
          dosage_instructions: form.dosage_instructions || null,
          is_chronic: form.is_chronic,
          habit_forming: form.habit_forming,
          requires_refrigeration: form.requires_refrigeration,
          is_narcotic: false,
        },
      })

      toast.success(`Medicine "${form.brand_name}" created successfully!`)
      setForm({ ...INITIAL })
    } catch (err: any) {
      const msg = err?.message || err?.body?.message || "Failed to create medicine"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Import / Export ──────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortImport = useRef(false)
  const [importProgress, setImportProgress] = useState<ImportProgressState>(IDLE_IMPORT)
  const [importResults, setImportResults] = useState<
    { brand_name: string; status: string; message?: string }[]
  >([])

  const handleDownloadTemplate = () => {
    const headers = "brand_name,generic_name,composition,strength,dosage_form,pack_size,unit_type,schedule,therapeutic_class,category,collection,selling_price_inr,mrp_inr,gst_rate,hsn_code,stock_qty,manufacturer,manufacturer_license,description,indications,contraindications,side_effects,storage_instructions,dosage_instructions,is_chronic,habit_forming,requires_refrigeration,is_narcotic,tags"
    const sample = 'Paracetamol 500mg Tablets,Paracetamol,Paracetamol 500mg,500mg,tablet,10 tablets,strip,OTC,Analgesic / Antipyretic,pain-fever,,15,35,12,30049099,100,Cipla Ltd,,Paracetamol for pain and fever,Pain relief and fever,Liver disease,"Nausea, rash",Store below 30°C,1-2 tablets every 4-6 hours,false,false,false,false,otc'
    const csv = headers + "\n" + sample
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "pharma-product-import-template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const response = await sdk.client.fetch<Response>("/admin/pharma/export", {
        headers: { accept: "text/csv" },
      })
      const csvText = await response.text()
      const blob = new Blob([csvText], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `suprameds-products-export-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Products exported successfully!")
    } catch {
      toast.error("Failed to export products")
    } finally {
      setExporting(false)
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    abortImport.current = false
    setImportResults([])

    // Step 1: read and parse CSV in-browser
    setImportProgress({
      ...IDLE_IMPORT,
      state: "reading",
      message: `Reading "${file.name}"...`,
      percent: 2,
    })

    let rows: Record<string, string>[]
    try {
      const text = await file.text()
      rows = parseImportCSV(text)
    } catch (err: any) {
      setImportProgress({ ...IDLE_IMPORT, state: "error", message: `Could not read file: ${err.message}` })
      return
    }

    if (rows.length === 0) {
      setImportProgress({ ...IDLE_IMPORT, state: "error", message: "No valid rows found (check that 'brand_name' column exists)" })
      return
    }

    // Step 2: send one product at a time so we can show per-product progress
    let created = 0
    let skipped = 0
    let errored = 0
    const allResults: { brand_name: string; status: string; message?: string }[] = []

    for (let i = 0; i < rows.length; i++) {
      if (abortImport.current) {
        setImportProgress((p) => ({ ...p, state: "error", message: `Cancelled after ${i} rows. ${created} products were created.` }))
        break
      }

      const row = rows[i]
      const percent = Math.round(5 + ((i + 1) / rows.length) * 90)

      setImportProgress({
        state: "uploading",
        message: `Creating "${row.brand_name}" (${i + 1} of ${rows.length})...`,
        totalRows: rows.length,
        rowsSent: i + 1,
        rowsImported: created,
        rowsSkipped: skipped,
        rowsErrored: errored,
        percent: i + 1 === rows.length ? 99 : percent,
      })

      try {
        const result = await sdk.client.fetch<{
          summary: { created: number; skipped: number; errors: number }
          results: { brand_name: string; status: string; message?: string }[]
        }>("/admin/pharma/import", {
          method: "POST",
          body: { rows: [row], row_index: i, total_rows: rows.length },
        })

        const r = result?.results?.[0]
        if (r) {
          allResults.push(r)
          if (r.status === "created") created++
          else if (r.status === "skipped") skipped++
          else errored++
        }
      } catch (err: any) {
        const errMsg = err?.message || "Unknown error"
        allResults.push({ brand_name: row.brand_name, status: "error", message: errMsg })
        errored++
      }
    }

    // Final state
    setImportResults(allResults)
    setImportProgress({
      state: errored > 0 ? "error" : "done",
      message: `Done: ${created} created, ${skipped} skipped, ${errored} errors.`,
      totalRows: rows.length,
      rowsSent: rows.length,
      rowsImported: created,
      rowsSkipped: skipped,
      rowsErrored: errored,
      percent: 100,
    })

    if (errored === 0) {
      toast.success(`Imported ${created} products, ${skipped} skipped`)
    } else {
      toast.error(`${created} created, ${errored} errors — check details below`)
    }

    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h1">Create Medicine</Heading>
          <p className="text-ui-fg-subtle mt-1">
            Add a new pharmaceutical product with drug metadata, pricing, and compliance info.
          </p>
        </div>
      </div>

      {/* ── Import / Export Section ── */}
      <Container>
        <Heading level="h2" className="mb-2">Bulk Import & Export</Heading>
        <Text className="text-ui-fg-subtle mb-4">
          Import medicines from a CSV file or export your existing catalog. Each product is imported
          individually so you get live per-product progress.
        </Text>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={handleDownloadTemplate}>
            Download Template
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportFile}
            className="hidden"
          />
          <Button
            variant="primary"
            disabled={importProgress.state === "reading" || importProgress.state === "uploading"}
            onClick={() => fileInputRef.current?.click()}
          >
            {importProgress.state === "reading" || importProgress.state === "uploading"
              ? "Importing..."
              : "Import CSV"}
          </Button>
          {(importProgress.state === "reading" || importProgress.state === "uploading") && (
            <Button variant="danger" size="small" onClick={() => { abortImport.current = true }}>
              <XCircle /> Cancel
            </Button>
          )}
          {importProgress.state === "done" && (
            <Button variant="secondary" size="small" onClick={() => { setImportProgress(IDLE_IMPORT); setImportResults([]) }}>
              <CheckCircleSolid /> Dismiss
            </Button>
          )}
          <Button variant="secondary" disabled={exporting} onClick={handleExport}>
            {exporting ? "Exporting..." : "Export Products"}
          </Button>
        </div>

        {/* Live progress bar */}
        <ImportProgressBar progress={importProgress} />

        {/* Per-row results table — live-updating as rows complete */}
        {importResults.length > 0 && (
          <div className="mt-4 p-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle">
            <Text className="font-semibold mb-2 text-sm">
              Import Results — {importResults.filter((r) => r.status === "created").length} created,{" "}
              {importResults.filter((r) => r.status === "skipped").length} skipped,{" "}
              {importResults.filter((r) => r.status === "error").length} errors
            </Text>
            <div className="max-h-64 overflow-y-auto rounded border border-ui-border-base">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-ui-bg-subtle-hover">
                  <tr className="border-b">
                    <th className="text-left py-1.5 px-3">Product</th>
                    <th className="text-left py-1.5 px-3">Status</th>
                    <th className="text-left py-1.5 px-3">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {importResults.map((r, i) => (
                    <tr key={i} className="border-b border-ui-border-base last:border-0 hover:bg-ui-bg-subtle-hover">
                      <td className="py-1.5 px-3">{r.brand_name}</td>
                      <td className="py-1.5 px-3">
                        <span
                          style={{
                            color:
                              r.status === "created" ? "#22C55E"
                              : r.status === "error" ? "#EF4444"
                              : "#6B7280",
                          }}
                          className="text-xs font-semibold uppercase"
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-ui-fg-subtle text-xs">{r.message || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Container>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">

        {/* ── Drug Identity ── */}
        <Container>
          <Heading level="h2" className="mb-4">Drug Identity</Heading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="brand_name">Brand / Product Name *</Label>
              <Input
                id="brand_name"
                placeholder="e.g. Paracetamol 500mg Tablets"
                value={form.brand_name}
                onChange={(e) => set("brand_name", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="generic_name">Generic (INN) Name *</Label>
              <Input
                id="generic_name"
                placeholder="e.g. Paracetamol"
                value={form.generic_name}
                onChange={(e) => set("generic_name", e.target.value)}
                required
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="composition">Composition</Label>
              <Input
                id="composition"
                placeholder="e.g. Paracetamol 500mg + Caffeine 65mg"
                value={form.composition}
                onChange={(e) => set("composition", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="strength">Strength</Label>
              <Input
                id="strength"
                placeholder="e.g. 500mg, 250mg/5ml"
                value={form.strength}
                onChange={(e) => set("strength", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                placeholder="e.g. Cipla Ltd"
                value={form.manufacturer}
                onChange={(e) => set("manufacturer", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="therapeutic_class">Therapeutic Class</Label>
              <Input
                id="therapeutic_class"
                placeholder="e.g. Analgesic, Antibiotic, Antidiabetic"
                value={form.therapeutic_class}
                onChange={(e) => set("therapeutic_class", e.target.value)}
              />
            </div>
          </div>
        </Container>

        {/* ── Dosage & Packaging ── */}
        <Container>
          <Heading level="h2" className="mb-4">Dosage & Packaging</Heading>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="dosage_form">Dosage Form</Label>
              <Select value={form.dosage_form} onValueChange={(v) => set("dosage_form", v)}>
                <Select.Trigger>
                  <Select.Value placeholder="Select form" />
                </Select.Trigger>
                <Select.Content>
                  {DOSAGE_FORMS.map((f) => (
                    <Select.Item key={f.value} value={f.value}>{f.label}</Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <div>
              <Label htmlFor="pack_size">Pack Size</Label>
              <Input
                id="pack_size"
                placeholder="e.g. 10 tablets, 100ml bottle"
                value={form.pack_size}
                onChange={(e) => set("pack_size", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="unit_type">Unit Type</Label>
              <Select value={form.unit_type} onValueChange={(v) => set("unit_type", v)}>
                <Select.Trigger>
                  <Select.Value placeholder="Select unit" />
                </Select.Trigger>
                <Select.Content>
                  {UNIT_TYPES.map((u) => (
                    <Select.Item key={u.value} value={u.value}>{u.label}</Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
          </div>
        </Container>

        {/* ── Schedule & Compliance ── */}
        <Container>
          <Heading level="h2" className="mb-4">Schedule & Compliance</Heading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="schedule">Drug Schedule *</Label>
              <Select value={form.schedule} onValueChange={(v) => set("schedule", v)}>
                <Select.Trigger>
                  <Select.Value placeholder="Select schedule" />
                </Select.Trigger>
                <Select.Content>
                  {SCHEDULES.map((s) => (
                    <Select.Item key={s.value} value={s.value}>{s.label}</Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <div>
              <Label htmlFor="hsn_code">HSN Code</Label>
              <Input
                id="hsn_code"
                placeholder="e.g. 30049099"
                value={form.hsn_code}
                onChange={(e) => set("hsn_code", e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_chronic} onCheckedChange={(v) => set("is_chronic", v)} />
              <Label>Chronic medication (enable reorder reminders)</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.habit_forming} onCheckedChange={(v) => set("habit_forming", v)} />
              <Label>Habit-forming</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.requires_refrigeration} onCheckedChange={(v) => set("requires_refrigeration", v)} />
              <Label>Requires refrigeration (blocks listing)</Label>
            </div>
          </div>
        </Container>

        {/* ── Pricing & Inventory ── */}
        <Container>
          <Heading level="h2" className="mb-4">Pricing & Inventory</Heading>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="selling_price">Selling Price (₹) *</Label>
              <Input
                id="selling_price"
                type="number"
                min="0"
                placeholder="e.g. 15"
                value={form.selling_price}
                onChange={(e) => set("selling_price", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="mrp">MRP (₹)</Label>
              <Input
                id="mrp"
                type="number"
                min="0"
                placeholder="e.g. 35"
                value={form.mrp}
                onChange={(e) => set("mrp", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="gst_rate">GST Rate</Label>
              <Select value={form.gst_rate} onValueChange={(v) => set("gst_rate", v)}>
                <Select.Trigger>
                  <Select.Value placeholder="Select GST" />
                </Select.Trigger>
                <Select.Content>
                  {GST_RATES.map((g) => (
                    <Select.Item key={g.value} value={g.value}>{g.label}</Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <div>
              <Label htmlFor="stock_qty">Initial Stock</Label>
              <Input
                id="stock_qty"
                type="number"
                min="0"
                placeholder="50"
                value={form.stock_qty}
                onChange={(e) => set("stock_qty", e.target.value)}
              />
            </div>
          </div>
        </Container>

        {/* ── Clinical Information ── */}
        <Container>
          <Heading level="h2" className="mb-4">Clinical Information</Heading>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="description">Product Description</Label>
              <Textarea
                id="description"
                placeholder="Detailed product description for the storefront"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="indications">Indications (Uses)</Label>
                <Textarea
                  id="indications"
                  placeholder="e.g. Pain relief and fever reduction"
                  value={form.indications}
                  onChange={(e) => set("indications", e.target.value)}
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="contraindications">Contraindications</Label>
                <Textarea
                  id="contraindications"
                  placeholder="e.g. Liver disease; Alcohol dependence"
                  value={form.contraindications}
                  onChange={(e) => set("contraindications", e.target.value)}
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="side_effects">Side Effects</Label>
                <Textarea
                  id="side_effects"
                  placeholder="e.g. Nausea, drowsiness, skin rash"
                  value={form.side_effects}
                  onChange={(e) => set("side_effects", e.target.value)}
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="dosage_instructions">Dosage Instructions</Label>
                <Textarea
                  id="dosage_instructions"
                  placeholder="e.g. 1-2 tablets every 4-6 hours"
                  value={form.dosage_instructions}
                  onChange={(e) => set("dosage_instructions", e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="storage_instructions">Storage Instructions</Label>
              <Input
                id="storage_instructions"
                placeholder="e.g. Store below 30°C in a dry place"
                value={form.storage_instructions}
                onChange={(e) => set("storage_instructions", e.target.value)}
              />
            </div>
          </div>
        </Container>

        {/* ── Image Guidelines ── */}
        <Container>
          <Heading level="h2" className="mb-2">Product Image</Heading>
          <Text className="text-ui-fg-subtle text-sm mb-3">
            Upload product images after creation via the product detail page.
          </Text>
          <div className="bg-ui-bg-subtle rounded-lg p-3 text-xs text-ui-fg-muted space-y-1">
            <p className="font-semibold text-ui-fg-base">Image Guidelines:</p>
            <p>Recommended: <strong>800 x 800px</strong> (square, 1:1 ratio)</p>
            <p>Min: 400 x 400px, Max: 2000 x 2000px</p>
            <p>Format: PNG or JPG, max <strong>2MB</strong></p>
            <p>Background: white or transparent preferred</p>
            <p className="text-amber-600 mt-2">
              Per Drugs & Magic Remedies Act 1954 — no lifestyle or model images.
              Use product packaging photos only.
            </p>
          </div>
        </Container>

        {/* ── Submit ── */}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            variant="primary"
            isLoading={submitting}
            disabled={submitting}
          >
            Create Medicine
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setForm({ ...INITIAL })}
            disabled={submitting}
          >
            Reset
          </Button>
        </div>
      </form>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Create Medicine",
  icon: CommandLineSolid,
})

export default CreateMedicinePage
