import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  Heading,
  Select,
  Table,
  Text,
} from "@medusajs/ui"
import { DocumentText } from "@medusajs/icons"
import { useEffect, useState } from "react"

type Prescription = {
  id: string
  customer_id: string | null
  guest_phone: string | null
  status: string
  file_url: string | null
  original_filename: string | null
  created_at: string
  patient_name: string | null
  doctor_name: string | null
  reviewed_at: string | null
  lines: any[]
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending_review", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "used", label: "Used" },
]

const statusColor = (s: string) => {
  switch (s) {
    case "pending_review":
      return "orange" as const
    case "approved":
      return "green" as const
    case "rejected":
      return "red" as const
    case "expired":
      return "grey" as const
    case "used":
      return "blue" as const
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
    hour: "2-digit",
    minute: "2-digit",
  })
}

const PrescriptionsQueue = () => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("pending_review")

  const fetchPrescriptions = async (status?: string) => {
    setLoading(true)
    try {
      const qs = status ? `?status=${status}` : ""
      const res = await fetch(`/admin/prescriptions${qs}`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPrescriptions(data.prescriptions ?? [])
    } catch (err) {
      console.error("Failed to fetch prescriptions:", err)
      setPrescriptions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrescriptions(statusFilter === "all" ? undefined : statusFilter)
  }, [statusFilter])

  const pendingCount = prescriptions.filter(
    (p) => p.status === "pending_review"
  ).length

  return (
    <div className="flex flex-col gap-4">
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Heading level="h2">Pharmacist Rx Queue</Heading>
            {statusFilter === "pending_review" && pendingCount > 0 && (
              <Badge color="orange">{pendingCount} pending</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(val) => setStatusFilter(val)}
            >
              <Select.Trigger>
                <Select.Value placeholder="Filter by status" />
              </Select.Trigger>
              <Select.Content>
                {STATUS_OPTIONS.map((opt) => (
                  <Select.Item key={opt.value} value={opt.value}>
                    {opt.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Button
              variant="secondary"
              size="small"
              onClick={() => fetchPrescriptions(statusFilter === "all" ? undefined : statusFilter)}
            >
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 flex justify-center">
            <Text className="text-ui-fg-subtle">Loading prescriptions...</Text>
          </div>
        ) : prescriptions.length === 0 ? (
          <div className="p-6 flex justify-center">
            <Text className="text-ui-fg-subtle">
              No prescriptions found
              {statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}.
            </Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>ID</Table.HeaderCell>
                <Table.HeaderCell>File</Table.HeaderCell>
                <Table.HeaderCell>Patient</Table.HeaderCell>
                <Table.HeaderCell>Customer / Phone</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Uploaded</Table.HeaderCell>
                <Table.HeaderCell>Reviewed</Table.HeaderCell>
                <Table.HeaderCell></Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {prescriptions.map((rx) => (
                <Table.Row key={rx.id}>
                  <Table.Cell>
                    <Text className="font-mono text-xs">
                      {rx.id.slice(-8)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-xs truncate max-w-[160px]">
                      {rx.original_filename || "—"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm">
                      {rx.patient_name || "—"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-xs">
                      {rx.customer_id
                        ? rx.customer_id.slice(-8)
                        : rx.guest_phone || "—"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={statusColor(rx.status)}>
                      {rx.status.replace("_", " ")}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-xs">{formatDate(rx.created_at)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-xs">
                      {formatDate(rx.reviewed_at)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <a href={`/app/prescriptions/${rx.id}`}>
                      <Button variant="secondary" size="small">
                        Review
                      </Button>
                    </a>
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
  label: "Rx Queue",
  icon: DocumentText,
})

export default PrescriptionsQueue
