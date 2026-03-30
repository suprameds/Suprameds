import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import {
  GlobeEuropeSolid,
  ArrowPath,
  ArrowUpTray,
  ArrowDownTray,
  MagnifyingGlass,
  CheckCircleSolid,
  XCircle,
} from "@medusajs/icons"
import { useCallback, useEffect, useRef, useState } from "react"
import { sdk } from "../../lib/client"
import {
  ImportProgressBar,
  type ImportProgressState,
  IDLE_IMPORT,
} from "../../components/import-progress-bar"

// ── Types ─────────────────────────────────────────────────────────────────────

type PincodeStats = {
  total_records: number
  delivery_pincodes: number
  unique_pincodes: number
  states_covered: number
}

type PincodeRecord = {
  id: string
  pincode: string
  officename: string
  officetype: string | null
  delivery: string
  district: string
  statename: string
  is_serviceable: boolean
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

const CHUNK_SIZE = 200

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split("\n").filter((l) => l.trim().length > 0)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i])
    if (vals.length < headers.length) continue
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = vals[j] ?? ""
    }
    rows.push(row)
  }
  return { headers, rows }
}

// ── Sub-components ────────────────────────────────────────────────────────────

const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-base">
    <Text className="text-xs text-ui-fg-subtle uppercase tracking-wide">{label}</Text>
    <Text className="text-2xl font-semibold mt-1">{value}</Text>
    {sub && <Text className="text-xs text-ui-fg-muted mt-0.5">{sub}</Text>}
  </div>
)

// ── Main page ─────────────────────────────────────────────────────────────────

