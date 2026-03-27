import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  Heading,
  Select,
  Table,
  Tabs,
  Text,
  toast,
} from "@medusajs/ui"
import { ArrowPath, Beaker } from "@medusajs/icons"
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { sdk } from "../../lib/client"

/* ================================================================
   TYPES
   ================================================================ */

type PharmacistStats = {
  pending_rx_count: number
  decisions_today: number
  h1_entries_today: number
  pre_dispatch_pending: number
}

type RxQueueItem = {
  id: string
  customer_name: string | null
  customer_id: string | null
  guest_phone: string | null
  status: string
  products: string[]
  has_h1: boolean
  created_at: string
}

type DispenseDecision = {
  id: string
  prescription_drug_line_id: string
  pharmacist_id: string
  decision: "approved" | "rejected" | "substituted" | "quantity_modified"
  rejection_reason: string | null
  dispensing_notes: string | null
  override_reason: string | null
  is_override: boolean
  patient_name: string | null
  prescriber_name: string | null
  created_at: string
}

type H1RegisterEntry = {
  id: string
  entry_date: string
  patient_name: string | null
  drug_name: string
  batch_number: string | null
  quantity: number
  pharmacist_id: string
}

type PreDispatchSignOff = {
  id: string
  order_id: string
  pharmacist_id: string
  all_passed: boolean
  notes: string | null
  created_at: string
}

/* ================================================================
   HELPERS
   ================================================================ */

