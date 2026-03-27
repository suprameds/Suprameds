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
import { ArrowPath, CurrencyDollarSolid, XCircleSolid } from "@medusajs/icons"
import { useCallback, useEffect, useState } from "react"
import { sdk } from "../../lib/client"

/* ================================================================
   TYPES
   ================================================================ */

type CodRefundDetails = {
  id: string
  refund_id: string
  account_holder_name: string
  bank_name: string
  account_number: string
  ifsc_code: string
  upi_id: string | null
  verified: boolean
}

type Refund = {
  id: string
  order_id: string
  payment_id: string
  reason: string
  amount: number
  status: "pending_approval" | "approved" | "rejected" | "processed"
  raised_by: string | null
  approved_by: string | null
  gateway_refund_id: string | null
  metadata: Record<string, any> | null
  created_at: string
  updated_at: string
  cod_refund_details?: CodRefundDetails | null
}

/* ================================================================
   HELPERS
   ================================================================ */

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

const fmtINR = (paise: number) => {
  const rupees = paise / 100
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(rupees)
}

const REASON_LABELS: Record<string, string> = {
  rejected_rx_line: "Rejected Rx Line",
  cancelled_order: "Cancelled Order",
  return: "Customer Return",
  batch_recall: "Batch Recall",
  payment_capture_error: "Payment Error",
  cod_non_delivery: "COD Non-Delivery",
  other: "Other",
}

const reasonLabel = (r: string) => REASON_LABELS[r] ?? r

const statusColor = (s: string): "green" | "blue" | "orange" | "red" | "grey" => {
  const map: Record<string, "green" | "blue" | "orange" | "red" | "grey"> = {
    pending_approval: "orange",
    approved: "blue",
    processed: "green",
    rejected: "red",
  }
  return map[s] || "grey"
}

const statusLabel = (s: string) => {
  const map: Record<string, string> = {
    pending_approval: "Pending Approval",
    approved: "Approved",
    processed: "Processed",
    rejected: "Rejected",
  }
  return map[s] ?? s
}

/* ================================================================
   STAT CARD
   ================================================================ */

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
    <Text className="text-xs text-ui-fg-subtle uppercase tracking-wide">{label}</Text>
    <Text className="text-2xl font-semibold mt-1">{value}</Text>
    {sub && <Text className="text-xs text-ui-fg-muted mt-0.5">{sub}</Text>}
  </div>
)

/* ================================================================
   DETAIL DRAWER
   ================================================================ */

