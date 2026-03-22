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
  Tabs,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { ShieldCheck, ArrowPath, MagnifyingGlass } from "@medusajs/icons"
import { useCallback, useEffect, useState } from "react"
import { sdk } from "../../lib/client"

// ── Types ────────────────────────────────────────────────────────────────────

type PhiAuditLog = {
  id: string
  user_id: string
  role: string
  action: "read" | "write" | "update" | "export" | "print"
  entity_type: string
  entity_id: string
  ip_address: string
  user_agent: string
  access_granted: boolean
  created_at: string
}

type DpdpConsent = {
  id: string
  customer_id: string | null
  session_id: string | null
  category: "essential" | "functional" | "analytics" | "marketing"
  consented: boolean
  consent_given_at: string
  withdrawn_at: string | null
  ip_address: string
  user_agent: string
  privacy_policy_version: string
  created_at: string
}

type PharmacyLicense = {
  id: string
  license_number: string
  license_type: string
  issued_by: string
  valid_from: string
  valid_until: string
  document_url: string | null
  is_active: boolean
  metadata: Record<string, unknown> | null
  created_at: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

const isExpiringSoon = (validUntil: string) => {
  const diff = new Date(validUntil).getTime() - Date.now()
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
}

const isExpired = (validUntil: string) =>
  new Date(validUntil).getTime() < Date.now()

const actionBadgeColor = (
  action: string
): "green" | "blue" | "orange" | "red" | "grey" => {
  const map: Record<string, "green" | "blue" | "orange" | "red" | "grey"> = {
    read: "blue",
    write: "green",
    update: "orange",
    export: "grey",
    print: "grey",
  }
  return map[action] ?? "grey"
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

// ── PHI Audit Log Tab ────────────────────────────────────────────────────────

const PhiAuditLogTab = () => {
  const [logs, setLogs] = useState<PhiAuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [actionFilter, setActionFilter] = useState("all")
  const [searchText, setSearchText] = useState("")
  const limit = 50

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const query: Record<string, string> = {
        limit: String(limit),
        offset: String(offset),
      }
      if (actionFilter !== "all") query.action = actionFilter
      if (searchText.trim()) query.q = searchText.trim()

      const json = await sdk.client.fetch<{ logs?: PhiAuditLog[]; phi_audit_logs?: PhiAuditLog[]; count?: number; total?: number }>(
        "/admin/compliance/phi-logs",
        { query }
      )
      setLogs(json.logs ?? json.phi_audit_logs ?? [])
      setTotal(json.count ?? json.total ?? 0)
    } catch (err) {
      console.error("[compliance-phi-logs]", err)
      toast.error("Failed to load PHI audit logs")
    } finally {
      setLoading(false)
    }
  }, [offset, actionFilter, searchText])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const currentPage = Math.floor(offset / limit) + 1

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Text className="text-xs text-ui-fg-subtle mb-1">
            Filter by action
          </Text>
          <Select
            value={actionFilter}
            onValueChange={(v) => {
              setActionFilter(v)
              setOffset(0)
            }}
          >
            <Select.Trigger>
              <Select.Value placeholder="All actions" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All actions</Select.Item>
              <Select.Item value="read">Read</Select.Item>
              <Select.Item value="write">Write</Select.Item>
              <Select.Item value="update">Update</Select.Item>
              <Select.Item value="export">Export</Select.Item>
              <Select.Item value="print">Print</Select.Item>
            </Select.Content>
          </Select>
        </div>
        <div className="w-64">
          <Text className="text-xs text-ui-fg-subtle mb-1">Search</Text>
          <Input
            placeholder="Search by entity, user..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setOffset(0)
                fetchLogs()
              }
            }}
          />
        </div>
        <Button
          variant="secondary"
          size="small"
          onClick={() => {
            setOffset(0)
            fetchLogs()
          }}
        >
          <MagnifyingGlass />
          Search
        </Button>
        <Button variant="secondary" size="small" onClick={fetchLogs}>
          <ArrowPath />
          Refresh
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <Text className="text-ui-fg-subtle p-4">Loading audit logs...</Text>
      ) : logs.length === 0 ? (
        <Text className="text-ui-fg-subtle p-4">No audit logs found.</Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Timestamp</Table.HeaderCell>
              <Table.HeaderCell>Actor</Table.HeaderCell>
              <Table.HeaderCell>Role</Table.HeaderCell>
              <Table.HeaderCell>Action</Table.HeaderCell>
              <Table.HeaderCell>Entity Type</Table.HeaderCell>
              <Table.HeaderCell>Entity ID</Table.HeaderCell>
              <Table.HeaderCell>IP Address</Table.HeaderCell>
              <Table.HeaderCell>Granted</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {logs.map((log) => (
              <Table.Row key={log.id}>
                <Table.Cell>
                  <Text className="text-sm text-ui-fg-subtle whitespace-nowrap">
                    {fmtDateTime(log.created_at)}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm font-mono">
                    {log.user_id?.slice(-12) ?? "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm">{log.role}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={actionBadgeColor(log.action)}>
                    {log.action.toUpperCase()}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm">{log.entity_type}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm font-mono">
                    {log.entity_id?.slice(-12) ?? "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm font-mono">{log.ip_address}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={log.access_granted ? "green" : "red"}>
                    {log.access_granted ? "Yes" : "No"}
                  </Badge>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between pt-2">
          <Text className="text-sm text-ui-fg-subtle">
            Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </Text>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="small"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Previous
            </Button>
            <Text className="text-sm self-center px-2">
              Page {currentPage} of {totalPages}
            </Text>
            <Button
              variant="secondary"
              size="small"
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── DPDP Consents Tab ────────────────────────────────────────────────────────

const DpdpConsentsTab = () => {
  const [consents, setConsents] = useState<DpdpConsent[]>([])
  const [loading, setLoading] = useState(true)

  const fetchConsents = useCallback(async () => {
    setLoading(true)
    try {
      const json = await sdk.client.fetch<{ consents?: DpdpConsent[]; dpdp_consents?: DpdpConsent[] }>(
        "/admin/compliance/dpdp-consents"
      )
      setConsents(json.consents ?? json.dpdp_consents ?? [])
    } catch (err) {
      console.error("[compliance-dpdp]", err)
      toast.error("Failed to load DPDP consent data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConsents()
  }, [fetchConsents])

  const totalConsents = consents.length
  const activeConsents = consents.filter(
    (c) => c.consented && !c.withdrawn_at
  ).length
  const withdrawnConsents = consents.filter((c) => !!c.withdrawn_at).length

  return (
    <div className="flex flex-col gap-4">
      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Consents" value={totalConsents} />
        <StatCard
          label="Active"
          value={activeConsents}
          sub="Currently granted"
        />
        <StatCard
          label="Withdrawn"
          value={withdrawnConsents}
          sub="Consent revoked"
        />
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" size="small" onClick={fetchConsents}>
          <ArrowPath />
          Refresh
        </Button>
      </div>

      {loading ? (
        <Text className="text-ui-fg-subtle p-4">
          Loading consent records...
        </Text>
      ) : consents.length === 0 ? (
        <Text className="text-ui-fg-subtle p-4">
          No consent records found.
        </Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Customer / Session</Table.HeaderCell>
              <Table.HeaderCell>Category</Table.HeaderCell>
              <Table.HeaderCell>Consented</Table.HeaderCell>
              <Table.HeaderCell>Granted At</Table.HeaderCell>
              <Table.HeaderCell>Withdrawn At</Table.HeaderCell>
              <Table.HeaderCell>IP Address</Table.HeaderCell>
              <Table.HeaderCell>Policy Version</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {consents.map((c) => (
              <Table.Row key={c.id}>
                <Table.Cell>
                  <Text className="text-sm font-mono">
                    {c.customer_id
                      ? c.customer_id.slice(-12)
                      : c.session_id?.slice(-12) ?? "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge
                    color={
                      c.category === "essential"
                        ? "green"
                        : c.category === "marketing"
                          ? "orange"
                          : "blue"
                    }
                  >
                    {c.category.charAt(0).toUpperCase() + c.category.slice(1)}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  {c.consented && !c.withdrawn_at ? (
                    <Badge color="green">Yes</Badge>
                  ) : c.withdrawn_at ? (
                    <Badge color="red">Withdrawn</Badge>
                  ) : (
                    <Badge color="grey">No</Badge>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm text-ui-fg-subtle">
                    {fmtDateTime(c.consent_given_at)}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm text-ui-fg-subtle">
                    {c.withdrawn_at ? fmtDateTime(c.withdrawn_at) : "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm font-mono">{c.ip_address}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm">{c.privacy_policy_version}</Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  )
}

// ── Pharmacy Licenses Tab ────────────────────────────────────────────────────

const PharmacyLicensesTab = () => {
  const [licenses, setLicenses] = useState<PharmacyLicense[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLicenses = useCallback(async () => {
    setLoading(true)
    try {
      const json = await sdk.client.fetch<{ licenses?: PharmacyLicense[]; pharmacy_licenses?: PharmacyLicense[] }>(
        "/admin/compliance/pharmacy-licenses"
      )
      setLicenses(json.licenses ?? json.pharmacy_licenses ?? [])
    } catch (err) {
      console.error("[compliance-licenses]", err)
      toast.error("Failed to load pharmacy licenses")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLicenses()
  }, [fetchLicenses])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="secondary" size="small" onClick={fetchLicenses}>
          <ArrowPath />
          Refresh
        </Button>
      </div>

      {loading ? (
        <Text className="text-ui-fg-subtle p-4">Loading licenses...</Text>
      ) : licenses.length === 0 ? (
        <Text className="text-ui-fg-subtle p-4">
          No pharmacy licenses on file.
        </Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>License Number</Table.HeaderCell>
              <Table.HeaderCell>Type</Table.HeaderCell>
              <Table.HeaderCell>Issued By</Table.HeaderCell>
              <Table.HeaderCell>Valid From</Table.HeaderCell>
              <Table.HeaderCell>Valid Until</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {licenses.map((lic) => {
              const expired = isExpired(lic.valid_until)
              const expiring = !expired && isExpiringSoon(lic.valid_until)

              return (
                <Table.Row key={lic.id}>
                  <Table.Cell>
                    <Text className="text-sm font-mono font-medium">
                      {lic.license_number}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm">{lic.license_type}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm">{lic.issued_by}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm text-ui-fg-subtle">
                      {fmtDate(lic.valid_from)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm text-ui-fg-subtle">
                      {fmtDate(lic.valid_until)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      {lic.is_active && !expired ? (
                        <Badge color="green">Active</Badge>
                      ) : (
                        <Badge color="red">
                          {expired ? "Expired" : "Inactive"}
                        </Badge>
                      )}
                      {expiring && (
                        <Badge color="orange">Expiring Soon</Badge>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table>
      )}
    </div>
  )
}

// ── Override Request Types ────────────────────────────────────────────────────

type OverrideRequest = {
  id: string
  override_type: string
  target_entity_type: string
  target_entity_id: string
  requested_by: string
  requested_by_role: string
  justification: string
  patient_impact: string | null
  risk_assessment: string
  supporting_doc_url: string | null
  requires_dual_auth: boolean
  primary_approver_id: string | null
  primary_approved_at: string | null
  secondary_approver_id: string | null
  secondary_approved_at: string | null
  status: "pending_primary" | "pending_secondary" | "approved" | "rejected" | "expired" | "used"
  valid_for_hours: number
  expires_at: string
  used_at: string | null
  notified_cdsco: boolean
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

const overrideStatusColor = (status: string): "orange" | "green" | "red" | "grey" | "blue" | "purple" => {
  const map: Record<string, "orange" | "green" | "red" | "grey" | "blue" | "purple"> = {
    pending_primary: "orange", pending_secondary: "blue", approved: "green",
    rejected: "red", expired: "grey", used: "purple",
  }
  return map[status] ?? "grey"
}

const overrideStatusLabel = (status: string): string => {
  const map: Record<string, string> = {
    pending_primary: "Pending Primary", pending_secondary: "Pending Secondary",
    approved: "Approved", rejected: "Rejected", expired: "Expired", used: "Used",
  }
  return map[status] ?? status
}

// ── Override Detail Drawer ────────────────────────────────────────────────────

const OverrideDetailDrawer = ({
  request, open, onClose, onActionComplete,
}: {
  request: OverrideRequest | null; open: boolean; onClose: () => void; onActionComplete: () => void
}) => {
  const [reviewerNotes, setReviewerNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const isPending = request?.status === "pending_primary" || request?.status === "pending_secondary"

  const handleDecision = async (decision: "approved" | "rejected") => {
    if (!request) return
    if (!reviewerNotes.trim()) { toast.error("Reviewer notes are required"); return }
    setSubmitting(true)
    try {
      await sdk.client.fetch<{ success: boolean }>("/admin/compliance/override-requests", {
        method: "POST",
        body: {
          id: request.id, status: decision, reviewer_notes: reviewerNotes.trim(),
          request_type: request.override_type, request_reason: request.justification,
          entity_type: request.target_entity_type, entity_id: request.target_entity_id,
        },
      })
      toast.success(`Override ${decision === "approved" ? "approved" : "rejected"} successfully`)
      setReviewerNotes(""); onClose(); onActionComplete()
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to update override")
    } finally { setSubmitting(false) }
  }

  if (!request) return null
  const isOverdueExpiry = new Date(request.expires_at).getTime() < Date.now() && isPending

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Content>
        <Drawer.Header><Drawer.Title>Override Request Details</Drawer.Title></Drawer.Header>
        <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center gap-3">
            <Badge color={overrideStatusColor(request.status)} className="text-sm">{overrideStatusLabel(request.status)}</Badge>
            {isOverdueExpiry && <Badge color="red">Past Expiry</Badge>}
            {request.requires_dual_auth && <Badge color="blue">Dual Auth</Badge>}
            {request.notified_cdsco && <Badge color="purple">CDSCO Notified</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Text className="text-xs text-ui-fg-subtle uppercase">Override Type</Text><Text className="text-sm font-medium mt-0.5">{request.override_type}</Text></div>
            <div><Text className="text-xs text-ui-fg-subtle uppercase">Risk</Text><Text className="text-sm font-medium mt-0.5">{request.risk_assessment}</Text></div>
            <div><Text className="text-xs text-ui-fg-subtle uppercase">Entity</Text><Text className="text-sm mt-0.5">{request.target_entity_type}</Text></div>
            <div><Text className="text-xs text-ui-fg-subtle uppercase">Entity ID</Text><Text className="text-sm font-mono mt-0.5">{request.target_entity_id.slice(-16)}</Text></div>
            <div><Text className="text-xs text-ui-fg-subtle uppercase">Requested By</Text><Text className="text-sm font-mono mt-0.5">{request.requested_by.slice(-12)}</Text></div>
            <div><Text className="text-xs text-ui-fg-subtle uppercase">Role</Text><Text className="text-sm mt-0.5">{request.requested_by_role}</Text></div>
            <div><Text className="text-xs text-ui-fg-subtle uppercase">Created</Text><Text className="text-sm mt-0.5">{fmtDateTime(request.created_at)}</Text></div>
            <div><Text className="text-xs text-ui-fg-subtle uppercase">Expires</Text><Text className="text-sm mt-0.5">{fmtDateTime(request.expires_at)}</Text></div>
          </div>
          <div className="border border-ui-border-base rounded-lg p-3">
            <Text className="text-xs text-ui-fg-subtle uppercase mb-1">Justification</Text>
            <Text className="text-sm">{request.justification}</Text>
          </div>
          {request.patient_impact && (
            <div className="border border-ui-border-base rounded-lg p-3">
              <Text className="text-xs text-ui-fg-subtle uppercase mb-1">Patient Impact</Text>
              <Text className="text-sm">{request.patient_impact}</Text>
            </div>
          )}
          {request.supporting_doc_url && (
            <div><Text className="text-xs text-ui-fg-subtle uppercase mb-1">Supporting Document</Text>
              <a href={request.supporting_doc_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">View Document</a>
            </div>
          )}
          {(request.primary_approver_id || request.secondary_approver_id) && (
            <div className="border border-ui-border-base rounded-lg p-3">
              <Text className="text-xs text-ui-fg-subtle uppercase mb-2">Approval Chain</Text>
              {request.primary_approver_id && (
                <div className="flex items-center gap-2 mb-1">
                  <Badge color="green">Primary</Badge>
                  <Text className="text-sm font-mono">{request.primary_approver_id.slice(-12)}</Text>
                  {request.primary_approved_at && <Text className="text-xs text-ui-fg-subtle">at {fmtDateTime(request.primary_approved_at)}</Text>}
                </div>
              )}
              {request.secondary_approver_id && (
                <div className="flex items-center gap-2">
                  <Badge color="blue">Secondary</Badge>
                  <Text className="text-sm font-mono">{request.secondary_approver_id.slice(-12)}</Text>
                  {request.secondary_approved_at && <Text className="text-xs text-ui-fg-subtle">at {fmtDateTime(request.secondary_approved_at)}</Text>}
                </div>
              )}
            </div>
          )}
          {isPending && (
            <div className="border-t border-ui-border-base pt-4 mt-2">
              <Label className="mb-2 block font-medium">Reviewer Notes</Label>
              <Textarea placeholder="Enter review notes (required)..." value={reviewerNotes} onChange={(e) => setReviewerNotes(e.target.value)} rows={3} />
              <div className="flex gap-2 mt-3">
                <Button variant="primary" size="small" disabled={submitting || !reviewerNotes.trim()} onClick={() => handleDecision("approved")}>Approve</Button>
                <Button variant="danger" size="small" disabled={submitting || !reviewerNotes.trim()} onClick={() => handleDecision("rejected")}>Reject</Button>
              </div>
            </div>
          )}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  )
}

// ── Override Requests Tab ─────────────────────────────────────────────────────

const OverrideRequestsTab = () => {
  const [requests, setRequests] = useState<OverrideRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedRequest, setSelectedRequest] = useState<OverrideRequest | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const query: Record<string, string> = {}
      if (statusFilter !== "all") query.status = statusFilter
      const json = await sdk.client.fetch<{ requests?: OverrideRequest[]; override_requests?: OverrideRequest[] }>(
        "/admin/compliance/override-requests", { query }
      )
      setRequests(json.requests ?? json.override_requests ?? [])
    } catch (err) {
      console.error("[overrides]", err)
      toast.error("Failed to load override requests")
    } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const pendingCount = requests.filter((r) => r.status === "pending_primary" || r.status === "pending_secondary").length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 mb-2">
        <div className="w-56">
          <Text className="text-xs text-ui-fg-subtle mb-1">Filter by status</Text>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
            <Select.Trigger><Select.Value placeholder="All statuses" /></Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All statuses</Select.Item>
              <Select.Item value="pending_primary">Pending Primary</Select.Item>
              <Select.Item value="pending_secondary">Pending Secondary</Select.Item>
              <Select.Item value="approved">Approved</Select.Item>
              <Select.Item value="rejected">Rejected</Select.Item>
              <Select.Item value="expired">Expired</Select.Item>
              <Select.Item value="used">Used</Select.Item>
            </Select.Content>
          </Select>
        </div>
        <Button variant="secondary" size="small" onClick={fetchRequests}><ArrowPath /> Refresh</Button>
        {pendingCount > 0 && <Badge color="orange">{pendingCount} pending</Badge>}
      </div>

      {loading ? (
        <Text className="text-ui-fg-subtle p-4">Loading override requests...</Text>
      ) : requests.length === 0 ? (
        <Text className="text-ui-fg-subtle p-4">No override requests found.</Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>ID</Table.HeaderCell>
              <Table.HeaderCell>Type</Table.HeaderCell>
              <Table.HeaderCell>Entity</Table.HeaderCell>
              <Table.HeaderCell>Requested By</Table.HeaderCell>
              <Table.HeaderCell>Risk</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Created</Table.HeaderCell>
              <Table.HeaderCell>Expires</Table.HeaderCell>
              <Table.HeaderCell></Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {requests.map((req) => {
              const isPending = req.status === "pending_primary" || req.status === "pending_secondary"
              const pastExpiry = isPending && new Date(req.expires_at).getTime() < Date.now()
              return (
                <Table.Row key={req.id} className={isPending ? "bg-amber-50/30" : undefined}>
                  <Table.Cell><Text className="text-sm font-mono">{req.id.slice(-8)}</Text></Table.Cell>
                  <Table.Cell><Text className="text-sm font-medium">{req.override_type}</Text></Table.Cell>
                  <Table.Cell><div><Text className="text-sm">{req.target_entity_type}</Text><Text className="text-xs text-ui-fg-muted font-mono">{req.target_entity_id.slice(-12)}</Text></div></Table.Cell>
                  <Table.Cell><div><Text className="text-sm font-mono">{req.requested_by.slice(-12)}</Text><Text className="text-xs text-ui-fg-muted">{req.requested_by_role}</Text></div></Table.Cell>
                  <Table.Cell><Badge color={req.risk_assessment === "high" ? "red" : req.risk_assessment === "medium" ? "orange" : "green"}>{req.risk_assessment}</Badge></Table.Cell>
                  <Table.Cell><div className="flex items-center gap-1"><Badge color={overrideStatusColor(req.status)}>{overrideStatusLabel(req.status)}</Badge>{pastExpiry && <Badge color="red" className="text-[10px]">Overdue</Badge>}</div></Table.Cell>
                  <Table.Cell><Text className="text-sm text-ui-fg-subtle whitespace-nowrap">{fmtDate(req.created_at)}</Text></Table.Cell>
                  <Table.Cell><Text className="text-sm text-ui-fg-subtle whitespace-nowrap">{fmtDate(req.expires_at)}</Text></Table.Cell>
                  <Table.Cell><Button variant="secondary" size="small" onClick={() => { setSelectedRequest(req); setDrawerOpen(true) }}>{isPending ? "Review" : "View"}</Button></Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table>
      )}
      <OverrideDetailDrawer request={selectedRequest} open={drawerOpen} onClose={() => { setDrawerOpen(false); setSelectedRequest(null) }} onActionComplete={fetchRequests} />
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

const CompliancePage = () => {
  return (
    <div className="flex flex-col gap-4">
      <Container className="p-6">
        <Heading level="h1" className="mb-2">
          Compliance Dashboard
        </Heading>
        <Text className="text-ui-fg-subtle">
          Monitor PHI access, DPDP consent records, and pharmacy license
          validity. Required for CDSCO inspections and DPDP Act compliance.
        </Text>
      </Container>

      <Container className="p-6">
        <Tabs defaultValue="phi-audit">
          <Tabs.List>
            <Tabs.Trigger value="phi-audit">PHI Audit Log</Tabs.Trigger>
            <Tabs.Trigger value="dpdp-consents">DPDP Consents</Tabs.Trigger>
            <Tabs.Trigger value="pharmacy-licenses">
              Pharmacy Licenses
            </Tabs.Trigger>
            <Tabs.Trigger value="overrides">
              Override Requests
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="phi-audit" className="pt-4">
            <PhiAuditLogTab />
          </Tabs.Content>

          <Tabs.Content value="dpdp-consents" className="pt-4">
            <DpdpConsentsTab />
          </Tabs.Content>

          <Tabs.Content value="pharmacy-licenses" className="pt-4">
            <PharmacyLicensesTab />
          </Tabs.Content>

          <Tabs.Content value="overrides" className="pt-4">
            <OverrideRequestsTab />
          </Tabs.Content>
        </Tabs>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Compliance",
  icon: ShieldCheck,
})

export default CompliancePage
