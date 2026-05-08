import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Container,
  Heading,
  Input,
  Table,
  Text,
  Button,
  Tooltip,
} from "@medusajs/ui"
import { Users, MagnifyingGlass, ArrowDownTray } from "@medusajs/icons"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { sdk } from "../../lib/client"

// ── Types ─────────────────────────────────────────────────────────────────────

type Customer = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  has_account: boolean
  created_at: string
  metadata: Record<string, unknown> | null
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

function getPhone(c: Customer): { phone: string; via_otp: boolean } {
  if (c.phone && c.phone.trim()) return { phone: c.phone.trim(), via_otp: false }
  const meta = c.metadata
  if (meta && typeof meta === "object") {
    const metaPhone = (meta as Record<string, unknown>).phone
    if (typeof metaPhone === "string" && metaPhone.trim()) {
      return { phone: metaPhone.trim(), via_otp: true }
    }
  }
  return { phone: "—", via_otp: false }
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
  const header = ["Email", "Name", "Phone", "Phone Source", "Account", "Created"]
  const lines = [header.join(",")]
  for (const c of rows) {
    const { phone, via_otp } = getPhone(c)
    const cells = [
      c.email || "",
      fullName(c),
      phone === "—" ? "" : phone,
      phone === "—" ? "" : via_otp ? "metadata (OTP)" : "customer.phone",
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
        const res = await sdk.client.fetch<ListResponse>("/admin/customers", {
          query: {
            limit: PAGE_SIZE,
            offset: opts.page * PAGE_SIZE,
            ...(opts.search ? { q: opts.search } : {}),
            // Bring metadata so we can fall back to metadata.phone for
            // OTP-signup customers (their phone lives there, not on customer.phone).
            fields:
              "id,email,first_name,last_name,phone,has_account,created_at,metadata",
          },
        })
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

  const stats = useMemo(() => {
    let withPhone = 0
    let viaOtp = 0
    for (const c of rows) {
      const { phone, via_otp } = getPhone(c)
      if (phone !== "—") withPhone++
      if (via_otp) viaOtp++
    }
    return { withPhone, viaOtp, total: rows.length }
  }, [rows])

  return (
    <Container className="divide-y p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>Customer Directory</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            All customers with phone numbers. OTP-signup phones come from
            customer metadata; password/checkout phones from the standard
            phone field.
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
            {stats.withPhone}/{stats.total} on this page have phone
          </span>
          {stats.viaOtp > 0 && (
            <>
              <span>·</span>
              <span>{stats.viaOtp} via OTP</span>
            </>
          )}
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
              <Table.HeaderCell>Account</Table.HeaderCell>
              <Table.HeaderCell>Created</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading && rows.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={5}>
                  <Text size="small" className="text-ui-fg-subtle py-6 text-center">
                    Loading…
                  </Text>
                </Table.Cell>
              </Table.Row>
            )}
            {!loading && rows.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={5}>
                  <Text size="small" className="text-ui-fg-subtle py-6 text-center">
                    {search ? "No customers match your search." : "No customers yet."}
                  </Text>
                </Table.Cell>
              </Table.Row>
            )}
            {rows.map((c) => {
              const { phone, via_otp } = getPhone(c)
              return (
                <Table.Row
                  key={c.id}
                  onClick={() => {
                    // Send to Medusa's built-in customer detail page
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
                    <div className="flex items-center gap-2">
                      <Text size="small" className="font-mono">
                        {phone}
                      </Text>
                      {via_otp && (
                        <Tooltip content="Phone collected via OTP signup (stored in customer.metadata.phone)">
                          <Badge size="2xsmall" color="blue">
                            OTP
                          </Badge>
                        </Tooltip>
                      )}
                    </div>
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