const PincodesPage = () => {
  const [stats, setStats] = useState<PincodeStats | null>(null)
  const [records, setRecords] = useState<PincodeRecord[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [importProgress, setImportProgress] = useState<ImportProgressState>(IDLE_IMPORT)
  const [searchPincode, setSearchPincode] = useState("")
  const [searchState, setSearchState] = useState("")
  const [offset, setOffset] = useState(0)
  const limit = 50
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef(false)

  const fetchStats = useCallback(async () => {
    try {
      const json = await sdk.client.fetch<{ stats: PincodeStats }>("/admin/pincodes", { query: { stats_only: "true" } })
      setStats(json.stats)
    } catch {}
  }, [])

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const query: Record<string, string> = { limit: String(limit), offset: String(offset) }
      if (searchPincode.trim()) query.pincode = searchPincode.trim()
      if (searchState.trim()) query.state = searchState.trim()
      const json = await sdk.client.fetch<{ pincodes: PincodeRecord[]; count: number }>("/admin/pincodes", { query })
      setRecords(json.pincodes ?? [])
      setCount(json.count ?? 0)
    } catch {
      toast.error("Failed to load pincodes")
    } finally {
      setLoading(false)
    }
  }, [offset, searchPincode, searchState])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { fetchRecords() }, [fetchRecords])

  // ── Import handler ─────────────────────────────────────────────────────────

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith(".csv")) { toast.error("Please select a CSV file"); return }

    abortRef.current = false

    // Step 1: read file
    setImportProgress({
      ...IDLE_IMPORT,
      state: "reading",
      message: `Reading "${file.name}" (${(file.size / 1_048_576).toFixed(1)} MB)...`,
      percent: 2,
    })

    let rows: Record<string, string>[]
    try {
      const text = await file.text()
      const parsed = parseCSV(text)
      if (!parsed.headers.includes("pincode")) {
        setImportProgress({ ...IDLE_IMPORT, state: "error", message: "CSV must have a 'pincode' column" })
        return
      }
      rows = parsed.rows
    } catch (err: any) {
      setImportProgress({ ...IDLE_IMPORT, state: "error", message: `Could not read file: ${err.message}` })
      return
    }

    if (rows.length === 0) {
      setImportProgress({ ...IDLE_IMPORT, state: "error", message: "No data rows found in CSV" })
      return
    }

    // Step 2: split into chunks and upload sequentially
    const totalChunks = Math.ceil(rows.length / CHUNK_SIZE)
    let totalImported = 0
    let totalSkipped = 0

    setImportProgress({
      state: "uploading",
      message: `Uploading chunk 1 of ${totalChunks}...`,
      totalRows: rows.length,
      rowsSent: 0,
      rowsImported: 0,
      rowsSkipped: 0,
      rowsErrored: 0,
      percent: 5,
    })

    for (let i = 0; i < totalChunks; i++) {
      if (abortRef.current) {
        setImportProgress((p) => ({ ...p, state: "error", message: "Import cancelled by user" }))
        break
      }

      const chunk = rows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      const rowsSentSoFar = Math.min((i + 1) * CHUNK_SIZE, rows.length)
      const progressPercent = Math.round(5 + ((i + 1) / totalChunks) * 90)

      try {
        const json = await sdk.client.fetch<{ imported?: number; skipped?: number; message?: string }>("/admin/pincodes/import", {
          method: "POST",
          body: {
            rows: chunk,
            mode: i === 0 ? "replace" : "append",
            chunk_index: i,
            total_chunks: totalChunks,
          },
        })

        totalImported += json.imported ?? 0
        totalSkipped += json.skipped ?? 0

        // Brief pause between chunks to let managed Redis recover
        if (i + 1 < totalChunks) {
          await new Promise((r) => setTimeout(r, 1500))
        }

        setImportProgress({
          state: "uploading",
          message: `Uploading batch ${i + 2} of ${totalChunks}...`,
          totalRows: rows.length,
          rowsSent: rowsSentSoFar,
          rowsImported: totalImported,
          rowsSkipped: totalSkipped,
          rowsErrored: 0,
          percent: i + 1 === totalChunks ? 99 : progressPercent,
        })
      } catch (err: any) {
        setImportProgress((p) => ({
          ...p,
          state: "error",
          message: `Batch ${i + 1} failed: ${err.message}. ${totalImported.toLocaleString()} rows were saved before failure.`,
          percent: progressPercent,
        }))
        if (fileInputRef.current) fileInputRef.current.value = ""
        return
      }
    }

    // Done
    setImportProgress({
      state: "done",
      message: `All done! ${totalImported.toLocaleString()} pincodes imported, ${totalSkipped.toLocaleString()} skipped.`,
      totalRows: rows.length,
      rowsSent: rows.length,
      rowsImported: totalImported,
      rowsSkipped: totalSkipped,
      rowsErrored: 0,
      percent: 100,
    })

    toast.success(`Import complete — ${totalImported.toLocaleString()} pincodes loaded`)
    fetchStats()
    fetchRecords()
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // ── Export handler ─────────────────────────────────────────────────────────

  const handleExport = async () => {
    toast.info("Export started...")
    try {
      let allRecords: PincodeRecord[] = []
      let exportOffset = 0
      while (true) {
        const json = await sdk.client.fetch<{ pincodes: PincodeRecord[] }>("/admin/pincodes", { query: { limit: "200", offset: String(exportOffset) } })
        const batch = json.pincodes ?? []
        allRecords = [...allRecords, ...batch]
        if (batch.length < 200) break
        exportOffset += 200
      }
      const header = "pincode,officename,officetype,delivery,district,statename,is_serviceable"
      const csvRows = allRecords.map((r) =>
        [r.pincode, `"${r.officename}"`, r.officetype || "", r.delivery, `"${r.district}"`, r.statename, r.is_serviceable].join(",")
      )
      const blob = new Blob([[header, ...csvRows].join("\n")], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `pincodes-export-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Exported ${allRecords.length.toLocaleString()} records`)
    } catch (err: any) {
      toast.error("Export failed", { description: err.message })
    }
  }

  const isImporting = importProgress.state === "reading" || importProgress.state === "uploading"
  const totalPages = Math.ceil(count / limit)
  const currentPage = Math.floor(offset / limit) + 1

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <Container className="p-6">
        <Heading level="h1" className="mb-2">Pincode Serviceability</Heading>
        <Text className="text-ui-fg-subtle">
          Manage delivery pincodes from India Post Office data. Import a CSV to update the serviceability list.
        </Text>
      </Container>

      {/* Stats */}
      <Container className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Records" value={stats?.total_records?.toLocaleString() ?? "—"} sub="Post offices in database" />
          <StatCard label="Delivery Pincodes" value={stats?.delivery_pincodes?.toLocaleString() ?? "—"} sub="Marked as serviceable" />
          <StatCard label="Unique Pincodes" value={stats?.unique_pincodes?.toLocaleString() ?? "—"} />
          <StatCard label="States Covered" value={stats?.states_covered ?? "—"} sub="States & union territories" />
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 items-center">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <Button
            variant="primary"
            size="small"
            disabled={isImporting}
            onClick={() => fileInputRef.current?.click()}
          >
            <ArrowUpTray />
            {isImporting ? "Importing..." : "Import CSV"}
          </Button>
          <Button
            variant="secondary"
            size="small"
            disabled={!stats?.total_records || isImporting}
            onClick={handleExport}
          >
            <ArrowDownTray />
            Export CSV
          </Button>
          <Button
            variant="secondary"
            size="small"
            disabled={isImporting}
            onClick={() => { fetchStats(); fetchRecords() }}
          >
            <ArrowPath />
            Refresh
          </Button>
          {isImporting && (
            <Button
              variant="danger"
              size="small"
              onClick={() => { abortRef.current = true }}
            >
              <XCircle />
              Cancel
            </Button>
          )}
          {importProgress.state === "done" && (
            <Button
              variant="secondary"
              size="small"
              onClick={() => setImportProgress(IDLE_IMPORT)}
            >
              <CheckCircleSolid />
              Dismiss
            </Button>
          )}
        </div>

        {/* Progress bar — shown whenever import is active or just finished */}
        <ImportProgressBar progress={importProgress} />

        {/* Hint text when idle */}
        {importProgress.state === "idle" && (
          <Text className="text-xs text-ui-fg-muted mt-3">
            CSV columns expected: <code>circlename, regionname, divisionname, officename, pincode, officetype, delivery, district, statename, latitude, longitude</code>
          </Text>
        )}
      </Container>

      {/* Search + Table */}
      <Container className="p-6">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="w-[180px]">
            <Text className="text-xs text-ui-fg-subtle mb-1">Pincode</Text>
            <Input
              placeholder="e.g. 500001"
              value={searchPincode}
              onChange={(e) => { setSearchPincode(e.target.value); setOffset(0) }}
              onKeyDown={(e) => { if (e.key === "Enter") fetchRecords() }}
            />
          </div>
          <div className="w-[200px]">
            <Text className="text-xs text-ui-fg-subtle mb-1">State</Text>
            <Input
              placeholder="e.g. TELANGANA"
              value={searchState}
              onChange={(e) => { setSearchState(e.target.value); setOffset(0) }}
              onKeyDown={(e) => { if (e.key === "Enter") fetchRecords() }}
            />
          </div>
          <Button variant="secondary" size="small" onClick={() => { setOffset(0); fetchRecords() }}>
            <MagnifyingGlass />
            Search
          </Button>
        </div>

        {loading ? (
          <Text className="text-ui-fg-subtle p-4">Loading...</Text>
        ) : records.length === 0 ? (
          <div className="text-center py-12">
            <GlobeEuropeSolid className="w-10 h-10 text-ui-fg-muted mx-auto mb-3" />
            <Text className="text-ui-fg-subtle">
              {stats?.total_records === 0
                ? "No pincodes imported yet. Upload a CSV to get started."
                : "No records match your search."}
            </Text>
          </div>
        ) : (
          <>
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Pincode</Table.HeaderCell>
                  <Table.HeaderCell>Office Name</Table.HeaderCell>
                  <Table.HeaderCell>Type</Table.HeaderCell>
                  <Table.HeaderCell>Delivery</Table.HeaderCell>
                  <Table.HeaderCell>District</Table.HeaderCell>
                  <Table.HeaderCell>State</Table.HeaderCell>
                  <Table.HeaderCell>Serviceable</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {records.map((rec) => (
                  <Table.Row key={rec.id}>
                    <Table.Cell>
                      <Text className="text-sm font-mono font-medium">{rec.pincode}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text className="text-sm">{rec.officename}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text className="text-sm text-ui-fg-subtle">{rec.officetype || "—"}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={rec.delivery === "Delivery" ? "green" : "grey"}>{rec.delivery}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text className="text-sm">{rec.district}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text className="text-sm">{rec.statename}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      {rec.is_serviceable ? (
                        <Badge color="green">Yes</Badge>
                      ) : (
                        <Badge color="grey">No</Badge>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <Text className="text-xs text-ui-fg-subtle">
                Showing {offset + 1}–{Math.min(offset + limit, count)} of {count.toLocaleString()}
              </Text>
              <div className="flex gap-2 items-center">
                <Button variant="secondary" size="small" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
                  Previous
                </Button>
                <Text className="text-sm text-ui-fg-subtle">
                  Page {currentPage} / {totalPages}
                </Text>
                <Button variant="secondary" size="small" disabled={offset + limit >= count} onClick={() => setOffset(offset + limit)}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Pincodes",
  icon: GlobeEuropeSolid,
})

export default PincodesPage
