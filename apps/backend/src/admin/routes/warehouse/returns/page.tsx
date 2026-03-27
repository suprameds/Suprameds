import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge, Button, Container, Heading, Select,
  Table, Text, toast, Drawer, Input, Label, Checkbox,
} from "@medusajs/ui"
import { ArrowPath, ArrowUturnLeft, CheckCircleSolid } from "@medusajs/icons"
import { useCallback, useEffect, useState } from "react"
import { sdk } from "../../../lib/client"

/* ================================================================
   TYPES
   ================================================================ */

type ReturnInspection = {
  id: string
  return_id: string
  order_id: string
  status: "pending" | "approved" | "rejected" | "partial"
  items: ReturnItem[]
  created_at: string
  updated_at: string
}

type ReturnItem = {
  id: string
  item_id: string
  product_title?: string
  quantity: number
  condition?: string
}

type InspectionLine = {
  item_id: string
  product_title: string
  quantity: number
  condition: "sealed" | "damaged" | "wrong_item" | "expired"
  accept: boolean
}

/* ================================================================
   HELPERS
   ================================================================ */

const fmtDateTime = (d?: string | null) => {
  if (!d) return "—"
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

const cap = (s: string) =>
  s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")

const returnStatusColor = (s: string): "green" | "orange" | "red" | "grey" | "blue" => {
  const map: Record<string, "green" | "orange" | "red" | "grey" | "blue"> = {
    pending: "orange",
    approved: "green",
    rejected: "red",
    partial: "blue",
  }
  return map[s] || "grey"
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
   CONDITION OPTIONS
   ================================================================ */

const CONDITION_OPTIONS: { value: InspectionLine["condition"]; label: string }[] = [
  { value: "sealed", label: "Sealed (Intact)" },
  { value: "damaged", label: "Damaged" },
  { value: "wrong_item", label: "Wrong Item" },
  { value: "expired", label: "Expired" },
]

/* ================================================================
   INSPECTION DRAWER
   ================================================================ */

const InspectionDrawer = ({
  open,
  inspection,
  onClose,
  onSuccess,
}: {
  open: boolean
  inspection: ReturnInspection | null
  onClose: () => void
  onSuccess: () => void
}) => {
  const [lines, setLines] = useState<InspectionLine[]>([])
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (inspection) {
      setLines(
        (inspection.items ?? []).map((item) => ({
          item_id: item.item_id || item.id,
          product_title: item.product_title || item.item_id || item.id,
          quantity: item.quantity ?? 1,
          condition: "sealed" as const,
          accept: true,
        }))
      )
      setNotes("")
    }
  }, [inspection])

  const updateLine = (idx: number, patch: Partial<InspectionLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  const handleSubmit = async () => {
    if (!inspection) return
    if (lines.length === 0) {
      toast.error("No inspection lines to submit")
      return
    }

    setSubmitting(true)
    try {
      await sdk.client.fetch<{ inspection: any }>("/admin/warehouse/returns", {
        method: "POST",
        body: {
          return_id: inspection.return_id || inspection.id,
          order_id: inspection.order_id,
          inspection_lines: lines.map((l) => ({
            item_id: l.item_id,
            condition: l.condition,
            accept: l.accept,
            quantity_returned: l.quantity,
          })),
          notes,
        },
      })
      toast.success("Inspection submitted successfully")
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error("Failed to submit inspection", { description: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Inspect Return</Drawer.Title>
          {inspection && (
            <Text className="text-sm text-ui-fg-subtle">
              Return ID: <span className="font-mono">{inspection.return_id || inspection.id}</span>
              {" · "}Order: <span className="font-mono">{inspection.order_id}</span>
            </Text>
          )}
        </Drawer.Header>

        <Drawer.Body className="flex flex-col gap-6 overflow-y-auto">
          {lines.length === 0 && (
            <Text className="text-ui-fg-subtle text-sm">No line items found for this return.</Text>
          )}

          {lines.map((line, idx) => (
            <div key={line.item_id} className="flex flex-col gap-3 p-4 border rounded-lg bg-ui-bg-subtle">
              <div className="flex items-start justify-between">
                <div>
                  <Text className="text-sm font-medium">{line.product_title}</Text>
                  <Text className="text-xs text-ui-fg-subtle font-mono">{line.item_id}</Text>
                </div>
                <Badge color="grey">Qty: {line.quantity}</Badge>
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs text-ui-fg-subtle">Condition</Label>
                <Select
                  value={line.condition}
                  onValueChange={(v) =>
                    updateLine(idx, { condition: v as InspectionLine["condition"] })
                  }
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Select condition" />
                  </Select.Trigger>
                  <Select.Content>
                    {CONDITION_OPTIONS.map((o) => (
                      <Select.Item key={o.value} value={o.value}>
                        {o.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id={`accept-${idx}`}
                  checked={line.accept}
                  onCheckedChange={(checked) =>
                    updateLine(idx, { accept: checked === true })
                  }
                />
                <Label htmlFor={`accept-${idx}`} className="text-sm cursor-pointer">
                  Accept this item
                </Label>
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-ui-fg-subtle">Notes (optional)</Label>
            <textarea
              className="w-full rounded-md border border-ui-border-base bg-ui-bg-field px-3 py-2 text-sm text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:ring-1 focus:ring-ui-border-interactive resize-none"
              rows={3}
              placeholder="Enter inspection notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </Drawer.Body>

        <Drawer.Footer>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || lines.length === 0}
          >
            <CheckCircleSolid />
            {submitting ? "Submitting..." : "Submit Inspection"}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

/* ================================================================
   MAIN PAGE
   ================================================================ */

const ReturnsInspectionPage = () => {
  const [returns, setReturns] = useState<ReturnInspection[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("pending")
  const [selectedInspection, setSelectedInspection] = useState<ReturnInspection | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const fetchReturns = useCallback(async () => {
    setLoading(true)
    try {
      const query: Record<string, string> = {}
      if (statusFilter !== "all") query.status = statusFilter

      const json = await sdk.client.fetch<{ data?: ReturnInspection[] }>(
        "/admin/warehouse/returns",
        { query }
      )
      setReturns(json.data ?? [])
    } catch (err: any) {
      console.error("[warehouse-returns]", err)
      toast.error("Failed to load returns", { description: err.message })
      setReturns([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchReturns() }, [fetchReturns])

  const allReturns = returns
  const pendingCount = allReturns.filter((r) => r.status === "pending").length
  const approvedCount = allReturns.filter((r) => r.status === "approved").length
  const rejectedCount = allReturns.filter((r) => r.status === "rejected").length

  const handleInspect = (inspection: ReturnInspection) => {
    setSelectedInspection(inspection)
    setDrawerOpen(true)
  }

  const STATUS_OPTIONS = [
    { value: "all", label: "All Statuses" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "partial", label: "Partial" },
  ]

  return (
    <div className="flex flex-col gap-4">
      <Container className="p-6">
        <Heading level="h1" className="mb-2">Returns Inspection</Heading>
        <Text className="text-ui-fg-subtle">
          Review and inspect returned orders — assess item condition and approve or reject each return.
        </Text>
      </Container>

      {/* Stats Row */}
      <Container className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard label="Pending Inspections" value={pendingCount} sub="Awaiting review" />
          <StatCard label="Approved" value={approvedCount} sub="Returns accepted" />
          <StatCard label="Rejected" value={rejectedCount} sub="Returns declined" />
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="w-48">
            <Text className="text-xs text-ui-fg-subtle mb-1">Status</Text>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
              <Select.Trigger><Select.Value placeholder="All Statuses" /></Select.Trigger>
              <Select.Content>
                {STATUS_OPTIONS.map((o) => (
                  <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
          <Button variant="secondary" size="small" onClick={fetchReturns}>
            <ArrowPath /> Refresh
          </Button>
        </div>

        {/* Table */}
        {loading ? (
          <Text className="text-ui-fg-subtle p-4">Loading returns...</Text>
        ) : returns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Text className="text-ui-fg-subtle mb-1">No returns found.</Text>
            <Text className="text-xs text-ui-fg-muted">
              Returns from orders will appear here once initiated.
            </Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Return ID</Table.HeaderCell>
                <Table.HeaderCell>Order ID</Table.HeaderCell>
                <Table.HeaderCell>Items</Table.HeaderCell>
                <Table.HeaderCell>Requested At</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {returns.map((ret) => (
                <Table.Row key={ret.id}>
                  <Table.Cell>
                    <Text className="text-sm font-mono">{(ret.return_id || ret.id).slice(-12)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm font-mono">{ret.order_id?.slice(-12) || "—"}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color="grey">{ret.items?.length ?? 0} item(s)</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm text-ui-fg-subtle">{fmtDateTime(ret.created_at)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={returnStatusColor(ret.status)}>{cap(ret.status)}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    {ret.status === "pending" && (
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => handleInspect(ret)}
                      >
                        Inspect
                      </Button>
                    )}
                    {ret.status !== "pending" && (
                      <Text className="text-xs text-ui-fg-muted">{fmtDateTime(ret.updated_at)}</Text>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Container>

      <InspectionDrawer
        open={drawerOpen}
        inspection={selectedInspection}
        onClose={() => { setDrawerOpen(false); setSelectedInspection(null) }}
        onSuccess={fetchReturns}
      />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Returns Inspection",
  icon: ArrowUturnLeft,
})

export default ReturnsInspectionPage
