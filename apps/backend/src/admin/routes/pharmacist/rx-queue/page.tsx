import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Select,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { ArrowLeftMini, ArrowPath } from "@medusajs/icons"
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { sdk } from "../../../lib/client"

/* ================================================================
   TYPES
   ================================================================ */

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

const rxStatusColor = (
  s: string
): "orange" | "green" | "red" | "grey" | "blue" => {
  const map: Record<string, "orange" | "green" | "red" | "grey" | "blue"> = {
    pending_review: "orange",
    approved: "green",
    rejected: "red",
    expired: "grey",
  }
  return map[s] ?? "grey"
}

/* ================================================================
   PAGINATION HELPERS
   ================================================================ */

const PAGE_SIZE = 20

/* ================================================================
   PAGE COMPONENT
   ================================================================ */

const RxQueuePage = () => {
  const navigate = useNavigate()

  const [allItems, setAllItems] = useState<RxQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [navigatingNext, setNavigatingNext] = useState(false)

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    setPage(0)
    try {
      // Try dedicated endpoint first
      try {
        const json = await sdk.client.fetch<{ rx_queue: RxQueueItem[] }>(
          "/admin/pharmacist/rx-queue"
        )
        const raw = json.rx_queue ?? []
        const sorted = [...raw].sort((a, b) => {
          if (a.has_h1 && !b.has_h1) return -1
          if (!a.has_h1 && b.has_h1) return 1
          return (
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
          )
        })
        setAllItems(sorted)
        return
      } catch {
        // Fall through to prescriptions endpoint
      }

      // Fallback: fetch all prescriptions and map
      const json = await sdk.client.fetch<{ prescriptions: any[] }>(
        "/admin/prescriptions"
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
        has_h1:
          rx.lines?.some(
            (l: any) => l.is_h1 || l.schedule === "H1"
          ) ?? false,
        created_at: rx.created_at,
      }))

      const sorted = [...mapped].sort((a, b) => {
        if (a.has_h1 && !b.has_h1) return -1
        if (!a.has_h1 && b.has_h1) return 1
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      })
      setAllItems(sorted)
    } catch (err: any) {
      console.error("[rx-queue-page]", err)
      toast.error("Failed to load Rx queue", { description: err.message })
      setAllItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  // Apply filters + search
  const filtered = allItems.filter((rx) => {
    // Status filter
    if (statusFilter !== "all" && rx.status !== statusFilter) return false

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date()
      const created = new Date(rx.created_at)
      if (dateFilter === "today") {
        const todayStart = new Date(now)
        todayStart.setHours(0, 0, 0, 0)
        if (created < todayStart) return false
      } else if (dateFilter === "week") {
        const weekStart = new Date(now)
        weekStart.setDate(weekStart.getDate() - 7)
        weekStart.setHours(0, 0, 0, 0)
        if (created < weekStart) return false
      }
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      const matchId = rx.id.toLowerCase().includes(q)
      const matchName = (rx.customer_name || "").toLowerCase().includes(q)
      const matchPhone = (rx.guest_phone || "").toLowerCase().includes(q)
      const matchCustomer = (rx.customer_id || "").toLowerCase().includes(q)
      if (!matchId && !matchName && !matchPhone && !matchCustomer) return false
    }

    return true
  })

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleReviewNext = async () => {
    const oldestPending = allItems.find((rx) => rx.status === "pending_review")
    if (!oldestPending) {
      toast.error("No pending prescriptions in the queue")
      return
    }
    setNavigatingNext(true)
    navigate(`/prescriptions/${oldestPending.id}`)
  }

  const pendingCount = allItems.filter(
    (rx) => rx.status === "pending_review"
  ).length
  const h1Count = allItems.filter((rx) => rx.has_h1).length

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <Container className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="transparent"
              size="small"
              onClick={() => navigate("/pharmacist")}
            >
              <ArrowLeftMini />
            </Button>
            <Heading level="h1">Prescription Review Queue</Heading>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="small"
              onClick={fetchQueue}
              disabled={loading}
            >
              <ArrowPath /> Refresh
            </Button>
            <Button
              variant="primary"
              size="small"
              onClick={handleReviewNext}
              disabled={navigatingNext || pendingCount === 0}
            >
              {navigatingNext ? "Loading..." : "Review Next"}
            </Button>
          </div>
        </div>

        {/* Summary chips */}
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1">
            <Badge color="orange">{pendingCount}</Badge>
            <Text className="text-ui-fg-subtle">Pending</Text>
          </div>
          {h1Count > 0 && (
            <div className="flex items-center gap-1">
              <Badge color="red">{h1Count}</Badge>
              <Text className="text-ui-fg-subtle">H1 Priority</Text>
            </div>
          )}
          <Text className="text-ui-fg-muted">{allItems.length} total</Text>
        </div>
      </Container>

      {/* Filter Bar */}
      <Container className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Text className="text-xs text-ui-fg-subtle mb-1">Search</Text>
            <Input
              placeholder="Search by Rx ID, customer, phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
              }}
              className="w-72"
            />
          </div>

          <div className="w-44">
            <Text className="text-xs text-ui-fg-subtle mb-1">Status</Text>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v)
                setPage(0)
              }}
            >
              <Select.Trigger>
                <Select.Value placeholder="All Statuses" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">All Statuses</Select.Item>
                <Select.Item value="pending_review">Pending Review</Select.Item>
                <Select.Item value="approved">Approved</Select.Item>
                <Select.Item value="rejected">Rejected</Select.Item>
                <Select.Item value="expired">Expired</Select.Item>
              </Select.Content>
            </Select>
          </div>

          <div className="w-36">
            <Text className="text-xs text-ui-fg-subtle mb-1">Date</Text>
            <Select
              value={dateFilter}
              onValueChange={(v) => {
                setDateFilter(v)
                setPage(0)
              }}
            >
              <Select.Trigger>
                <Select.Value placeholder="All Time" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">All Time</Select.Item>
                <Select.Item value="today">Today</Select.Item>
                <Select.Item value="week">Last 7 Days</Select.Item>
              </Select.Content>
            </Select>
          </div>

          {(search || statusFilter !== "all" || dateFilter !== "all") && (
            <Button
              variant="transparent"
              size="small"
              onClick={() => {
                setSearch("")
                setStatusFilter("all")
                setDateFilter("all")
                setPage(0)
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </Container>

      {/* Table */}
      <Container className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Text className="text-ui-fg-subtle">Loading prescriptions...</Text>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Text className="text-ui-fg-subtle mb-1">
              No prescriptions match your filters.
            </Text>
            {(search || statusFilter !== "all" || dateFilter !== "all") && (
              <Text className="text-xs text-ui-fg-muted">
                Try clearing the filters.
              </Text>
            )}
          </div>
        ) : (
          <>
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
                {paginated.map((rx) => (
                  <Table.Row
                    key={rx.id}
                    className="cursor-pointer hover:bg-ui-bg-subtle-hover"
                    onClick={() => navigate(`/prescriptions/${rx.id}`)}
                  >
                    <Table.Cell>
                      <Text className="font-mono text-sm font-medium">
                        {rx.id.slice(-12)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <div>
                        <Text className="text-sm">
                          {rx.customer_name ||
                            rx.guest_phone ||
                            rx.customer_id?.slice(-8) ||
                            "Unknown"}
                        </Text>
                        {rx.customer_id && (
                          <Text className="text-xs text-ui-fg-muted font-mono">
                            {rx.customer_id.slice(-8)}
                          </Text>
                        )}
                      </div>
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
                        {fmtDateTime(rx.created_at)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell onClick={(e) => e.stopPropagation()}>
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-ui-border-base">
                <Text className="text-xs text-ui-fg-subtle">
                  Showing {page * PAGE_SIZE + 1}–
                  {Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{" "}
                  {filtered.length} prescriptions
                </Text>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="small"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Text className="text-sm">
                    {page + 1} / {totalPages}
                  </Text>
                  <Button
                    variant="secondary"
                    size="small"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Container>
    </div>
  )
}

export default RxQueuePage
