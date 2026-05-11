import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Container,
  Heading,
  Input,
  Table,
  Text,
  Button,
} from "@medusajs/ui"
import { Users, MagnifyingGlass, ArrowDownTray } from "@medusajs/icons"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { sdk } from "../../lib/client"

// ── Types ─────────────────────────────────────────────────────────────────────

type LastDevice = {
  ua: string
  os: "Windows" | "macOS" | "Android" | "iOS" | "Linux" | "unknown"
  browser: "Chrome" | "Safari" | "Firefox" | "Edge" | "App" | "unknown"
  platform: "web" | "android-app" | "ios-app"
  at: string
  ip_hash: string
}

type Customer = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  has_account: boolean
  created_at: string
  last_device: LastDevice | null
}

type ListResponse = {
  customers: Customer[]
  count: number
  offset: number
  limit: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

function fullName(c: Customer): string {
  const fn = (c.first_name || "").trim()
  const ln = (c.last_name || "").trim()
  const combined = `${fn} ${ln}`.trim()
  return combined || "—"
}

function getPhone(c: Customer): string {
  return c.phone && c.phone.trim() ? c.phone.trim() : "—"
}

function deviceLabel(d: LastDevice | null): string {
  if (!d) return "—"
  // Format: "Android · Chrome" or "iOS · App" — short for table density
  const plat =
    d.platform === "android-app"
      ? "Android app"
      : d.platform === "ios-app"
        ? "iOS app"
        : d.os
  return d.browser && d.browser !== "App" && d.platform === "web"
    ? `${plat} · ${d.browser}`
    : plat
}

function deviceTone(d: LastDevice | null): string {
  // Subtle color hint per platform — keeps the table scannable
  if (!d) return "grey"
  if (d.platform === "android-app" || d.platform === "ios-app") return "green"
  if (d.os === "Windows" || d.os === "macOS" || d.os === "Linux") return "blue"
  if (d.os === "Android" || d.os === "iOS") return "orange"
  return "grey"
}

function formatRelative(iso: string | undefined): string {
  if (!iso) return ""
  const diffMs = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diffMs / 60_000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  })
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

function exportToCsv(rows: Customer[]): void {
  const header = [
    "Email",
    "Name",
    "Phone",
    "Last device",
    "Last device platform",
    "Last login",
    "Account",
    "Created",
  ]
  const lines = [header.join(",")]
  for (const c of rows) {
    const phone = getPhone(c)
    const cells = [
      c.email || "",
      fullName(c),
      phone === "—" ? "" : phone,
      c.last_device ? deviceLabel(c.last_device) : "",
      c.last_device?.platform || "",
      c.last_device?.at || "",
      c.has_account ? "Registered" : "Guest",
      formatDate(c.created_at),
    ].map((v) => {
      const s = String(v).replace(/"/g, '""')
      return /[",\n]/.test(s) ? `"${s}"` : s
    })
    lines.push(cells.join(","))
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `customer-directory-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Page ──────────────────────────────────────────────────────────────────────

const CustomerDirectoryPage = () => {
  const [rows, setRows] = useState<Customer[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchPage = useCallback(
    async (opts: { search: string; page: number }) => {
      setLoading(true)
      setError(null)
      try {
        // Hits our custom /admin/customer-directory endpoint which joins
        // the auth_identity device snapshot into each customer row.
        const res = await sdk.client.fetch<ListResponse>(
          "/admin/customer-directory",
          {
            query: {
              limit: PAGE_SIZE,
              offset: opts.page * PAGE_SIZE,
              ...(opts.search ? { q: opts.search } : {}),
            },
          }
        )
        setRows(res.customers || [])
        setCount(res.count || 0)
      } catch (err) {
        const msg = (err as Error)?.message || "Failed to load customers"
        setError(msg)
        setRows([])
        setCount(0)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Debounce search → fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchPage({ search, page })
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, page, fetchPage])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(count / PAGE_SIZE)),
    [count]
  )

  const withPhoneCount = useMemo(
    () => rows.filter((c) => getPhone(c) !== "—").length,
    [rows]
  )

  return (
    <Container className="divide-y p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>Customer Directory</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            All customers with email, name, and mobile number. Click any row to
            open the full customer profile.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="small"
            variant="secondary"
            onClick={() => exportToCsv(rows)}
            disabled={rows.length === 0}
          >
            <ArrowDownTray />
            Export page (CSV)
          </Button>
        </div>
      </div>

      {/* Search + stats */}
      <div className="flex items-center justify-between px-6 py-3 gap-3">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-ui-fg-muted" />
          <Input
            placeholder="Search by email, name, or phone..."
            value={search}
            onChange={(e) => {
              setPage(0)
              setSearch(e.target.value)
            }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-ui-fg-subtle">
          <span>{count.toLocaleString("en-IN")} total</span>
          <span>·</span>
          <span>
            {withPhoneCount}/{rows.length} on this page have phone
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-2">
        {error && (
          <div className="rounded-md bg-ui-bg-base-error px-3 py-2 mb-3">
            <Text size="small" className="text-ui-fg-error">
              {error}
            </Text>
          </div>
        )}

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Email</Table.HeaderCell>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Phone</Table.HeaderCell>
              <Table.HeaderCell>Last device</Table.HeaderCell>
              <Table.HeaderCell>Account</Table.HeaderCell>
              <Table.HeaderCell>Created</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading && rows.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={6}>
                  <Text size="small" className="text-ui-fg-subtle py-6 text-center">
                    Loading…
                  </Text>
                </Table.Cell>
              </Table.Row>
            )}
            {!loading && rows.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={6}>
                  <Text size="small" className="text-ui-fg-subtle py-6 text-center">
                    {search ? "No customers match your search." : "No customers yet."}
                  </Text>
                </Table.Cell>
              </Table.Row>
            )}
            {rows.map((c) => {
              const phone = getPhone(c)
              return (
                <Table.Row
                  key={c.id}
                  onClick={() => {
                    window.location.href = `/app/customers/${c.id}`
                  }}
                  className="cursor-pointer"
                >
                  <Table.Cell>
                    <Text size="small">{c.email || "—"}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small">{fullName(c)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="font-mono">
                      {phone}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    {c.last_device ? (
                      <div className="flex items-center gap-2">
                        <Badge
                          size="2xsmall"
                          color={deviceTone(c.last_device) as any}
                        >
                          {deviceLabel(c.last_device)}
                        </Badge>
                        <Text size="small" className="text-ui-fg-subtle">
                          {formatRelative(c.last_device.at)}
                        </Text>
                      </div>
                    ) : (
                      <Text size="small" className="text-ui-fg-subtle">
                        —
                      </Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      size="2xsmall"
                      color={c.has_account ? "green" : "grey"}
                    >
                      {c.has_account ? "Registered" : "Guest"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="text-ui-fg-subtle">
                      {formatDate(c.created_at)}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table>

        {/* Pagination */}
        {count > PAGE_SIZE && (
          <div className="flex items-center justify-between py-3">
            <Text size="small" className="text-ui-fg-subtle">
              Showing {page * PAGE_SIZE + 1}–
              {Math.min((page + 1) * PAGE_SIZE, count)} of{" "}
              {count.toLocaleString("en-IN")}
            </Text>
            <div className="flex items-center gap-2">
              <Button
                size="small"
                variant="secondary"
                disabled={page === 0 || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Text size="small">
                Page {page + 1} of {totalPages}
              </Text>
              <Button
                size="small"
                variant="secondary"
                disabled={page + 1 >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Customer Directory",
  icon: Users,
})

export default CustomerDirectoryPage
