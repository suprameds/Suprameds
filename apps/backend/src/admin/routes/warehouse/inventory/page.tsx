import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge, Button, Container, Heading, Select,
  Table, Text, toast,
} from "@medusajs/ui"
import { ArchiveBox, ArrowPath, ExclamationCircle } from "@medusajs/icons"
import { useCallback, useEffect, useState } from "react"
import { sdk } from "../../../lib/client"

/* ================================================================
   TYPES
   ================================================================ */

type InventoryBatch = {
  id: string
  product_id: string
  product_title?: string
  batch_number: string
  lot_number?: string
  expiry_date?: string | null
  quantity_available: number
  quantity_reserved: number
  status: "active" | "quarantine" | "recalled" | "expired" | "depleted"
  mrp?: number
  created_at: string
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

const daysUntilExpiry = (expiryDate?: string | null): number | null => {
  if (!expiryDate) return null
  const now = new Date()
  const exp = new Date(expiryDate)
  return Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

const ExpiryBadge = ({ expiryDate }: { expiryDate?: string | null }) => {
  const days = daysUntilExpiry(expiryDate)
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
   BATCH INVENTORY PAGE
   ================================================================ */

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "quarantine", label: "Quarantine" },
  { value: "recalled", label: "Recalled" },
  { value: "expired", label: "Expired" },
  { value: "depleted", label: "Depleted" },
]

const BatchInventoryPage = () => {
  const [batches, setBatches] = useState<InventoryBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [nearExpiry, setNearExpiry] = useState(false)
  const [recalling, setRecalling] = useState<string | null>(null)

  const fetchInventory = useCallback(async () => {
    setLoading(true)
    try {
      const query: Record<string, string> = {}
      if (statusFilter !== "all") query.status = statusFilter
      if (nearExpiry) query.near_expiry = "true"

      const json = await sdk.client.fetch<{ data?: InventoryBatch[] }>(
        "/admin/warehouse/inventory",
        { query }
      )
      setBatches(json.data ?? [])
    } catch (err: any) {
      console.error("[warehouse-inventory]", err)
      toast.error("Failed to load inventory", { description: err.message })
      setBatches([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, nearExpiry])

  useEffect(() => { fetchInventory() }, [fetchInventory])

  const handleRecall = async (batch: InventoryBatch) => {
    setRecalling(batch.id)
    try {
      await sdk.client.fetch<{ success: boolean }>(`/admin/pharma/batches/${batch.id}/recall`, {
        method: "POST",
        body: { batch_id: batch.id },
      })
      toast.success(`Batch ${batch.batch_number} recalled successfully`)
      fetchInventory()
    } catch (err: any) {
      toast.error("Failed to recall batch", { description: err.message })
    } finally {
      setRecalling(null)
    }
  }

  // Client-side search filter
  const filtered = batches.filter((b) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      b.product_id?.toLowerCase().includes(q) ||
      b.product_title?.toLowerCase().includes(q) ||
      b.batch_number?.toLowerCase().includes(q) ||
      b.lot_number?.toLowerCase().includes(q)
    )
  })

  const activeCount = batches.filter((b) => b.status === "active").length
  const quarantineCount = batches.filter((b) => b.status === "quarantine").length
  const nearExpiryCount = batches.filter((b) => {
    const days = daysUntilExpiry(b.expiry_date)
    return days !== null && days >= 0 && days < 90
  }).length

  return (
    <div className="flex flex-col gap-4">
      <Container className="p-6">
        <Heading level="h1" className="mb-2">Batch Inventory</Heading>
        <Text className="text-ui-fg-subtle">
          Browse pharmaceutical batch inventory — monitor expiry dates, stock levels, and batch status.
        </Text>
      </Container>

      {/* Stats */}
      <Container className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard label="Active Batches" value={activeCount} sub="In circulation" />
          <StatCard label="Quarantine" value={quarantineCount} sub="Under hold" />
          <StatCard label="Near Expiry" value={nearExpiryCount} sub="Within 90 days" />
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="w-64">
            <Text className="text-xs text-ui-fg-subtle mb-1">Search</Text>
            <input
              type="text"
              className="w-full rounded-md border border-ui-border-base bg-ui-bg-field px-3 py-1.5 text-sm text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:ring-1 focus:ring-ui-border-interactive"
              placeholder="Product name or batch #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="w-44">
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

          <div className="flex items-center gap-2 pb-0.5">
            <input
              id="near-expiry-toggle"
              type="checkbox"
              className="h-4 w-4 rounded border border-ui-border-base cursor-pointer"
              checked={nearExpiry}
              onChange={(e) => setNearExpiry(e.target.checked)}
            />
            <label htmlFor="near-expiry-toggle" className="text-sm text-ui-fg-base cursor-pointer">
              Near expiry only (&lt;90 days)
            </label>
          </div>

          <Button variant="secondary" size="small" onClick={fetchInventory}>
            <ArrowPath /> Refresh
          </Button>
        </div>

        {/* Table */}
        {loading ? (
          <Text className="text-ui-fg-subtle p-4">Loading inventory...</Text>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Text className="text-ui-fg-subtle mb-1">No batches found.</Text>
            <Text className="text-xs text-ui-fg-muted">
              Inventory batches are created when GRNs are processed.
            </Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Product</Table.HeaderCell>
                <Table.HeaderCell>Batch #</Table.HeaderCell>
                <Table.HeaderCell>Lot Number</Table.HeaderCell>
                <Table.HeaderCell>Expiry Date</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Available Qty</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Reserved Qty</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell className="text-right">MRP (₹)</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filtered.map((batch) => (
                <Table.Row key={batch.id}>
                  <Table.Cell>
                    <div>
                      {batch.product_title && (
                        <Text className="text-sm font-medium">{batch.product_title}</Text>
                      )}
                      <Text className="text-xs text-ui-fg-subtle font-mono">
                        {batch.product_id?.slice(-12) || "—"}
                      </Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm font-mono">{batch.batch_number || "—"}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm font-mono">{batch.lot_number || "—"}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <ExpiryBadge expiryDate={batch.expiry_date} />
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Text className="text-sm font-medium">{batch.quantity_available ?? 0}</Text>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Text className="text-sm text-ui-fg-subtle">{batch.quantity_reserved ?? 0}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={batchStatusColor(batch.status)}>{cap(batch.status)}</Badge>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Text className="text-sm">
                      {batch.mrp != null
                        ? `₹${(batch.mrp / 100).toFixed(2)}`
                        : "—"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    {batch.status === "active" && (
                      <Button
                        variant="danger"
                        size="small"
                        disabled={recalling === batch.id}
                        onClick={() => handleRecall(batch)}
                      >
                        {recalling === batch.id ? "Recalling..." : "Recall"}
                      </Button>
                    )}
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
  label: "Batch Inventory",
  icon: ArchiveBox,
})

export default BatchInventoryPage
