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
import { ArrowPath, ArrowDownTray, DocumentText } from "@medusajs/icons"
import { useCallback, useEffect, useState } from "react"
import { sdk } from "../../lib/client"

// ── Types ────────────────────────────────────────────────────────────────────

type H1Entry = {
  id: string
  entry_date: string
  patient_name: string
  patient_address: string | null
  patient_age: string | null
  prescriber_name: string
  prescriber_reg_no: string
  drug_name: string
  brand_name: string | null
  batch_number: string
  quantity_dispensed: number
  dispensing_pharmacist: string
  pharmacist_reg_no: string | null
  order_item_id: string | null
  dispense_decision_id: string | null
  created_at: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const dateStr = (d: Date) => d.toISOString().split("T")[0]

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

const isToday = (iso: string) => {
  const entryDate = new Date(iso).toDateString()
  return entryDate === new Date().toDateString()
}

const StatCard = ({
  label,
  value,
  sub,
}: {
  label: string
  value: string | number
  sub?: string
}) => (
  <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-base">
    <Text className="text-xs text-ui-fg-subtle uppercase tracking-wide">
      {label}
    </Text>
    <Text className="text-2xl font-semibold mt-1">{value}</Text>
    {sub && (
      <Text className="text-xs text-ui-fg-muted mt-0.5">{sub}</Text>
    )}
  </div>
)

// ── Main Page ────────────────────────────────────────────────────────────────

const H1RegisterPage = () => {
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [fromDate, setFromDate] = useState(dateStr(thirtyDaysAgo))
  const [toDate, setToDate] = useState(dateStr(today))
  const [entries, setEntries] = useState<H1Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<"csv" | "json" | null>(null)

  const fetchEntries = useCallback(async () => {
    if (!fromDate || !toDate) return
    setLoading(true)
    try {
      const json = await sdk.client.fetch<{ entries: H1Entry[] }>(
        "/admin/dispense/h1-register/export",
        { query: { format: "json", from: fromDate, to: toDate } }
      )
      setEntries(json.entries ?? [])
    } catch (err) {
      console.error("[h1-register]", err)
      toast.error("Failed to load H1 register entries")
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  // ── Export handler ──

  const handleExport = async (format: "csv" | "json") => {
    if (!fromDate || !toDate) {
      toast.error("Select a date range first")
      return
    }
    setExporting(format)
    try {
      if (format === "csv") {
        const res = await sdk.client.fetch<Response>(
          "/admin/dispense/h1-register/export",
          { query: { format: "csv", from: fromDate, to: toDate }, headers: { accept: "text/csv" } }
        )
        const text = await res.text()
        const blob = new Blob([text], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `h1-register-${fromDate}-to-${toDate}.csv`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const json = await sdk.client.fetch<{ entries: H1Entry[]; count: number }>(
          "/admin/dispense/h1-register/export",
          { query: { format: "json", from: fromDate, to: toDate } }
        )
        const blob = new Blob([JSON.stringify(json, null, 2)], {
          type: "application/json",
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `h1-register-${fromDate}-to-${toDate}.json`
        a.click()
        URL.revokeObjectURL(url)
      }

      toast.success(`H1 Register exported as ${format.toUpperCase()}`)
    } catch (err) {
      console.error("[h1-export]", err)
      toast.error(`Export failed: ${(err as Error).message}`)
    } finally {
      setExporting(null)
    }
  }

  // ── Computed stats ──

  const todayEntries = entries.filter((e) => isToday(e.entry_date))
  const uniquePatients = new Set(entries.map((e) => e.patient_name)).size
  const uniqueDrugs = new Set(entries.map((e) => e.drug_name)).size
  const totalQty = entries.reduce((sum, e) => sum + (e.quantity_dispensed ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <Container className="p-6">
        <Heading level="h1" className="mb-2">
          H1 Register
        </Heading>
        <Text className="text-ui-fg-subtle">
          CDSCO-mandated register of all Schedule H1 drug dispensing.
          Required for pharmacy inspections under the Drugs & Cosmetics
          Act, 1940. Maintain accurate records and export for audit.
        </Text>
      </Container>

      {/* Date Filters + Export */}
      <Container className="p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Text className="text-xs text-ui-fg-subtle mb-1">From</Text>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <Text className="text-xs text-ui-fg-subtle mb-1">To</Text>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <Button variant="secondary" size="small" onClick={fetchEntries}>
            <ArrowPath />
            Refresh
          </Button>
          <div className="ml-auto flex gap-2">
            <Button
              variant="secondary"
              size="small"
              onClick={() => handleExport("csv")}
              disabled={exporting !== null}
            >
              <ArrowDownTray />
              {exporting === "csv" ? "Exporting..." : "Export CSV"}
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={() => handleExport("json")}
              disabled={exporting !== null}
            >
              <ArrowDownTray />
              {exporting === "json" ? "Exporting..." : "Export JSON"}
            </Button>
          </div>
        </div>
      </Container>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-0">
        <StatCard
          label="Total Entries"
          value={entries.length}
          sub={`${fromDate} to ${toDate}`}
        />
        <StatCard label="Unique Patients" value={uniquePatients} />
        <StatCard label="Unique Drugs" value={uniqueDrugs} />
        <StatCard
          label="Total Qty Dispensed"
          value={totalQty.toLocaleString("en-IN")}
        />
      </div>

      {/* Today's Entries */}
      {todayEntries.length > 0 && (
        <Container className="divide-y p-0">
          <div className="px-6 py-4 flex items-center gap-3">
            <Heading level="h2">Today&apos;s Entries</Heading>
            <Badge color="blue">{todayEntries.length}</Badge>
          </div>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Time</Table.HeaderCell>
                <Table.HeaderCell>Patient</Table.HeaderCell>
                <Table.HeaderCell>Doctor</Table.HeaderCell>
                <Table.HeaderCell>Drug</Table.HeaderCell>
                <Table.HeaderCell>Schedule</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Qty</Table.HeaderCell>
                <Table.HeaderCell>Batch</Table.HeaderCell>
                <Table.HeaderCell>Pharmacist</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {todayEntries.map((e) => (
                <Table.Row
                  key={e.id}
                  className="bg-blue-50/30"
                >
                  <Table.Cell>
                    <Text className="text-sm text-ui-fg-subtle whitespace-nowrap">
                      {new Date(e.entry_date).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm font-medium">
                      {e.patient_name}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <div>
                      <Text className="text-sm">{e.prescriber_name}</Text>
                      <Text className="text-xs text-ui-fg-muted">
                        Reg: {e.prescriber_reg_no}
                      </Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div>
                      <Text className="text-sm font-medium">
                        {e.drug_name}
                      </Text>
                      {e.brand_name && (
                        <Text className="text-xs text-ui-fg-muted">
                          {e.brand_name}
                        </Text>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color="orange">H1</Badge>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Text className="text-sm font-medium">
                      {e.quantity_dispensed}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm font-mono">
                      {e.batch_number}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm">
                      {e.dispensing_pharmacist}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Container>
      )}

      {/* Full Register Table */}
      <Container className="divide-y p-0">
        <div className="px-6 py-4 flex items-center gap-3">
          <Heading level="h2">All Entries</Heading>
          <Badge color="grey">{entries.length}</Badge>
        </div>

        {loading ? (
          <div className="flex justify-center p-6">
            <Text className="text-ui-fg-subtle">
              Loading H1 register entries...
            </Text>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center p-8">
            <DocumentText className="w-8 h-8 text-ui-fg-subtle mb-2" />
            <Text className="text-ui-fg-subtle">
              No H1 register entries found for the selected date range.
            </Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Date</Table.HeaderCell>
                <Table.HeaderCell>Patient</Table.HeaderCell>
                <Table.HeaderCell>Doctor</Table.HeaderCell>
                <Table.HeaderCell>Doctor Reg</Table.HeaderCell>
                <Table.HeaderCell>Drug</Table.HeaderCell>
                <Table.HeaderCell>Schedule</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Qty</Table.HeaderCell>
                <Table.HeaderCell>Batch</Table.HeaderCell>
                <Table.HeaderCell>Invoice</Table.HeaderCell>
                <Table.HeaderCell>Dispensed By</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {entries.map((e) => (
                <Table.Row
                  key={e.id}
                  className={
                    isToday(e.entry_date)
                      ? "bg-blue-50/30"
                      : undefined
                  }
                >
                  <Table.Cell>
                    <Text className="text-sm text-ui-fg-subtle whitespace-nowrap">
                      {fmtDate(e.entry_date)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <div>
                      <Text className="text-sm font-medium">
                        {e.patient_name}
                      </Text>
                      {e.patient_address && (
                        <Text className="text-xs text-ui-fg-muted max-w-[150px] truncate">
                          {e.patient_address}
                        </Text>
                      )}
                      {e.patient_age && (
                        <Text className="text-xs text-ui-fg-muted">
                          Age: {e.patient_age}
                        </Text>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm">{e.prescriber_name}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm font-mono">
                      {e.prescriber_reg_no}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <div>
                      <Text className="text-sm font-medium">
                        {e.drug_name}
                      </Text>
                      {e.brand_name && (
                        <Text className="text-xs text-ui-fg-muted">
                          {e.brand_name}
                        </Text>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color="orange">H1</Badge>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Text className="text-sm font-medium">
                      {e.quantity_dispensed}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm font-mono">
                      {e.batch_number}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm font-mono">
                      {e.order_item_id?.slice(-8) || "—"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <div>
                      <Text className="text-sm">
                        {e.dispensing_pharmacist}
                      </Text>
                      {e.pharmacist_reg_no && (
                        <Text className="text-xs text-ui-fg-muted">
                          Reg: {e.pharmacist_reg_no}
                        </Text>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "H1 Register",
  icon: DocumentText,
})

export default H1RegisterPage
