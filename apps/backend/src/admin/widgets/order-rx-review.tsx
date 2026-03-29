import { defineWidgetConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Text,
  Badge,
  Button,
  Input,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useState, useEffect, useCallback } from "react"
import { useParams } from "react-router-dom"

type PrescriptionLine = {
  id: string
  product_variant_id: string
  product_id: string
  approved_quantity: number
  dispensed_quantity: number
  max_refills: number | null
  refills_used: number
}

type Prescription = {
  id: string
  customer_id: string | null
  guest_phone: string | null
  status: "pending_review" | "approved" | "rejected" | "expired" | "used"
  file_url: string | null
  original_filename: string | null
  mime_type: string | null
  doctor_name: string | null
  doctor_reg_no: string | null
  patient_name: string | null
  prescribed_on: string | null
  valid_until: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  pharmacist_notes: string | null
  fully_dispensed: boolean
  created_at: string
  lines: PrescriptionLine[]
}

const STATUS_COLORS: Record<string, "green" | "orange" | "red" | "grey" | "blue"> = {
  pending_review: "orange",
  approved: "green",
  rejected: "red",
  expired: "grey",
  used: "blue",
}

const formatDate = (d?: string | null) => {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const formatDateTime = (d?: string | null) => {
  if (!d) return "—"
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const OrderRxReviewWidget = () => {
  const { id: orderId } = useParams<{ id: string }>()
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [isRxOrder, setIsRxOrder] = useState<boolean | null>(null)

  // Per-prescription review form state keyed by prescription ID
  const [reviewForms, setReviewForms] = useState<
    Record<string, {
      mode: "idle" | "approve" | "reject"
      doctorName: string
      doctorReg: string
      patientName: string
      pharmacistNotes: string
      rejectionReason: string
    }>
  >({})
  const [submitting, setSubmitting] = useState<string | null>(null)

  const fetchPrescriptions = useCallback(async () => {
    if (!orderId) return
    try {
      setLoading(true)

      // Fetch order items to check drug schedules
      const orderResp = await fetch(
        `/admin/orders/${orderId}?fields=id,items.*`,
        { credentials: "include" }
      )
      if (orderResp.ok) {
        const orderJson = await orderResp.json()
        const orderItems = orderJson.order?.items ?? []
        const productIds = orderItems.map((i: any) => i.product_id).filter(Boolean)
        let hasRx = false
        if (productIds.length > 0) {
          try {
            const drugResp = await fetch(
              `/admin/pharma/drug-products?product_id=${productIds.join(",")}`,
              { credentials: "include" }
            )
            if (drugResp.ok) {
              const drugJson = await drugResp.json()
              const drugs = drugJson.drug_products ?? []
              hasRx = drugs.some((d: any) => d.schedule === "H" || d.schedule === "H1")
            }
          } catch { hasRx = true }
        }
        setIsRxOrder(hasRx)
      }

      const resp = await fetch(`/admin/prescriptions?order_id=${orderId}`, {
        credentials: "include",
      })
      if (!resp.ok) throw new Error("Failed to fetch prescriptions")
      const json = await resp.json()
      setPrescriptions(json.prescriptions ?? [])
    } catch {
      toast.error("Failed to load prescriptions")
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    fetchPrescriptions()
  }, [fetchPrescriptions])

  const initForm = (rxId: string) => {
    if (!reviewForms[rxId]) {
      setReviewForms((prev) => ({
        ...prev,
        [rxId]: {
          mode: "idle",
          doctorName: "",
          doctorReg: "",
          patientName: "",
          pharmacistNotes: "",
          rejectionReason: "",
        },
      }))
    }
  }

  const updateForm = (rxId: string, patch: Partial<typeof reviewForms[string]>) => {
    setReviewForms((prev) => ({
      ...prev,
      [rxId]: { ...prev[rxId], ...patch },
    }))
  }

  const handleApprove = async (rxId: string) => {
    const form = reviewForms[rxId]
    if (!form) return

    setSubmitting(rxId)
    try {
      const resp = await fetch(`/admin/prescriptions/${rxId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          doctor_name: form.doctorName || undefined,
          doctor_reg_no: form.doctorReg || undefined,
          patient_name: form.patientName || undefined,
          pharmacist_notes: form.pharmacistNotes || undefined,
        }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.message || "Approval failed")
      }
      toast.success("Prescription approved")
      updateForm(rxId, { mode: "idle" })
      fetchPrescriptions()
    } catch (err: any) {
      toast.error(err?.message || "Failed to approve prescription")
    } finally {
      setSubmitting(null)
    }
  }

  const handleReject = async (rxId: string) => {
    const form = reviewForms[rxId]
    if (!form?.rejectionReason?.trim()) {
      toast.error("Rejection reason is required")
      return
    }

    setSubmitting(rxId)
    try {
      const resp = await fetch(`/admin/prescriptions/${rxId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          rejection_reason: form.rejectionReason,
          pharmacist_notes: form.pharmacistNotes || undefined,
        }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.message || "Rejection failed")
      }
      toast.success("Prescription rejected")
      updateForm(rxId, { mode: "idle" })
      fetchPrescriptions()
    } catch (err: any) {
      toast.error(err?.message || "Failed to reject prescription")
    } finally {
      setSubmitting(null)
    }
  }

  // Hide widget entirely for OTC-only orders
  if (isRxOrder === false) return null

  if (loading) {
    return (
      <Container>
        <Heading level="h2">Prescription Review</Heading>
        <Text className="text-ui-fg-subtle mt-2">Loading prescriptions…</Text>
      </Container>
    )
  }

  if (prescriptions.length === 0) {
    return (
      <Container>
        <Heading level="h2">Prescription Review</Heading>
        <Text className="text-ui-fg-subtle mt-2">
          No prescriptions linked to this order.
        </Text>
      </Container>
    )
  }

  return (
    <Container>
      <div className="flex items-center justify-between mb-4">
        <Heading level="h2">Prescription Review</Heading>
        <Badge color="blue">{prescriptions.length} Rx</Badge>
      </div>

      <div className="flex flex-col gap-4">
        {prescriptions.map((rx) => {
          initForm(rx.id)
          const form = reviewForms[rx.id]
          const isPending = rx.status === "pending_review"
          const isSubmitting = submitting === rx.id

          return (
            <div
              key={rx.id}
              className="border border-ui-border-base rounded-lg p-4"
            >
              {/* Header row: status + file link */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge color={STATUS_COLORS[rx.status] || "grey"}>
                    {rx.status.replace("_", " ")}
                  </Badge>
                  {rx.fully_dispensed && (
                    <Badge color="blue">Fully Dispensed</Badge>
                  )}
                </div>
                {rx.file_url && (
                  <a
                    href={rx.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View Rx Image
                  </a>
                )}
              </div>

              {/* Prescription metadata */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-3 text-sm">
                <div>
                  <Text className="text-ui-fg-subtle text-xs">Patient</Text>
                  <Text>{rx.patient_name || "—"}</Text>
                </div>
                <div>
                  <Text className="text-ui-fg-subtle text-xs">Doctor</Text>
                  <Text>
                    {rx.doctor_name || "—"}
                    {rx.doctor_reg_no && (
                      <span className="text-ui-fg-subtle ml-1">
                        (Reg: {rx.doctor_reg_no})
                      </span>
                    )}
                  </Text>
                </div>
                <div>
                  <Text className="text-ui-fg-subtle text-xs">Prescribed On</Text>
                  <Text>{formatDate(rx.prescribed_on)}</Text>
                </div>
                <div>
                  <Text className="text-ui-fg-subtle text-xs">Valid Until</Text>
                  <Text>{formatDate(rx.valid_until)}</Text>
                </div>
                <div>
                  <Text className="text-ui-fg-subtle text-xs">Uploaded</Text>
                  <Text>{formatDateTime(rx.created_at)}</Text>
                </div>
                <div>
                  <Text className="text-ui-fg-subtle text-xs">File</Text>
                  <Text className="truncate">
                    {rx.original_filename || "—"}
                  </Text>
                </div>

                {rx.reviewed_at && (
                  <>
                    <div>
                      <Text className="text-ui-fg-subtle text-xs">Reviewed At</Text>
                      <Text>{formatDateTime(rx.reviewed_at)}</Text>
                    </div>
                    <div>
                      <Text className="text-ui-fg-subtle text-xs">Reviewed By</Text>
                      <Text className="font-mono text-xs">{rx.reviewed_by || "—"}</Text>
                    </div>
                  </>
                )}
              </div>

              {/* Rejection reason (if rejected) */}
              {rx.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded p-2 mb-3">
                  <Text className="text-red-800 text-sm font-medium">
                    Rejection Reason
                  </Text>
                  <Text className="text-red-700 text-sm">
                    {rx.rejection_reason}
                  </Text>
                </div>
              )}

              {/* Pharmacist notes */}
              {rx.pharmacist_notes && (
                <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-3">
                  <Text className="text-blue-800 text-sm font-medium">
                    Pharmacist Notes
                  </Text>
                  <Text className="text-blue-700 text-sm">
                    {rx.pharmacist_notes}
                  </Text>
                </div>
              )}

              {/* Prescription lines */}
              {rx.lines && rx.lines.length > 0 && (
                <div className="mb-3">
                  <Text className="text-sm font-medium mb-1">
                    Prescribed Items
                  </Text>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-ui-fg-subtle">
                          <th className="py-1.5 px-2">Product ID</th>
                          <th className="py-1.5 px-2 text-right">Approved Qty</th>
                          <th className="py-1.5 px-2 text-right">Dispensed</th>
                          <th className="py-1.5 px-2 text-right">Refills</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rx.lines.map((line) => (
                          <tr
                            key={line.id}
                            className="border-b last:border-0 hover:bg-ui-bg-subtle"
                          >
                            <td className="py-1.5 px-2 font-mono text-xs">
                              {line.product_id}
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              {line.approved_quantity}
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              {line.dispensed_quantity}
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              {line.refills_used}
                              {line.max_refills != null && ` / ${line.max_refills}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Approve / Reject actions for pending prescriptions */}
              {isPending && form && (
                <div className="border-t border-ui-border-base pt-3">
                  {form.mode === "idle" && (
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="small"
                        onClick={() => updateForm(rx.id, { mode: "approve" })}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="small"
                        onClick={() => updateForm(rx.id, { mode: "reject" })}
                      >
                        Reject
                      </Button>
                    </div>
                  )}

                  {form.mode === "approve" && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <Text className="text-sm font-medium text-green-800 mb-2">
                        Approve Prescription
                      </Text>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="text-xs font-medium text-green-700">
                            Doctor Name (from Rx)
                          </label>
                          <Input
                            placeholder="Dr. Sharma"
                            size="small"
                            value={form.doctorName}
                            onChange={(e) =>
                              updateForm(rx.id, { doctorName: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-green-700">
                            Doctor Reg No.
                          </label>
                          <Input
                            placeholder="MCI-12345"
                            size="small"
                            value={form.doctorReg}
                            onChange={(e) =>
                              updateForm(rx.id, { doctorReg: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-green-700">
                            Patient Name (from Rx)
                          </label>
                          <Input
                            placeholder="Patient name"
                            size="small"
                            value={form.patientName}
                            onChange={(e) =>
                              updateForm(rx.id, { patientName: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="text-xs font-medium text-green-700">
                          Pharmacist Notes (optional)
                        </label>
                        <Textarea
                          placeholder="Internal notes…"
                          value={form.pharmacistNotes}
                          onChange={(e) =>
                            updateForm(rx.id, {
                              pharmacistNotes: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="small"
                          isLoading={isSubmitting}
                          disabled={isSubmitting}
                          onClick={() => handleApprove(rx.id)}
                        >
                          Confirm Approval
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          disabled={isSubmitting}
                          onClick={() => updateForm(rx.id, { mode: "idle" })}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {form.mode === "reject" && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <Text className="text-sm font-medium text-red-800 mb-2">
                        Reject Prescription
                      </Text>
                      <div className="mb-3">
                        <label className="text-xs font-medium text-red-700">
                          Rejection Reason *
                        </label>
                        <Textarea
                          placeholder="Reason for rejection (shown to customer)…"
                          value={form.rejectionReason}
                          onChange={(e) =>
                            updateForm(rx.id, {
                              rejectionReason: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="mb-3">
                        <label className="text-xs font-medium text-red-700">
                          Pharmacist Notes (optional, internal)
                        </label>
                        <Textarea
                          placeholder="Internal notes…"
                          value={form.pharmacistNotes}
                          onChange={(e) =>
                            updateForm(rx.id, {
                              pharmacistNotes: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="danger"
                          size="small"
                          isLoading={isSubmitting}
                          disabled={isSubmitting}
                          onClick={() => handleReject(rx.id)}
                        >
                          Confirm Rejection
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          disabled={isSubmitting}
                          onClick={() => updateForm(rx.id, { mode: "idle" })}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default OrderRxReviewWidget
