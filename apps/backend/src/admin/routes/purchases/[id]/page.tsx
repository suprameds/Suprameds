import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import {
  ArrowLeftMini,
  ArrowPath,
  CheckCircleSolid,
  XMark,
} from "@medusajs/icons"
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { sdk } from "../../../lib/client"

// ── Types ───────────────────────────────────────────────────────────────

type PurchaseOrderLine = {
  id: string
  product_id: string
  product_variant_id: string
  product_name: string
  lot_number: string
  expiry_date: string
  manufactured_on: string | null
  ordered_quantity: number
  received_quantity: number
  mrp_paise: number | null
  purchase_price_paise: number
  line_total_paise: number
  batch_id: string | null
  line_status: "pending" | "received" | "partial" | "rejected"
  rejection_reason: string | null
}

type PurchaseOrder = {
  id: string
  po_number: string
  supplier_name: string
  supplier_contact: string | null
  supplier_invoice_number: string | null
  order_date: string
  expected_delivery_date: string | null
  received_date: string | null
  status: "draft" | "ordered" | "received" | "partial" | "cancelled"
  grn_number: string | null
  location_id: string | null
  notes: string | null
  total_items: number
  total_quantity: number
  total_cost_paise: number
  created_by: string | null
  received_by: string | null
  lines: PurchaseOrderLine[]
  created_at: string
}

type ReceiveLineEntry = {
  line_id: string
  product_name: string
  ordered_quantity: number
  received_quantity: number
  line_status: "received" | "partial" | "rejected"
}

// ── Helpers ─────────────────────────────────────────────────────────────

const statusColor = (s: string) => {
  switch (s) {
    case "draft":
      return "grey" as const
    case "ordered":
      return "blue" as const
    case "received":
      return "green" as const
    case "partial":
      return "orange" as const
    case "cancelled":
    case "rejected":
      return "red" as const
    case "pending":
      return "grey" as const
    default:
      return "grey" as const
  }
}

