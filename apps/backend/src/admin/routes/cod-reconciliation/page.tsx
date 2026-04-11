import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  Heading,
  Table,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { CurrencyDollar } from "@medusajs/icons"
import { useState } from "react"
import { sdk } from "../../lib/client"

/* ================================================================
   TYPES
   ================================================================ */

type ParsedRow = {
  order_id: string
  amount_collected?: number
  collection_date?: string
}

type ReconcileResult = {
  order_id: string
  status: string
  message?: string
}

type ReconcileResponse = {
  processed: number
  skipped: number
  errors: number
  details: ReconcileResult[]
}

/* ================================================================
   CSV PARSER
   ================================================================ */

function parseCsv(raw: string): ParsedRow[] {
  const lines = raw
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length < 2) return []

  // Detect header row
  const header = lines[0].toLowerCase()
  const cols = header.split(",").map((c) => c.trim())

  const orderIdIdx = cols.findIndex(
    (c) =>
      c === "order_id" || c === "order id" || c === "tracking_number" || c === "tracking"
  )
  const amountIdx = cols.findIndex(
    (c) => c === "amount" || c === "amount_collected" || c === "cod_amount"
  )
  const dateIdx = cols.findIndex(
    (c) =>
      c === "date" ||
      c === "collection_date" ||
      c === "collected_date" ||
      c === "delivery_date"
  )

  if (orderIdIdx === -1) return []

  const rows: ParsedRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim())
    const orderId = values[orderIdIdx]
    if (!orderId) continue

    const row: ParsedRow = { order_id: orderId }
    if (amountIdx !== -1 && values[amountIdx]) {
      const num = parseFloat(values[amountIdx])
      if (!isNaN(num)) row.amount_collected = num
    }
    if (dateIdx !== -1 && values[dateIdx]) {
      row.collection_date = values[dateIdx]
    }
    rows.push(row)
  }

  return rows
}

/* ================================================================
   STATUS HELPERS
   ================================================================ */

const STATUS_BADGE: Record<string, "green" | "orange" | "red" | "grey"> = {
  collected: "green",
  already_collected: "grey",
  not_found: "orange",
  error: "red",
}

/* ================================================================
   PAGE COMPONENT
   ================================================================ */

const CodReconciliationPage = () => {
  const [csvText, setCsvText] = useState("")
  const [parsed, setParsed] = useState<ParsedRow[]>([])
  const [reconciling, setReconciling] = useState(false)
  const [results, setResults] = useState<ReconcileResponse | null>(null)

  const handleParse = () => {
    const rows = parseCsv(csvText)
    if (rows.length === 0) {
      toast.error("No valid rows found", {
        description:
          "CSV must have a header row with order_id (or tracking_number) column.",
      })
      return
    }
    setParsed(rows)
    setResults(null)
    toast.success(`Parsed ${rows.length} row(s)`)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvText(text)
      const rows = parseCsv(text)
      setParsed(rows)
      setResults(null)
      if (rows.length > 0) {
        toast.success(`Loaded ${rows.length} row(s) from ${file.name}`)
      } else {
        toast.error("No valid rows found in file")
      }
    }
    reader.readAsText(file)
  }

  const handleReconcile = async () => {
    if (!parsed.length) return
    setReconciling(true)
    setResults(null)

    try {
      const res = await sdk.client.fetch<ReconcileResponse>(
        `/admin/pharma/cod/reconcile`,
        {
          method: "POST",
          body: { orders: parsed },
        }
      )
      setResults(res)
      toast.success(
        `Reconciled: ${res.processed} processed, ${res.skipped} skipped, ${res.errors} errors`
      )
    } catch (err: any) {
      toast.error("Reconciliation failed", {
        description: err?.message || "Unknown error",
      })
    } finally {
      setReconciling(false)
    }
  }

  const handleClear = () => {
    setCsvText("")
    setParsed([])
    setResults(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <Container className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h1">COD Reconciliation</Heading>
            <Text className="text-ui-fg-subtle mt-1">
              Upload India Post COD collection report to reconcile payments in
              bulk.
            </Text>
          </div>
          {parsed.length > 0 && (
            <Button variant="secondary" size="small" onClick={handleClear}>
              Clear
            </Button>
          )}
        </div>
      </Container>

      {/* CSV Input */}
      <Container className="p-6">
        <Heading level="h2" className="mb-4">
          Upload or Paste CSV
        </Heading>
        <Text className="text-ui-fg-subtle text-sm mb-3">
          CSV must include a header row with <code>order_id</code> (or{" "}
          <code>tracking_number</code>) column. Optional columns:{" "}
          <code>amount</code>, <code>collection_date</code>.
        </Text>

        <div className="flex gap-3 mb-4">
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button variant="secondary" size="small" asChild>
              <span>Upload CSV File</span>
            </Button>
          </label>
        </div>

        <Textarea
          placeholder={`order_id,amount,collection_date\nord_01ABC123,1250,2026-04-05\nord_01DEF456,890,2026-04-06`}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={8}
          className="font-mono text-sm"
        />

        <div className="flex justify-end mt-3">
          <Button
            variant="primary"
            size="small"
            onClick={handleParse}
            disabled={!csvText.trim()}
          >
            Parse CSV
          </Button>
        </div>
      </Container>

      {/* Preview Table */}
      {parsed.length > 0 && !results && (
        <Container className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Heading level="h2">
              Preview ({parsed.length} order{parsed.length !== 1 ? "s" : ""})
            </Heading>
            <Button
              variant="primary"
              size="small"
              onClick={handleReconcile}
              disabled={reconciling}
            >
              {reconciling
                ? "Reconciling..."
                : `Reconcile ${parsed.length} Order${parsed.length !== 1 ? "s" : ""}`}
            </Button>
          </div>

          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>#</Table.HeaderCell>
                <Table.HeaderCell>Order ID</Table.HeaderCell>
                <Table.HeaderCell>Amount</Table.HeaderCell>
                <Table.HeaderCell>Collection Date</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {parsed.map((row, idx) => (
                <Table.Row key={idx}>
                  <Table.Cell>{idx + 1}</Table.Cell>
                  <Table.Cell className="font-mono text-sm">
                    {row.order_id}
                  </Table.Cell>
                  <Table.Cell>
                    {row.amount_collected != null
                      ? `₹${row.amount_collected}`
                      : "—"}
                  </Table.Cell>
                  <Table.Cell>{row.collection_date || "—"}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Container>
      )}

      {/* Results */}
      {results && (
        <Container className="p-6">
          <Heading level="h2" className="mb-4">
            Reconciliation Results
          </Heading>

          {/* Summary badges */}
          <div className="flex gap-3 mb-4">
            <Badge color="green">{results.processed} Processed</Badge>
            <Badge color="grey">{results.skipped} Skipped</Badge>
            {results.errors > 0 && (
              <Badge color="red">{results.errors} Errors</Badge>
            )}
          </div>

          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Order ID</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Details</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {results.details.map((detail, idx) => (
                <Table.Row key={idx}>
                  <Table.Cell className="font-mono text-sm">
                    {detail.order_id}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={STATUS_BADGE[detail.status] || "grey"}>
                      {detail.status.replace(/_/g, " ")}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm text-ui-fg-subtle">
                      {detail.message || "—"}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Container>
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "COD Reconciliation",
  icon: CurrencyDollar,
})

export default CodReconciliationPage