const RefundDetailDrawer = ({
  refund,
  open,
  onOpenChange,
}: {
  refund: Refund | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) => {
  if (!refund) return null

  const cod = refund.cod_refund_details

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>
            Refund Details
            <Badge color={statusColor(refund.status)} className="ml-2">
              {statusLabel(refund.status)}
            </Badge>
          </Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="p-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Text className="text-xs text-ui-fg-subtle">Refund ID</Text>
              <Text className="font-mono font-medium">{refund.id.slice(-16)}</Text>
            </div>
            <div>
              <Text className="text-xs text-ui-fg-subtle">Order ID</Text>
              <Text className="font-mono">{refund.order_id?.slice(-16) || "—"}</Text>
            </div>
            <div>
              <Text className="text-xs text-ui-fg-subtle">Payment ID</Text>
              <Text className="font-mono">{refund.payment_id?.slice(-16) || "—"}</Text>
            </div>
            <div>
              <Text className="text-xs text-ui-fg-subtle">Reason</Text>
              <Text>{reasonLabel(refund.reason)}</Text>
            </div>
            <div>
              <Text className="text-xs text-ui-fg-subtle">Amount</Text>
              <Text className="font-semibold text-ui-fg-base">{fmtINR(refund.amount)}</Text>
            </div>
            <div>
              <Text className="text-xs text-ui-fg-subtle">Status</Text>
              <Badge color={statusColor(refund.status)}>{statusLabel(refund.status)}</Badge>
            </div>
            <div>
              <Text className="text-xs text-ui-fg-subtle">Raised By</Text>
              <Text className="font-mono">{refund.raised_by?.slice(-16) || "—"}</Text>
            </div>
            <div>
              <Text className="text-xs text-ui-fg-subtle">Approved By</Text>
              <Text className="font-mono">{refund.approved_by?.slice(-16) || "—"}</Text>
            </div>
            <div>
              <Text className="text-xs text-ui-fg-subtle">Created</Text>
              <Text>{fmtDateTime(refund.created_at)}</Text>
            </div>
            <div>
              <Text className="text-xs text-ui-fg-subtle">Last Updated</Text>
              <Text>{fmtDateTime(refund.updated_at)}</Text>
            </div>
            {refund.gateway_refund_id && (
              <div className="col-span-2">
                <Text className="text-xs text-ui-fg-subtle">Gateway Refund ID</Text>
                <Text className="font-mono">{refund.gateway_refund_id}</Text>
              </div>
            )}
            {refund.metadata?.rejection_reason && (
              <div className="col-span-2">
                <Text className="text-xs text-ui-fg-subtle">Rejection Reason</Text>
                <Text className="text-ui-fg-error">{refund.metadata.rejection_reason}</Text>
              </div>
            )}
          </div>

          {cod && (
            <div className="mt-6 p-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle">
              <Text className="text-sm font-medium mb-3">COD Bank Details</Text>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Text className="text-xs text-ui-fg-subtle">Account Holder</Text>
                  <Text>{cod.account_holder_name}</Text>
                </div>
                <div>
                  <Text className="text-xs text-ui-fg-subtle">Bank Name</Text>
                  <Text>{cod.bank_name}</Text>
                </div>
                <div>
                  <Text className="text-xs text-ui-fg-subtle">Account Number</Text>
                  <Text className="font-mono">{cod.account_number}</Text>
                </div>
                <div>
                  <Text className="text-xs text-ui-fg-subtle">IFSC Code</Text>
                  <Text className="font-mono">{cod.ifsc_code}</Text>
                </div>
                {cod.upi_id && (
                  <div>
                    <Text className="text-xs text-ui-fg-subtle">UPI ID</Text>
                    <Text>{cod.upi_id}</Text>
                  </div>
                )}
                <div>
                  <Text className="text-xs text-ui-fg-subtle">Verified</Text>
                  <Badge color={cod.verified ? "green" : "orange"}>
                    {cod.verified ? "Verified" : "Pending Verification"}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

/* ================================================================
   TAB 1: PENDING APPROVAL
   ================================================================ */

const PendingApprovalTab = ({ onRefresh }: { onRefresh: () => void }) => {
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  // Reject drawer state
  const [rejectDrawerOpen, setRejectDrawerOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<Refund | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [rejecting, setRejecting] = useState(false)

  const fetchPending = useCallback(async () => {
    setLoading(true)
    try {
      const json = await sdk.client.fetch<{ refunds: Refund[] }>(
        "/admin/refunds",
        { query: { status: "pending_approval", limit: "50" } }
      )
      setRefunds(json.refunds ?? [])
    } catch (err: any) {
      console.error("[refunds-pending]", err)
      setRefunds([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPending()
  }, [fetchPending])

  const handleApprove = async (refundId: string) => {
    setActionId(refundId)
    try {
      await sdk.client.fetch<{ refund: Refund }>(`/admin/refunds/${refundId}/approve`, {
        method: "POST",
      })
      toast.success("Refund approved successfully")
      fetchPending()
      onRefresh()
    } catch (err: any) {
      toast.error("Failed to approve refund", { description: err.message })
    } finally {
      setActionId(null)
    }
  }

  const openRejectDrawer = (refund: Refund) => {
    setRejectTarget(refund)
    setRejectionReason("")
    setRejectDrawerOpen(true)
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason")
      return
    }
    setRejecting(true)
    try {
      await sdk.client.fetch<{ refund: Refund }>(`/admin/refunds/${rejectTarget.id}/reject`, {
        method: "POST",
        body: { rejection_reason: rejectionReason.trim() },
      })
      toast.success("Refund rejected")
      setRejectDrawerOpen(false)
      setRejectTarget(null)
      setRejectionReason("")
      fetchPending()
      onRefresh()
    } catch (err: any) {
      toast.error("Failed to reject refund", { description: err.message })
    } finally {
      setRejecting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="secondary" size="small" onClick={fetchPending}>
          <ArrowPath /> Refresh
        </Button>
      </div>

      {loading ? (
        <Text className="text-ui-fg-subtle p-4">Loading pending refunds...</Text>
      ) : refunds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Text className="text-ui-fg-subtle mb-1">No refunds pending approval.</Text>
          <Text className="text-xs text-ui-fg-muted">All refund requests have been actioned.</Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Order ID</Table.HeaderCell>
              <Table.HeaderCell>Customer</Table.HeaderCell>
              <Table.HeaderCell>Reason</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Amount</Table.HeaderCell>
              <Table.HeaderCell>Raised By</Table.HeaderCell>
              <Table.HeaderCell>Date</Table.HeaderCell>
              <Table.HeaderCell>Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {refunds.map((r) => (
              <Table.Row key={r.id}>
                <Table.Cell>
                  <Text className="font-mono text-sm font-medium">
                    {r.order_id?.slice(-12) || "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="font-mono text-sm text-ui-fg-subtle">
                    {r.raised_by?.slice(-10) || "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm">{reasonLabel(r.reason)}</Text>
                </Table.Cell>
                <Table.Cell className="text-right">
                  <Text className="text-sm font-semibold">{fmtINR(r.amount)}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="font-mono text-sm text-ui-fg-subtle">
                    {r.raised_by?.slice(-10) || "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm text-ui-fg-subtle">{fmtDateTime(r.created_at)}</Text>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="primary"
                      size="small"
                      disabled={actionId === r.id}
                      onClick={() => handleApprove(r.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      size="small"
                      disabled={actionId === r.id}
                      onClick={() => openRejectDrawer(r)}
                    >
                      <XCircleSolid /> Reject
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      {/* Reject Drawer */}
      <Drawer open={rejectDrawerOpen} onOpenChange={setRejectDrawerOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Reject Refund</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="p-4">
            {rejectTarget && (
              <div className="flex flex-col gap-4">
                <div className="p-3 rounded-lg bg-ui-bg-subtle border border-ui-border-base">
                  <Text className="text-xs text-ui-fg-subtle">Refund</Text>
                  <Text className="font-mono text-sm">{rejectTarget.id.slice(-16)}</Text>
                  <Text className="text-xs text-ui-fg-subtle mt-1">Order</Text>
                  <Text className="font-mono text-sm">{rejectTarget.order_id?.slice(-16) || "—"}</Text>
                  <Text className="text-xs text-ui-fg-subtle mt-1">Amount</Text>
                  <Text className="font-semibold">{fmtINR(rejectTarget.amount)}</Text>
                </div>
                <div>
                  <Label htmlFor="rejection_reason" className="text-sm font-medium mb-1 block">
                    Rejection Reason <span className="text-ui-fg-error">*</span>
                  </Label>
                  <Textarea
                    id="rejection_reason"
                    placeholder="Explain why this refund is being rejected..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Button
              variant="secondary"
              onClick={() => setRejectDrawerOpen(false)}
              disabled={rejecting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              disabled={rejecting || !rejectionReason.trim()}
            >
              {rejecting ? "Rejecting..." : "Confirm Reject"}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}

/* ================================================================
   TAB 2: APPROVED (awaiting processing)
   ================================================================ */

const ApprovedTab = ({ onRefresh }: { onRefresh: () => void }) => {
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  // Bank details drawer
  const [bankDrawerOpen, setBankDrawerOpen] = useState(false)
  const [bankTarget, setBankTarget] = useState<Refund | null>(null)
  const [bankForm, setBankForm] = useState({
    account_holder_name: "",
    bank_name: "",
    account_number: "",
    ifsc_code: "",
    upi_id: "",
  })
  const [savingBank, setSavingBank] = useState(false)

  const fetchApproved = useCallback(async () => {
    setLoading(true)
    try {
      const json = await sdk.client.fetch<{ refunds: Refund[] }>(
        "/admin/refunds",
        { query: { status: "approved", limit: "50" } }
      )
      setRefunds(json.refunds ?? [])
    } catch (err: any) {
      console.error("[refunds-approved]", err)
      setRefunds([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchApproved()
  }, [fetchApproved])

  const handleProcess = async (refundId: string) => {
    setActionId(refundId)
    try {
      await sdk.client.fetch<{ refund: Refund }>(`/admin/refunds/${refundId}/process`, {
        method: "POST",
      })
      toast.success("Refund processed successfully")
      fetchApproved()
      onRefresh()
    } catch (err: any) {
      toast.error("Failed to process refund", { description: err.message })
    } finally {
      setActionId(null)
    }
  }

  const openBankDrawer = (refund: Refund) => {
    setBankTarget(refund)
    const cod = refund.cod_refund_details
    setBankForm({
      account_holder_name: cod?.account_holder_name ?? "",
      bank_name: cod?.bank_name ?? "",
      account_number: cod?.account_number ?? "",
      ifsc_code: cod?.ifsc_code ?? "",
      upi_id: cod?.upi_id ?? "",
    })
    setBankDrawerOpen(true)
  }

  const handleSaveBankDetails = async () => {
    if (!bankTarget) return
    if (
      !bankForm.account_holder_name.trim() ||
      !bankForm.bank_name.trim() ||
      !bankForm.account_number.trim() ||
      !bankForm.ifsc_code.trim()
    ) {
      toast.error("Please fill all required bank details")
      return
    }
    setSavingBank(true)
    try {
      await sdk.client.fetch(`/admin/refunds/${bankTarget.id}/cod-bank-details`, {
        method: "POST",
        body: {
          account_holder_name: bankForm.account_holder_name.trim(),
          bank_name: bankForm.bank_name.trim(),
          account_number: bankForm.account_number.trim(),
          ifsc_code: bankForm.ifsc_code.trim().toUpperCase(),
          ...(bankForm.upi_id.trim() ? { upi_id: bankForm.upi_id.trim() } : {}),
        },
      })
      toast.success("Bank details saved successfully")
      setBankDrawerOpen(false)
      fetchApproved()
    } catch (err: any) {
      toast.error("Failed to save bank details", { description: err.message })
    } finally {
      setSavingBank(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="secondary" size="small" onClick={fetchApproved}>
          <ArrowPath /> Refresh
        </Button>
      </div>

      {loading ? (
        <Text className="text-ui-fg-subtle p-4">Loading approved refunds...</Text>
      ) : refunds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Text className="text-ui-fg-subtle mb-1">No approved refunds awaiting processing.</Text>
          <Text className="text-xs text-ui-fg-muted">
            Approved refunds will appear here once actioned in the Pending tab.
          </Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Order ID</Table.HeaderCell>
              <Table.HeaderCell>Reason</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Amount</Table.HeaderCell>
              <Table.HeaderCell>Approved By</Table.HeaderCell>
              <Table.HeaderCell>Approved Date</Table.HeaderCell>
              <Table.HeaderCell>Payment</Table.HeaderCell>
              <Table.HeaderCell>Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {refunds.map((r) => {
              const isCod = r.reason === "cod_non_delivery"
              const hasBankDetails = !!r.cod_refund_details

              return (
                <Table.Row key={r.id}>
                  <Table.Cell>
                    <Text className="font-mono text-sm font-medium">
                      {r.order_id?.slice(-12) || "—"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm">{reasonLabel(r.reason)}</Text>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Text className="text-sm font-semibold">{fmtINR(r.amount)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="font-mono text-sm text-ui-fg-subtle">
                      {r.approved_by?.slice(-10) || "—"}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm text-ui-fg-subtle">{fmtDateTime(r.updated_at)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={isCod ? "orange" : "blue"}>
                      {isCod ? "COD" : "Online"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {isCod && (
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => openBankDrawer(r)}
                        >
                          {hasBankDetails ? "Edit Bank" : "Add Bank Details"}
                        </Button>
                      )}
                      <Button
                        variant="primary"
                        size="small"
                        disabled={actionId === r.id || (isCod && !hasBankDetails)}
                        onClick={() => handleProcess(r.id)}
                        title={isCod && !hasBankDetails ? "Add bank details before processing" : undefined}
                      >
                        {actionId === r.id ? "Processing..." : "Process Refund"}
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table>
      )}

      {/* Bank Details Drawer */}
      <Drawer open={bankDrawerOpen} onOpenChange={setBankDrawerOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>COD Bank Details</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="p-4">
            {bankTarget && (
              <div className="flex flex-col gap-4">
                <div className="p-3 rounded-lg bg-ui-bg-subtle border border-ui-border-base">
                  <Text className="text-xs text-ui-fg-subtle">Refund for Order</Text>
                  <Text className="font-mono text-sm font-medium">
                    {bankTarget.order_id?.slice(-16) || "—"}
                  </Text>
                  <Text className="text-xs text-ui-fg-subtle mt-1">Amount</Text>
                  <Text className="font-semibold">{fmtINR(bankTarget.amount)}</Text>
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <Label htmlFor="account_holder_name" className="text-sm font-medium mb-1 block">
                      Account Holder Name <span className="text-ui-fg-error">*</span>
                    </Label>
                    <Input
                      id="account_holder_name"
                      placeholder="Full name as on bank account"
                      value={bankForm.account_holder_name}
                      onChange={(e) =>
                        setBankForm((f) => ({ ...f, account_holder_name: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="bank_name" className="text-sm font-medium mb-1 block">
                      Bank Name <span className="text-ui-fg-error">*</span>
                    </Label>
                    <Input
                      id="bank_name"
                      placeholder="e.g. HDFC Bank"
                      value={bankForm.bank_name}
                      onChange={(e) =>
                        setBankForm((f) => ({ ...f, bank_name: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="account_number" className="text-sm font-medium mb-1 block">
                      Account Number <span className="text-ui-fg-error">*</span>
                    </Label>
                    <Input
                      id="account_number"
                      placeholder="Bank account number"
                      value={bankForm.account_number}
                      onChange={(e) =>
                        setBankForm((f) => ({ ...f, account_number: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="ifsc_code" className="text-sm font-medium mb-1 block">
                      IFSC Code <span className="text-ui-fg-error">*</span>
                    </Label>
                    <Input
                      id="ifsc_code"
                      placeholder="e.g. HDFC0001234"
                      value={bankForm.ifsc_code}
                      onChange={(e) =>
                        setBankForm((f) => ({
                          ...f,
                          ifsc_code: e.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="upi_id" className="text-sm font-medium mb-1 block">
                      UPI ID{" "}
                      <span className="text-ui-fg-muted text-xs font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="upi_id"
                      placeholder="e.g. name@upi"
                      value={bankForm.upi_id}
                      onChange={(e) =>
                        setBankForm((f) => ({ ...f, upi_id: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Button
              variant="secondary"
              onClick={() => setBankDrawerOpen(false)}
              disabled={savingBank}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveBankDetails} disabled={savingBank}>
              {savingBank ? "Saving..." : "Save Bank Details"}
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}

/* ================================================================
   TAB 3: ALL REFUNDS
   ================================================================ */

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "processed", label: "Processed" },
]

const AllRefundsTab = () => {
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const query: Record<string, string> = { limit: "100" }
      if (statusFilter !== "all") query.status = statusFilter

      const json = await sdk.client.fetch<{ refunds: Refund[] }>(
        "/admin/refunds",
        { query }
      )
      setRefunds(json.refunds ?? [])
    } catch (err: any) {
      console.error("[refunds-all]", err)
      setRefunds([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const openDetail = (refund: Refund) => {
    setSelectedRefund(refund)
    setDetailOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-52">
          <Text className="text-xs text-ui-fg-subtle mb-1">Status</Text>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
            <Select.Trigger>
              <Select.Value placeholder="All Statuses" />
            </Select.Trigger>
            <Select.Content>
              {STATUS_FILTER_OPTIONS.map((o) => (
                <Select.Item key={o.value} value={o.value}>
                  {o.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <Button variant="secondary" size="small" onClick={fetchAll}>
          <ArrowPath /> Refresh
        </Button>
      </div>

      {loading ? (
        <Text className="text-ui-fg-subtle p-4">Loading refunds...</Text>
      ) : refunds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Text className="text-ui-fg-subtle mb-1">No refunds found.</Text>
          <Text className="text-xs text-ui-fg-muted">
            Refunds are created when orders are cancelled, returned, or Rx lines are rejected.
          </Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Order ID</Table.HeaderCell>
              <Table.HeaderCell>Reason</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Amount</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Raised By</Table.HeaderCell>
              <Table.HeaderCell>Date</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {refunds.map((r) => (
              <Table.Row
                key={r.id}
                className="cursor-pointer hover:bg-ui-bg-subtle-hover"
                onClick={() => openDetail(r)}
              >
                <Table.Cell>
                  <Text className="font-mono text-sm font-medium">
                    {r.order_id?.slice(-12) || "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm">{reasonLabel(r.reason)}</Text>
                </Table.Cell>
                <Table.Cell className="text-right">
                  <Text className="text-sm font-semibold">{fmtINR(r.amount)}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={statusColor(r.status)}>{statusLabel(r.status)}</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text className="font-mono text-sm text-ui-fg-subtle">
                    {r.raised_by?.slice(-10) || "—"}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text className="text-sm text-ui-fg-subtle">{fmtDateTime(r.created_at)}</Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      <RefundDetailDrawer
        refund={selectedRefund}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  )
}

/* ================================================================
   MAIN PAGE
   ================================================================ */

const RefundsPage = () => {
  // Top-level stats — fetched once and refreshed after actions
  const [allRefunds, setAllRefunds] = useState<Refund[]>([])
  const [statsLoading, setStatsLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const json = await sdk.client.fetch<{ refunds: Refund[] }>(
        "/admin/refunds",
        { query: { limit: "200" } }
      )
      setAllRefunds(json.refunds ?? [])
    } catch (err: any) {
      console.error("[refunds-stats]", err)
      setAllRefunds([])
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const pendingCount = allRefunds.filter((r) => r.status === "pending_approval").length
  const approvedCount = allRefunds.filter((r) => r.status === "approved").length
  const processedToday = allRefunds.filter(
    (r) => r.status === "processed" && new Date(r.updated_at) >= todayStart
  ).length
  const totalRefundedToday = allRefunds
    .filter((r) => r.status === "processed" && new Date(r.updated_at) >= todayStart)
    .reduce((sum, r) => sum + r.amount, 0)

  return (
    <div className="flex flex-col gap-4">
      <Container className="p-6">
        <Heading level="h1" className="mb-2">
          Refund Management
        </Heading>
        <Text className="text-ui-fg-subtle">
          Review, approve, and process customer refunds. All actions are dual-controlled
          (SSD-04: approver must differ from raiser).
        </Text>
      </Container>

      {/* Stat Cards */}
      <Container className="p-6">
        {statsLoading ? (
          <Text className="text-ui-fg-subtle">Loading stats...</Text>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Pending Approval"
              value={pendingCount}
              sub="Awaiting finance review"
            />
            <StatCard
              label="Approved"
              value={approvedCount}
              sub="Awaiting gateway processing"
            />
            <StatCard
              label="Processed Today"
              value={processedToday}
              sub="Refunds sent today"
            />
            <StatCard
              label="Total Refunded Today"
              value={statsLoading ? "—" : fmtINR(totalRefundedToday)}
              sub="Sum of processed refunds today"
            />
          </div>
        )}
      </Container>

      {/* Tabs */}
      <Container className="p-6">
        <Tabs defaultValue="pending">
          <Tabs.List>
            <Tabs.Trigger value="pending">
              Pending Approval
              {pendingCount > 0 && (
                <Badge color="orange" className="ml-2">
                  {pendingCount}
                </Badge>
              )}
            </Tabs.Trigger>
            <Tabs.Trigger value="approved">
              Approved
              {approvedCount > 0 && (
                <Badge color="blue" className="ml-2">
                  {approvedCount}
                </Badge>
              )}
            </Tabs.Trigger>
            <Tabs.Trigger value="all">All Refunds</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="pending" className="pt-4">
            <PendingApprovalTab onRefresh={fetchStats} />
          </Tabs.Content>

          <Tabs.Content value="approved" className="pt-4">
            <ApprovedTab onRefresh={fetchStats} />
          </Tabs.Content>

          <Tabs.Content value="all" className="pt-4">
            <AllRefundsTab />
          </Tabs.Content>
        </Tabs>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Refunds",
  icon: CurrencyDollarSolid,
})

export default RefundsPage