const formatDate = (d: string | null) => {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const formatINR = (paise: number | null) => {
  if (paise == null) return "—"
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const capitalize = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1)

// ── Main Page ───────────────────────────────────────────────────────────

const PurchaseOrderDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Receive drawer
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receiveEntries, setReceiveEntries] = useState<ReceiveLineEntry[]>([])
  const [receiving, setReceiving] = useState(false)

  // ── Fetch PO ────────────────────────────────────────────────────────

  const fetchPO = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await sdk.client.fetch<{ purchase_order: PurchaseOrder }>(
        `/admin/pharma/purchases/${id}`
      )
      setPo(data.purchase_order)
    } catch (err: any) {
      setError(err.message || "Failed to load purchase order")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) fetchPO()
  }, [id])

  // ── Receive flow ────────────────────────────────────────────────────

  const openReceiveDrawer = () => {
    if (!po) return
    const entries: ReceiveLineEntry[] = po.lines
      .filter((l) => l.line_status !== "received")
      .map((l) => ({
        line_id: l.id,
        product_name: l.product_name,
        ordered_quantity: l.ordered_quantity,
        received_quantity: l.ordered_quantity,
        line_status: "received" as const,
      }))
    setReceiveEntries(entries)
    setReceiveOpen(true)
  }

  const updateReceiveEntry = (
    lineId: string,
    updates: Partial<ReceiveLineEntry>
  ) => {
    setReceiveEntries((prev) =>
      prev.map((e) => (e.line_id === lineId ? { ...e, ...updates } : e))
    )
  }

  const handleReceive = async () => {
    setReceiving(true)
    try {
      const body = {
        line_overrides: receiveEntries.map((e) => ({
          line_id: e.line_id,
          received_quantity: e.received_quantity,
          line_status: e.line_status,
        })),
      }

      const data = await sdk.client.fetch<{ batches_created?: number }>(
        `/admin/pharma/purchases/${id}/receive`,
        { method: "POST", body }
      )
      const batchCount = data.batches_created ?? receiveEntries.length
      toast.success(`Goods received — ${batchCount} batch(es) created`)
      setReceiveOpen(false)
      fetchPO()
    } catch (err: any) {
      toast.error("Failed to receive goods", { description: err.message })
    } finally {
      setReceiving(false)
    }
  }

  // ── Cancel flow ─────────────────────────────────────────────────────

  const handleCancel = async () => {
    if (
      !window.confirm(
        "Are you sure you want to cancel this purchase order? This cannot be undone."
      )
    )
      return

    try {
      await sdk.client.fetch<{ success: boolean }>(`/admin/pharma/purchases/${id}`, {
        method: "DELETE",
      })

      toast.success("Purchase order cancelled")
      navigate("/app/purchases")
    } catch (err: any) {
      toast.error("Failed to cancel purchase order", {
        description: err.message,
      })
    }
  }

  // ── Loading / Error states ──────────────────────────────────────────

  if (loading) {
    return (
      <Container className="p-6">
        <Text className="text-ui-fg-subtle">Loading purchase order...</Text>
      </Container>
    )
  }

  if (error || !po) {
    return (
      <Container className="p-6">
        <Text className="text-ui-fg-error">
          {error || "Purchase order not found"}
        </Text>
        <a href="/app/purchases">
          <Button variant="secondary" className="mt-4">
            <ArrowLeftMini />
            Back to Purchase Orders
          </Button>
        </a>
      </Container>
    )
  }

  const canReceive =
    po.status === "draft" ||
    po.status === "ordered" ||
    po.status === "partial"
  const canCancel =
    po.status !== "received" && po.status !== "cancelled"

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <a href="/app/purchases">
              <Button variant="transparent" size="small">
                <ArrowLeftMini />
              </Button>
            </a>
            <Heading level="h2">{po.po_number}</Heading>
            <Badge color={statusColor(po.status)}>
              {capitalize(po.status)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="small" onClick={fetchPO}>
              <ArrowPath />
              Refresh
            </Button>
            {canReceive && (
              <Button
                variant="primary"
                size="small"
                onClick={openReceiveDrawer}
              >
                <CheckCircleSolid />
                Receive Goods
              </Button>
            )}
            {canCancel && (
              <Button variant="danger" size="small" onClick={handleCancel}>
                <XMark />
                Cancel PO
              </Button>
            )}
          </div>
        </div>
      </Container>

      {/* Order information */}
      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h3">Order Information</Heading>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <Text className="text-ui-fg-subtle text-xs">Supplier</Text>
              <Text className="font-medium">{po.supplier_name}</Text>
            </div>
            <div>
              <Text className="text-ui-fg-subtle text-xs">Contact</Text>
              <Text>{po.supplier_contact || "—"}</Text>
            </div>
            <div>
              <Text className="text-ui-fg-subtle text-xs">Order Date</Text>
              <Text>{formatDate(po.order_date)}</Text>
            </div>
            <div>
              <Text className="text-ui-fg-subtle text-xs">
                Expected Delivery
              </Text>
              <Text>{formatDate(po.expected_delivery_date)}</Text>
            </div>
            <div>
              <Text className="text-ui-fg-subtle text-xs">Received Date</Text>
              <Text>{formatDate(po.received_date)}</Text>
            </div>
            <div>
              <Text className="text-ui-fg-subtle text-xs">GRN Number</Text>
              <Text className="font-mono">{po.grn_number || "—"}</Text>
            </div>
            <div>
              <Text className="text-ui-fg-subtle text-xs">
                Invoice Number
              </Text>
              <Text className="font-mono">
                {po.supplier_invoice_number || "—"}
              </Text>
            </div>
            <div>
              <Text className="text-ui-fg-subtle text-xs">Total Cost</Text>
              <Text className="font-medium">
                {formatINR(po.total_cost_paise)}
              </Text>
            </div>
          </div>

          {po.notes && (
            <div className="mt-4 p-3 bg-ui-bg-subtle rounded-lg">
              <Text className="text-xs text-ui-fg-subtle">Notes</Text>
              <Text className="text-sm mt-1">{po.notes}</Text>
            </div>
          )}
        </div>
      </Container>

      {/* Line items table */}
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h3">
            Line Items ({po.lines?.length || 0})
          </Heading>
          <div className="flex items-center gap-4 text-sm">
            <Text className="text-ui-fg-subtle">
              Total Qty:{" "}
              <span className="font-medium text-ui-fg-base">
                {po.total_quantity}
              </span>
            </Text>
            <Text className="text-ui-fg-subtle">
              Total Cost:{" "}
              <span className="font-medium text-ui-fg-base">
                {formatINR(po.total_cost_paise)}
              </span>
            </Text>
          </div>
        </div>

        {po.lines?.length > 0 ? (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Product</Table.HeaderCell>
                <Table.HeaderCell>Lot Number</Table.HeaderCell>
                <Table.HeaderCell>Expiry</Table.HeaderCell>
                <Table.HeaderCell className="text-right">
                  Ordered
                </Table.HeaderCell>
                <Table.HeaderCell className="text-right">
                  Received
                </Table.HeaderCell>
                <Table.HeaderCell className="text-right">MRP</Table.HeaderCell>
                <Table.HeaderCell className="text-right">
                  Cost
                </Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Batch ID</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {po.lines.map((line) => (
                <Table.Row key={line.id}>
                  <Table.Cell>
                    <Text className="text-sm font-medium">
                      {line.product_name}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm font-mono">
                      {line.lot_number}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm">
                      {formatDate(line.expiry_date)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Text className="text-sm">{line.ordered_quantity}</Text>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Text className="text-sm">{line.received_quantity}</Text>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Text className="text-sm">
                      {formatINR(line.mrp_paise)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Text className="text-sm">
                      {formatINR(line.purchase_price_paise)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={statusColor(line.line_status)}>
                      {capitalize(line.line_status)}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    {line.batch_id ? (
                      <Text className="text-xs font-mono text-ui-fg-subtle">
                        {line.batch_id.slice(-8)}
                      </Text>
                    ) : (
                      <Text className="text-xs text-ui-fg-muted">—</Text>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ) : (
          <div className="flex justify-center p-6">
            <Text className="text-ui-fg-subtle">No line items</Text>
          </div>
        )}
      </Container>

      {/* Receive goods drawer */}
      <Drawer open={receiveOpen} onOpenChange={setReceiveOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Receive Goods — {po.po_number}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="p-4 overflow-y-auto">
            <Text className="text-sm text-ui-fg-subtle mb-4">
              Enter the received quantity for each line item. The status will
              auto-update based on the quantity, or you can override it manually.
            </Text>

            <div className="flex flex-col gap-4">
              {receiveEntries.map((entry) => (
                <div
                  key={entry.line_id}
                  className="p-4 border border-ui-border-base rounded-lg"
                >
                  <Text className="text-sm font-medium mb-3">
                    {entry.product_name}
                  </Text>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Ordered Qty</Label>
                      <Text className="text-sm font-mono mt-1">
                        {entry.ordered_quantity}
                      </Text>
                    </div>
                    <div>
                      <Label
                        htmlFor={`recv-${entry.line_id}`}
                        className="text-xs"
                      >
                        Received Qty
                      </Label>
                      <Input
                        id={`recv-${entry.line_id}`}
                        type="number"
                        min={0}
                        max={entry.ordered_quantity}
                        value={entry.received_quantity}
                        onChange={(e) => {
                          const qty = parseInt(e.target.value) || 0
                          // Auto-derive status from quantity
                          const status: ReceiveLineEntry["line_status"] =
                            qty === 0
                              ? "rejected"
                              : qty < entry.ordered_quantity
                                ? "partial"
                                : "received"
                          updateReceiveEntry(entry.line_id, {
                            received_quantity: qty,
                            line_status: status,
                          })
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Status</Label>
                      <Select
                        value={entry.line_status}
                        onValueChange={(val) =>
                          updateReceiveEntry(entry.line_id, {
                            line_status:
                              val as ReceiveLineEntry["line_status"],
                          })
                        }
                      >
                        <Select.Trigger>
                          <Select.Value />
                        </Select.Trigger>
                        <Select.Content>
                          <Select.Item value="received">Received</Select.Item>
                          <Select.Item value="partial">Partial</Select.Item>
                          <Select.Item value="rejected">Rejected</Select.Item>
                        </Select.Content>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {receiveEntries.length === 0 && (
              <div className="text-center py-8">
                <CheckCircleSolid className="w-8 h-8 text-ui-fg-subtle mx-auto mb-2" />
                <Text className="text-ui-fg-subtle">
                  All lines have already been received.
                </Text>
              </div>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary" disabled={receiving}>
                Cancel
              </Button>
            </Drawer.Close>
            <Button
              variant="primary"
              onClick={handleReceive}
              disabled={receiving || receiveEntries.length === 0}
            >
              {receiving ? "Processing..." : "Confirm Receipt"}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Purchase Order Details",
})

export default PurchaseOrderDetailPage
