import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Select,
  Table,
  Tabs,
  Text,
  toast,
} from "@medusajs/ui"
import { ArrowPath, CheckCircleSolid, CommandLineSolid } from "@medusajs/icons"
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { sdk } from "../../lib/client"

// ── Types ────────────────────────────────────────────────────────────────────

type PrescriptionLine = {
  id: string
  drug_name: string
  dosage: string | null
  quantity: number | null
  status: string
}

type Prescription = {
  id: string
  customer_id: string | null
  guest_phone: string | null
  status: string
  patient_name: string | null
  doctor_name: string | null
  doctor_reg_no: string | null
  lines: PrescriptionLine[]
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

type PreDispatchSignOff = {
  id: string
  order_id: string
  pharmacist_id: string
  checklist_results: Record<string, boolean> | null
  all_passed: boolean
  notes: string | null
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

const decisionColor = (
  d: string
): "green" | "red" | "orange" | "blue" | "grey" => {
  const map: Record<string, "green" | "red" | "orange" | "blue" | "grey"> = {
    approved: "green",
    rejected: "red",
    substituted: "orange",
    quantity_modified: "blue",
  }
  return map[d] ?? "grey"
}

const cap = (s: string) =>
  s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())

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

// ── Tab 1: Rx Queue ──────────────────────────────────────────────────────────

const RxQueueTab = () => {
  const navigate = useNavigate()
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    try {
      const json = await sdk.client.fetch<{ prescriptions: Prescription[] }>(
        "/admin/prescriptions",
        { query: { status: "pending_review" } }
      )
      setPrescriptions(json.prescriptions ?? [])
    } catch (err) {
      console.error("[dispense-rx-queue]", err)
      toast.error("Failed to load prescription queue")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  const totalPendingLines = prescriptions.reduce(
    (sum, rx) =>
      sum + (rx.lines?.filter((l) => l.status === "pending_review").length ?? 0),
    0
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Pending Prescriptions"
          value={prescriptions.length}
          sub="Awaiting pharmacist review"
        />
        <StatCard
          label="Pending Line Items"
          value={totalPendingLines}
          sub="Individual drugs to review"
        />
        <StatCard
          label="Oldest Waiting"
          value={
            prescriptions.length > 0
              ? fmtDate(prescriptions[prescriptions.length - 1].created_at)
              : "—"
          }
        />
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" size="small" onClick={fetchQueue}>
          <ArrowPath />
          Refresh
        </Button>
      </div>

      {loading ? (
        <Text className="text-ui-fg-subtle p-4">
          Loading prescription queue...
        </Text>
      ) : prescriptions.length === 0 ? (
        <div className="flex flex-col items-center p-8">
          <CheckCircleSolid className="w-8 h-8 text-ui-fg-subtle mb-2" />
          <Text className="text-ui-fg-subtle">
            No prescriptions awaiting review. Queue is clear.
          </Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Rx ID</Table.HeaderCell>
              <Table.HeaderCell>Patient</Table.HeaderCell>
              <Table.HeaderCell>Doctor</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Items</Table.HeaderCell>
              <Table.HeaderCell className="text-right">
                Pending
              </Table.HeaderCell>
              <Table.HeaderCell>Submitted</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {prescriptions.map((rx) => {
              const pendingCount =
                rx.lines?.filter((l) => l.status === "pending_review").length ??
                0

              return (
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
                    <Text className="text-sm">
                      {rx.patient_name || rx.guest_phone || "Unknown"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <div>
                      <Text className="text-sm">
                        {rx.doctor_name || "—"}
                      </Text>
                      {rx.doctor_reg_no && (
                        <Text className="text-xs text-ui-fg-muted">
                          Reg: {rx.doctor_reg_no}
                        </Text>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color="orange">{cap(rx.status)}</Badge>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Text className="text-sm">{rx.lines?.length ?? 0}</Text>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    {pendingCount > 0 ? (
                      <Badge color="red">{pendingCount}</Badge>
                    ) : (
                      <Badge color="green">0</Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm text-ui-fg-subtle">
                      {fmtDateTime(rx.created_at)}
                    </Text>
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

// ── Tab 2: Decisions Log ─────────────────────────────────────────────────────

const DecisionsLogTab = () => {
  const [decisions, setDecisions] = useState<DispenseDecision[]>([])
  const [loading, setLoading] = useState(true)
  const [decisionFilter, setDecisionFilter] = useState("all")
  const [searchText, setSearchText] = useState("")

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
    } catch (err) {
      console.error("[dispense-decisions]", err)
      toast.error("Failed to load dispense decisions")
    } finally {
      setLoading(false)
    }
  }, [decisionFilter])

  useEffect(() => {
    fetchDecisions()
  }, [fetchDecisions])

  const filtered = searchText.trim()
    ? decisions.filter(
        (d) =>
          d.id.toLowerCase().includes(searchText.toLowerCase()) ||
          d.prescription_drug_line_id
            .toLowerCase()
            .includes(searchText.toLowerCase()) ||
          d.pharmacist_id.toLowerCase().includes(searchText.toLowerCase()) ||
          (d.patient_name ?? "")
            .toLowerCase()
            .includes(searchText.toLowerCase())
      )
    : decisions

  const summary = {
    approved: decisions.filter((d) => d.decision === "approved").length,
    rejected: decisions.filter((d) => d.decision === "rejected").length,
    substituted: decisions.filter((d) => d.decision === "substituted").length,
    quantity_modified: decisions.filter(
      (d) => d.decision === "quantity_modified"
    ).length,
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Approved"
          value={summary.approved}
          sub="Dispensed as prescribed"
        />
        <StatCard
          label="Rejected"
          value={summary.rejected}
          sub="Not dispensed"
        />
        <StatCard
          label="Substituted"
          value={summary.substituted}
          sub="Generic/alternative given"
        />
        <StatCard
          label="Qty Modified"
          value={summary.quantity_modified}
          sub="Quantity adjusted"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Text className="text-xs text-ui-fg-subtle mb-1">
            Filter by decision
          </Text>
          <Select
            value={decisionFilter}
            onValueChange={(v) => setDecisionFilter(v)}
          >
            <Select.Trigger>
              <Select.Value placeholder="All decisions" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All Decisions</Select.Item>
              <Select.Item value="approved">Approved</Select.Item>
              <Select.Item value="rejected">Rejected</Select.Item>
              <Select.Item value="substituted">Substituted</Select.Item>
              <Select.Item value="quantity_modified">
                Qty Modified
              </Select.Item>
            </Select.Content>
          </Select>
        </div>
        <div className="w-64">
          <Text className="text-xs text-ui-fg-subtle mb-1">Search</Text>
          <Input
            placeholder="Search by ID, patient, pharmacist..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <Button variant="secondary" size="small" onClick={fetchDecisions}>
          <ArrowPath />
          Refresh
        </Button>
      </div>

      {loading ? (
        <Text className="text-ui-fg-subtle p-4">Loading decisions...</Text>
      ) : filtered.length === 0 ? (
        <Text className="text-ui-fg-subtle p-4">No decisions found.</Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Decision ID</Table.HeaderCell>
              <Table.HeaderCell>Rx Line</Table.HeaderCell>
              <Table.HeaderCell>Patient</Table.HeaderCell>
              <Table.HeaderCell>Decision</Table.HeaderCell>
              <Table.HeaderCell>Pharmacist</Table.HeaderCell>
              <Table.HeaderCell>Reason / Notes</Table.HeaderCell>
              <Table.HeaderCell>Date</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {filtered.map((d) => (
              <Table.Row key={d.id}>
                <Table.Cell>
                  <Text className="font-mono text-sm">
                    {d.id.slice(-10)}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="font-mono text-sm">
                    {d.prescription_drug_line_id.slice(-10)}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm">
                    {d.patient_name || "—"}
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
                  <Text className="font-mono text-sm">
                    {d.pharmacist_id.slice(-10)}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm text-ui-fg-subtle max-w-[200px] truncate">
                    {d.rejection_reason ||
                      d.override_reason ||
                      d.dispensing_notes ||
                      "—"}
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

// ── Tab 3: Pre-Dispatch Sign-offs ────────────────────────────────────────────

const PreDispatchTab = () => {
  const [signOffs, setSignOffs] = useState<PreDispatchSignOff[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchSignOffs = useCallback(async () => {
    setLoading(true)
    try {
      const json = await sdk.client.fetch<{ sign_offs: PreDispatchSignOff[] }>(
        "/admin/dispense/pre-dispatch"
      )
      setSignOffs(json.sign_offs ?? [])
    } catch (err) {
      console.error("[dispense-pre-dispatch]", err)
      toast.error("Failed to load pre-dispatch sign-offs")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSignOffs()
  }, [fetchSignOffs])

  const passCount = signOffs.filter((s) => s.all_passed).length
  const failCount = signOffs.filter((s) => !s.all_passed).length

  const renderChecklist = (results: Record<string, boolean> | null) => {
    if (!results) return <Text className="text-sm text-ui-fg-subtle">No checklist data</Text>

    return (
      <div className="flex flex-col gap-1 mt-2 p-3 bg-ui-bg-subtle rounded-lg">
        {Object.entries(results).map(([check, passed]) => (
          <div key={check} className="flex items-center gap-2">
            {passed ? (
              <span className="text-green-600 text-sm">&#10003;</span>
            ) : (
              <span className="text-red-500 text-sm">&#10007;</span>
            )}
            <Text className="text-sm">{cap(check)}</Text>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Sign-offs" value={signOffs.length} />
        <StatCard label="All Passed" value={passCount} sub="Cleared for dispatch" />
        <StatCard label="Failed" value={failCount} sub="Requires attention" />
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" size="small" onClick={fetchSignOffs}>
          <ArrowPath />
          Refresh
        </Button>
      </div>

      {loading ? (
        <Text className="text-ui-fg-subtle p-4">Loading sign-offs...</Text>
      ) : signOffs.length === 0 ? (
        <Text className="text-ui-fg-subtle p-4">
          No pre-dispatch sign-offs recorded.
        </Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Order ID</Table.HeaderCell>
              <Table.HeaderCell>Pharmacist</Table.HeaderCell>
              <Table.HeaderCell>Result</Table.HeaderCell>
              <Table.HeaderCell>Checklist</Table.HeaderCell>
              <Table.HeaderCell>Notes</Table.HeaderCell>
              <Table.HeaderCell>Date</Table.HeaderCell>
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
                  <Text className="font-mono text-sm">
                    {s.pharmacist_id.slice(-10)}
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
                  <div>
                    <Button
                      variant="transparent"
                      size="small"
                      onClick={() =>
                        setExpandedId(expandedId === s.id ? null : s.id)
                      }
                    >
                      {expandedId === s.id ? "Hide" : "View"} Checklist
                    </Button>
                    {expandedId === s.id &&
                      renderChecklist(s.checklist_results)}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm text-ui-fg-subtle max-w-[200px] truncate">
                    {s.notes || "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm text-ui-fg-subtle whitespace-nowrap">
                    {fmtDateTime(s.created_at)}
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

// ── Main Page ────────────────────────────────────────────────────────────────

const DispensePage = () => {
  return (
    <div className="flex flex-col gap-4">
      <Container className="p-6">
        <Heading level="h1" className="mb-2">
          Pharmacist Dispense Management
        </Heading>
        <Text className="text-ui-fg-subtle">
          Review prescriptions, record clinical decisions, and complete
          pre-dispatch sign-offs. All actions are logged for CDSCO compliance.
        </Text>
      </Container>

      <Container className="p-6">
        <Tabs defaultValue="rx-queue">
          <Tabs.List>
            <Tabs.Trigger value="rx-queue">Rx Queue</Tabs.Trigger>
            <Tabs.Trigger value="decisions">Decisions Log</Tabs.Trigger>
            <Tabs.Trigger value="pre-dispatch">
              Pre-Dispatch Sign-offs
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="rx-queue" className="pt-4">
            <RxQueueTab />
          </Tabs.Content>

          <Tabs.Content value="decisions" className="pt-4">
            <DecisionsLogTab />
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
  label: "Dispense",
  icon: CommandLineSolid,
})

export default DispensePage