const fmtDate = (d?: string | null) => {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const fmtDateTime = (d?: string | null) => {
  if (!d) return "—"
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const cap = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

const rxStatusColor = (s: string): "orange" | "green" | "red" | "grey" | "blue" => {
  const map: Record<string, "orange" | "green" | "red" | "grey" | "blue"> = {
    pending_review: "orange",
    approved: "green",
    rejected: "red",
    expired: "grey",
  }
  return map[s] ?? "grey"
}

const decisionColor = (d: string): "green" | "red" | "orange" | "blue" | "grey" => {
  const map: Record<string, "green" | "red" | "orange" | "blue" | "grey"> = {
    approved: "green",
    rejected: "red",
    substituted: "orange",
    quantity_modified: "blue",
  }
  return map[d] ?? "grey"
}

/* ================================================================
   STAT CARD
   ================================================================ */

const StatCard = ({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: "amber" | "blue" | "purple" | "orange"
}) => {
  const accentClass =
    accent === "amber"
      ? "border-l-4 border-l-yellow-400"
      : accent === "blue"
      ? "border-l-4 border-l-blue-500"
      : accent === "purple"
      ? "border-l-4 border-l-purple-500"
      : accent === "orange"
      ? "border-l-4 border-l-orange-500"
      : ""

  return (
    <div
      className={`p-4 rounded-lg border border-ui-border-base bg-ui-bg-base ${accentClass}`}
    >
      <Text className="text-xs text-ui-fg-subtle uppercase tracking-wide">
        {label}
      </Text>
      <Text className="text-2xl font-semibold mt-1">{value}</Text>
      {sub && <Text className="text-xs text-ui-fg-muted mt-0.5">{sub}</Text>}
    </div>
  )
}

/* ================================================================
   DASHBOARD TAB
   ================================================================ */

const DashboardTab = () => {
  const [stats, setStats] = useState<PharmacistStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const json = await sdk.client.fetch<{ stats: PharmacistStats }>(
        "/admin/pharmacist/stats"
      )
      setStats(json.stats ?? {
        pending_rx_count: 0,
        decisions_today: 0,
        h1_entries_today: 0,
        pre_dispatch_pending: 0,
      })
      setLastUpdated(new Date())
    } catch (err: any) {
      console.error("[pharmacist-stats]", err)
      // Fallback: try to derive stats from existing endpoints
      try {
        const [rxRes, decisionsRes, preDispatchRes] = await Promise.allSettled([
          sdk.client.fetch<{ prescriptions: any[] }>("/admin/prescriptions", {
            query: { status: "pending_review" },
          }),
          sdk.client.fetch<{ decisions: DispenseDecision[] }>(
            "/admin/dispense/decisions"
          ),
          sdk.client.fetch<{ sign_offs: PreDispatchSignOff[] }>(
            "/admin/dispense/pre-dispatch"
          ),
        ])

        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        const prescriptions =
          rxRes.status === "fulfilled" ? rxRes.value.prescriptions ?? [] : []
        const decisions =
          decisionsRes.status === "fulfilled"
            ? decisionsRes.value.decisions ?? []
            : []
        const preDispatch =
          preDispatchRes.status === "fulfilled"
            ? preDispatchRes.value.sign_offs ?? []
            : []

        const decisionsToday = decisions.filter(
          (d) => new Date(d.created_at) >= todayStart
        ).length

        setStats({
          pending_rx_count: prescriptions.length,
          decisions_today: decisionsToday,
          h1_entries_today: 0,
          pre_dispatch_pending: preDispatch.filter((s) => !s.all_passed).length,
        })
        setLastUpdated(new Date())
      } catch (fallbackErr: any) {
        toast.error("Failed to load pharmacist stats", {
          description: fallbackErr.message,
        })
        setStats({
          pending_rx_count: 0,
          decisions_today: 0,
          h1_entries_today: 0,
          pre_dispatch_pending: 0,
        })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  if (loading) {
    return <Text className="text-ui-fg-subtle p-4">Loading dashboard...</Text>
  }

  const s = stats!

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Text className="text-sm font-medium mb-3">Today&apos;s Overview</Text>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Pending Rx"
            value={s.pending_rx_count}
            sub="Awaiting pharmacist review"
            accent="amber"
          />
          <StatCard
            label="Decisions Today"
            value={s.decisions_today}
            sub="Approvals / rejections"
            accent="blue"
          />
          <StatCard
            label="H1 Entries Today"
            value={s.h1_entries_today}
            sub="Schedule H1 register entries"
            accent="purple"
          />
          <StatCard
            label="Pre-Dispatch Pending"
            value={s.pre_dispatch_pending}
            sub="Failed checks or awaiting sign-off"
            accent="orange"
          />
        </div>
      </div>

      <div className="p-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle">
        <Text className="text-sm font-medium mb-2">Activity Summary</Text>
        <div className="flex flex-col gap-2 text-sm text-ui-fg-subtle">
          <Text>
            There {s.pending_rx_count === 1 ? "is" : "are"}{" "}
            <strong className="text-ui-fg-base">{s.pending_rx_count}</strong>{" "}
            prescription{s.pending_rx_count !== 1 ? "s" : ""} waiting for
            review.
          </Text>
          {s.pending_rx_count > 0 && (
            <Text>
              Use the{" "}
              <strong className="text-ui-fg-base">Rx Queue</strong> tab to
              review and approve or reject prescriptions.
            </Text>
          )}
          {s.h1_entries_today > 0 && (
            <Text>
              <strong className="text-ui-fg-base">{s.h1_entries_today}</strong>{" "}
              Schedule H1 drug{s.h1_entries_today !== 1 ? "s were" : " was"}{" "}
              dispensed today — check the{" "}
              <strong className="text-ui-fg-base">H1 Register</strong> tab for
              entries.
            </Text>
          )}
          {s.pre_dispatch_pending > 0 && (
            <Text>
              <strong className="text-ui-fg-base">
                {s.pre_dispatch_pending}
              </strong>{" "}
              order{s.pre_dispatch_pending !== 1 ? "s" : ""}{" "}
              {s.pre_dispatch_pending !== 1 ? "require" : "requires"}{" "}
              pre-dispatch attention.
            </Text>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        {lastUpdated && (
          <Text className="text-xs text-ui-fg-muted">
            Last updated: {fmtDateTime(lastUpdated.toISOString())}
          </Text>
        )}
        <Button variant="secondary" size="small" onClick={fetchStats}>
          <ArrowPath /> Refresh
        </Button>
      </div>
    </div>
  )
}

/* ================================================================
   RX QUEUE TAB
   ================================================================ */

const RxQueueTab = () => {
  const navigate = useNavigate()
  const [items, setItems] = useState<RxQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    try {
      // Try the dedicated pharmacist rx-queue endpoint first
      try {
        const json = await sdk.client.fetch<{ rx_queue: RxQueueItem[] }>(
          "/admin/pharmacist/rx-queue"
        )
        const raw = json.rx_queue ?? []
        // Sort H1 first (urgency)
        const sorted = [...raw].sort((a, b) => {
          if (a.has_h1 && !b.has_h1) return -1
          if (!a.has_h1 && b.has_h1) return 1
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        })
        setItems(sorted)
        return
      } catch {
        // Fall through to prescriptions endpoint
      }

      // Fallback: use prescriptions endpoint
      const query: Record<string, string> = {}
      if (statusFilter !== "all") query.status = statusFilter

      const json = await sdk.client.fetch<{ prescriptions: any[] }>(
        "/admin/prescriptions",
        { query }
      )
      const prescriptions = json.prescriptions ?? []
      const mapped: RxQueueItem[] = prescriptions.map((rx: any) => ({
        id: rx.id,
        customer_name: rx.patient_name || null,
        customer_id: rx.customer_id || null,
        guest_phone: rx.guest_phone || null,
        status: rx.status,
        products:
          rx.lines?.map((l: any) => l.drug_name).filter(Boolean) ?? [],
        has_h1: rx.lines?.some((l: any) => l.is_h1 || l.schedule === "H1") ?? false,
        created_at: rx.created_at,
      }))

      // Sort H1 first
      const sorted = [...mapped].sort((a, b) => {
        if (a.has_h1 && !b.has_h1) return -1
        if (!a.has_h1 && b.has_h1) return 1
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })
      setItems(sorted)
    } catch (err: any) {
      console.error("[pharmacist-rx-queue]", err)
      toast.error("Failed to load Rx queue", { description: err.message })
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  const filtered =
    statusFilter === "all"
      ? items
      : statusFilter === "h1"
      ? items.filter((i) => i.has_h1)
      : items.filter((i) => i.status === statusFilter)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex items-end gap-3">
          <div>
            <Text className="text-xs text-ui-fg-subtle mb-1">Filter</Text>
            <div className="flex gap-1">
              {[
                { value: "all", label: "All" },
                { value: "pending_review", label: "Pending" },
                { value: "h1", label: "H1 Priority" },
              ].map((opt) => (
                <Button
                  key={opt.value}
                  variant={statusFilter === opt.value ? "primary" : "secondary"}
                  size="small"
                  onClick={() => setStatusFilter(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
          <Button variant="secondary" size="small" onClick={fetchQueue}>
            <ArrowPath /> Refresh
          </Button>
        </div>
        <Button
          variant="secondary"
          size="small"
          onClick={() => navigate("/pharmacist/rx-queue")}
        >
          Full Queue View
        </Button>
      </div>

      {loading ? (
        <Text className="text-ui-fg-subtle p-4">Loading Rx queue...</Text>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Text className="text-ui-fg-subtle">No prescriptions found.</Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Rx ID</Table.HeaderCell>
              <Table.HeaderCell>Customer</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Products</Table.HeaderCell>
              <Table.HeaderCell>Schedule</Table.HeaderCell>
              <Table.HeaderCell>Uploaded</Table.HeaderCell>
              <Table.HeaderCell>Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {filtered.map((rx) => (
              <Table.Row key={rx.id}>
                <Table.Cell>
                  <Text className="font-mono text-sm font-medium">
                    {rx.id.slice(-12)}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm">
                    {rx.customer_name ||
                      rx.guest_phone ||
                      rx.customer_id?.slice(-8) ||
                      "Unknown"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={rxStatusColor(rx.status)}>
                    {cap(rx.status)}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text
                    className="text-sm text-ui-fg-subtle truncate max-w-[180px]"
                    title={rx.products.join(", ")}
                  >
                    {rx.products.length > 0
                      ? rx.products.slice(0, 2).join(", ") +
                        (rx.products.length > 2
                          ? ` +${rx.products.length - 2}`
                          : "")
                      : "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  {rx.has_h1 ? (
                    <Badge color="red">H1</Badge>
                  ) : (
                    <Text className="text-xs text-ui-fg-muted">—</Text>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm text-ui-fg-subtle whitespace-nowrap">
                    {fmtDate(rx.created_at)}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => navigate(`/prescriptions/${rx.id}`)}
                  >
                    Review
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  )
}

/* ================================================================
   DECISIONS TAB
   ================================================================ */

const DECISION_FILTER_OPTIONS = [
  { value: "all", label: "All Decisions" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "substituted", label: "Substituted" },
  { value: "quantity_modified", label: "Qty Modified" },
]

const DATE_RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "all", label: "All Time" },
]

const DecisionsTab = () => {
  const [decisions, setDecisions] = useState<DispenseDecision[]>([])
  const [loading, setLoading] = useState(true)
  const [decisionFilter, setDecisionFilter] = useState("all")
  const [dateRange, setDateRange] = useState("today")

  const fetchDecisions = useCallback(async () => {
    setLoading(true)
    try {
      const query: Record<string, string> = {}
      if (decisionFilter !== "all") query.decision = decisionFilter

      const json = await sdk.client.fetch<{ decisions: DispenseDecision[] }>(
        "/admin/dispense/decisions",
        { query }
      )
      setDecisions(json.decisions ?? [])
    } catch (err: any) {
      console.error("[pharmacist-decisions]", err)
      toast.error("Failed to load decisions", { description: err.message })
      setDecisions([])
    } finally {
      setLoading(false)
    }
  }, [decisionFilter])

  useEffect(() => {
    fetchDecisions()
  }, [fetchDecisions])

  const filtered = decisions.filter((d) => {
    if (dateRange === "today") {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      return new Date(d.created_at) >= todayStart
    }
    if (dateRange === "week") {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      weekStart.setHours(0, 0, 0, 0)
      return new Date(d.created_at) >= weekStart
    }
    return true
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Text className="text-xs text-ui-fg-subtle mb-1">Decision Type</Text>
          <Select
            value={decisionFilter}
            onValueChange={(v) => setDecisionFilter(v)}
          >
            <Select.Trigger>
              <Select.Value placeholder="All Decisions" />
            </Select.Trigger>
            <Select.Content>
              {DECISION_FILTER_OPTIONS.map((o) => (
                <Select.Item key={o.value} value={o.value}>
                  {o.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <div className="w-40">
          <Text className="text-xs text-ui-fg-subtle mb-1">Date Range</Text>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v)}>
            <Select.Trigger>
              <Select.Value placeholder="Today" />
            </Select.Trigger>
            <Select.Content>
              {DATE_RANGE_OPTIONS.map((o) => (
                <Select.Item key={o.value} value={o.value}>
                  {o.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <Button variant="secondary" size="small" onClick={fetchDecisions}>
          <ArrowPath /> Refresh
        </Button>
      </div>

      {loading ? (
        <Text className="text-ui-fg-subtle p-4">Loading decisions...</Text>
      ) : filtered.length === 0 ? (
        <Text className="text-ui-fg-subtle p-4">
          No decisions found for the selected filters.
        </Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Prescription ID</Table.HeaderCell>
              <Table.HeaderCell>Decision</Table.HeaderCell>
              <Table.HeaderCell>Drug Line</Table.HeaderCell>
              <Table.HeaderCell>Patient</Table.HeaderCell>
              <Table.HeaderCell>Pharmacist</Table.HeaderCell>
              <Table.HeaderCell>Date</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {filtered.map((d) => (
              <Table.Row key={d.id}>
                <Table.Cell>
                  <Text className="font-mono text-sm">
                    {d.prescription_drug_line_id.slice(-12)}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-1">
                    <Badge color={decisionColor(d.decision)}>
                      {cap(d.decision)}
                    </Badge>
                    {d.is_override && (
                      <Badge color="red">Override</Badge>
                    )}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Text
                    className="text-sm text-ui-fg-subtle truncate max-w-[160px]"
                    title={
                      d.rejection_reason ||
                      d.override_reason ||
                      d.dispensing_notes ||
                      undefined
                    }
                  >
                    {d.rejection_reason ||
                      d.override_reason ||
                      d.dispensing_notes ||
                      "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm">{d.patient_name || "—"}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="font-mono text-sm">
                    {d.pharmacist_id.slice(-10)}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm text-ui-fg-subtle whitespace-nowrap">
                    {fmtDateTime(d.created_at)}
                  </Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  )
}

/* ================================================================
   H1 REGISTER TAB
   ================================================================ */

const H1RegisterTab = () => {
  const [entries, setEntries] = useState<H1RegisterEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      // Try dedicated h1-register endpoint first, then fallback
      let data: H1RegisterEntry[] = []
      try {
        const json = await sdk.client.fetch<{
          entries?: H1RegisterEntry[]
          h1_entries?: H1RegisterEntry[]
        }>("/admin/compliance/h1-register")
        data = json.entries ?? json.h1_entries ?? []
      } catch {
        try {
          const json = await sdk.client.fetch<{
            entries?: H1RegisterEntry[]
            h1_entries?: H1RegisterEntry[]
          }>("/admin/dispense/h1-register/export")
          data = json.entries ?? json.h1_entries ?? []
        } catch (innerErr: any) {
          console.error("[pharmacist-h1-register]", innerErr)
          toast.error("Failed to load H1 register", {
            description: innerErr.message,
          })
        }
      }
      setEntries(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const handleExportCsv = async () => {
    if (entries.length === 0) {
      toast.error("No entries to export")
      return
    }
    setExporting(true)
    try {
      const headers = [
        "Entry Date",
        "Patient",
        "Drug",
        "Batch #",
        "Qty",
        "Pharmacist ID",
      ]
      const rows = entries.map((e) => [
        fmtDate(e.entry_date),
        e.patient_name ? `${e.patient_name.slice(0, 3)}***` : "—",
        e.drug_name,
        e.batch_number || "—",
        String(e.quantity),
        e.pharmacist_id.slice(-10),
      ])
      const csv = [headers, ...rows]
        .map((row) => row.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
        .join("\n")

      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `h1-register-${new Date().toISOString().split("T")[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("H1 Register exported")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-end gap-3">
          <Button variant="secondary" size="small" onClick={fetchEntries}>
            <ArrowPath /> Refresh
          </Button>
        </div>
        <Button
          variant="secondary"
          size="small"
          onClick={handleExportCsv}
          disabled={exporting || loading}
        >
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      {loading ? (
        <Text className="text-ui-fg-subtle p-4">Loading H1 register...</Text>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Text className="text-ui-fg-subtle">No H1 register entries found.</Text>
          <Text className="text-xs text-ui-fg-muted mt-1">
            H1 entries are created when Schedule H1 drugs are dispensed.
          </Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Entry Date</Table.HeaderCell>
              <Table.HeaderCell>Patient (PHI masked)</Table.HeaderCell>
              <Table.HeaderCell>Drug</Table.HeaderCell>
              <Table.HeaderCell>Batch #</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Qty</Table.HeaderCell>
              <Table.HeaderCell>Pharmacist</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {entries.map((e) => (
              <Table.Row key={e.id}>
                <Table.Cell>
                  <Text className="text-sm whitespace-nowrap">
                    {fmtDate(e.entry_date)}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm">
                    {e.patient_name
                      ? `${e.patient_name.slice(0, 3)}***`
                      : "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <Badge color="red">H1</Badge>
                    <Text className="text-sm">{e.drug_name}</Text>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Text className="font-mono text-sm">
                    {e.batch_number || "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell className="text-right">
                  <Text className="text-sm font-medium">{e.quantity}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="font-mono text-sm">
                    {e.pharmacist_id.slice(-10)}
                  </Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  )
}

/* ================================================================
   PRE-DISPATCH TAB
   ================================================================ */

const PreDispatchTab = () => {
  const [signOffs, setSignOffs] = useState<PreDispatchSignOff[]>([])
  const [loading, setLoading] = useState(true)
  const [signingOff, setSigningOff] = useState<string | null>(null)

  const fetchSignOffs = useCallback(async () => {
    setLoading(true)
    try {
      const json = await sdk.client.fetch<{ sign_offs: PreDispatchSignOff[] }>(
        "/admin/dispense/pre-dispatch"
      )
      setSignOffs(json.sign_offs ?? [])
    } catch (err: any) {
      console.error("[pharmacist-pre-dispatch]", err)
      toast.error("Failed to load pre-dispatch records", {
        description: err.message,
      })
      setSignOffs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSignOffs()
  }, [fetchSignOffs])

  const handleSignOff = async (orderId: string) => {
    setSigningOff(orderId)
    try {
      await sdk.client.fetch<{ success: boolean }>(
        "/admin/dispense/pre-dispatch",
        {
          method: "POST",
          body: {
            order_id: orderId,
            all_passed: true,
            checklist_results: {
              patient_details_verified: true,
              drug_labels_checked: true,
              quantities_verified: true,
              expiry_dates_checked: true,
              packaging_intact: true,
            },
          },
        }
      )
      toast.success("Pre-dispatch sign-off recorded")
      fetchSignOffs()
    } catch (err: any) {
      toast.error("Sign-off failed", { description: err.message })
    } finally {
      setSigningOff(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="secondary" size="small" onClick={fetchSignOffs}>
          <ArrowPath /> Refresh
        </Button>
      </div>

      {loading ? (
        <Text className="text-ui-fg-subtle p-4">
          Loading pre-dispatch records...
        </Text>
      ) : signOffs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Text className="text-ui-fg-subtle">
            No pre-dispatch records found.
          </Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Order ID</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Pharmacist</Table.HeaderCell>
              <Table.HeaderCell>Created</Table.HeaderCell>
              <Table.HeaderCell>Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {signOffs.map((s) => (
              <Table.Row key={s.id}>
                <Table.Cell>
                  <Text className="font-mono text-sm font-medium">
                    {s.order_id.slice(-12)}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  {s.all_passed ? (
                    <Badge color="green">Passed</Badge>
                  ) : (
                    <Badge color="red">Failed</Badge>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <Text className="font-mono text-sm">
                    {s.pharmacist_id.slice(-10)}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm text-ui-fg-subtle whitespace-nowrap">
                    {fmtDateTime(s.created_at)}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  {!s.all_passed && (
                    <Button
                      variant="primary"
                      size="small"
                      disabled={signingOff === s.order_id}
                      onClick={() => handleSignOff(s.order_id)}
                    >
                      {signingOff === s.order_id
                        ? "Signing Off..."
                        : "Sign Off"}
                    </Button>
                  )}
                  {s.all_passed && (
                    <Text className="text-xs text-ui-fg-muted">Complete</Text>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  )
}

/* ================================================================
   MAIN PAGE
   ================================================================ */

const PharmacistPage = () => {
  return (
    <div className="flex flex-col gap-4">
      <Container className="p-6">
        <Heading level="h1" className="mb-2">
          Pharmacist Portal
        </Heading>
        <Text className="text-ui-fg-subtle">
          Consolidated dashboard for pharmacist workflow — prescription review,
          clinical decisions, H1 register, and pre-dispatch sign-offs. All
          actions are logged for CDSCO compliance.
        </Text>
      </Container>

      <Container className="p-6">
        <Tabs defaultValue="dashboard">
          <Tabs.List>
            <Tabs.Trigger value="dashboard">Dashboard</Tabs.Trigger>
            <Tabs.Trigger value="rx-queue">Rx Queue</Tabs.Trigger>
            <Tabs.Trigger value="decisions">Decisions</Tabs.Trigger>
            <Tabs.Trigger value="h1-register">H1 Register</Tabs.Trigger>
            <Tabs.Trigger value="pre-dispatch">Pre-Dispatch</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="dashboard" className="pt-4">
            <DashboardTab />
          </Tabs.Content>

          <Tabs.Content value="rx-queue" className="pt-4">
            <RxQueueTab />
          </Tabs.Content>

          <Tabs.Content value="decisions" className="pt-4">
            <DecisionsTab />
          </Tabs.Content>

          <Tabs.Content value="h1-register" className="pt-4">
            <H1RegisterTab />
          </Tabs.Content>

          <Tabs.Content value="pre-dispatch" className="pt-4">
            <PreDispatchTab />
          </Tabs.Content>
        </Tabs>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Pharmacist",
  icon: Beaker,
})

export default PharmacistPage
