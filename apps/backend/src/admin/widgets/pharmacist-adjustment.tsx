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

type OrderLineItem = {
  id: string
  title: string
  product_id: string
  variant_id: string
  quantity: number
  unit_price: number
  thumbnail: string | null
}

type DispenseDecision = {
  id: string
  prescription_drug_line_id: string
  pharmacist_id: string
  decision: "approved" | "rejected" | "substituted" | "quantity_modified"
  approved_variant_id: string | null
  approved_quantity: number | null
  dispensing_notes: string | null
  rejection_reason: string | null
  is_override: boolean
  override_reason: string | null
  created_at: string
}

type PrescriptionLine = {
  id: string
  product_id: string
  product_variant_id: string
  approved_quantity: number
  dispensed_quantity: number
}

type Prescription = {
  id: string
  status: string
  lines: PrescriptionLine[]
}

const DECISION_COLORS: Record<string, "green" | "red" | "orange" | "blue"> = {
  approved: "green",
  rejected: "red",
  substituted: "orange",
  quantity_modified: "blue",
}

const formatINR = (amount: number) => `₹${amount.toLocaleString("en-IN")}`

/**
 * Maps order line items to their corresponding prescription_drug_line_id
 * by matching product_id / variant_id from prescriptions.
 */
const findPrescriptionLineId = (
  item: OrderLineItem,
  prescriptions: Prescription[]
): string | null => {
  for (const rx of prescriptions) {
    for (const line of rx.lines ?? []) {
      if (
        line.product_variant_id === item.variant_id ||
        line.product_id === item.product_id
      ) {
        return line.id
      }
    }
  }
  return null
}

const PharmacistAdjustmentWidget = () => {
  const { id: orderId } = useParams<{ id: string }>()

  const [items, setItems] = useState<OrderLineItem[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [decisions, setDecisions] = useState<DispenseDecision[]>([])
  const [loading, setLoading] = useState(true)
  const [isRxOrder, setIsRxOrder] = useState<boolean | null>(null)
  const [drugSchedules, setDrugSchedules] = useState<Record<string, string>>({})

  // Per-item form state keyed by line item ID
  const [forms, setForms] = useState<
    Record<
      string,
      {
        mode: "idle" | "approve" | "reject" | "substitute"
        notes: string
        rejectionReason: string
        substituteVariantId: string
        approvedQuantity: string
      }
    >
  >({})
  const [submitting, setSubmitting] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    try {
      const [orderResp, rxResp, decResp] = await Promise.all([
        fetch(
          `/admin/orders/${orderId}?fields=id,customer_id,items.*`,
          { credentials: "include" }
        ),
        fetch(`/admin/prescriptions?order_id=${orderId}`, {
          credentials: "include",
        }),
        fetch(`/admin/dispense/decisions?order_id=${orderId}`, {
          credentials: "include",
        }),
      ])

      let orderItems: OrderLineItem[] = []
      if (orderResp.ok) {
        const orderJson = await orderResp.json()
        orderItems = orderJson.order?.items ?? []
        setItems(orderItems)
      }

      // Check if any item is Schedule H/H1 (Rx) — hide widget for OTC-only orders
      // Also store per-product drug schedule for contextual warnings
      const productIds = orderItems.map((i) => i.product_id).filter(Boolean)
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
            // Store per-product schedule info
            const schedMap: Record<string, string> = {}
            for (const d of drugs) {
              if (d.product_id) schedMap[d.product_id] = d.schedule ?? "OTC"
            }
            setDrugSchedules(schedMap)
          }
        } catch { /* proceed — show widget if drug check fails */ hasRx = true }
      }
      setIsRxOrder(hasRx)

      if (rxResp.ok) {
        const rxJson = await rxResp.json()
        setPrescriptions(rxJson.prescriptions ?? [])
      }
      if (decResp.ok) {
        const decJson = await decResp.json()
        setDecisions(decJson.decisions ?? [])
      }
    } catch {
      toast.error("Failed to load order data")
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const initForm = (itemId: string) => {
    if (!forms[itemId]) {
      setForms((prev) => ({
        ...prev,
        [itemId]: {
          mode: "idle",
          notes: "",
          rejectionReason: "",
          substituteVariantId: "",
          approvedQuantity: "",
        },
      }))
    }
  }

  const updateForm = (
    itemId: string,
    patch: Partial<(typeof forms)[string]>
  ) => {
    setForms((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], ...patch },
    }))
  }

  const getExistingDecision = (item: OrderLineItem): DispenseDecision | null => {
    const rxLineId = findPrescriptionLineId(item, prescriptions)
    if (!rxLineId) return null
    return (
      decisions.find((d) => d.prescription_drug_line_id === rxLineId) ?? null
    )
  }

  const submitDecision = async (
    item: OrderLineItem,
    decision: "approved" | "rejected" | "substituted" | "quantity_modified"
  ) => {
    const form = forms[item.id]
    if (!form) return

    const rxLineId = findPrescriptionLineId(item, prescriptions)
    if (!rxLineId) {
      toast.error(
        "No prescription line found for this item. Ensure a prescription is linked."
      )
      return
    }

    if (decision === "rejected" && !form.rejectionReason.trim()) {
      toast.error("Rejection reason is required")
      return
    }
    if (decision === "substituted" && !form.substituteVariantId.trim()) {
      toast.error("Substitute variant ID is required")
      return
    }

    setSubmitting(item.id)
    try {
      const body: Record<string, any> = {
        prescription_drug_line_id: rxLineId,
        pharmacist_id: "admin",
        decision,
        dispensing_notes: form.notes || undefined,
        order_item_id: item.id,
        order_id: orderId,
      }

      if (decision === "rejected") {
        body.rejection_reason = form.rejectionReason
      }
      if (decision === "substituted") {
        body.approved_variant_id = form.substituteVariantId
      }
      if (decision === "quantity_modified" || decision === "approved") {
        const qty = form.approvedQuantity
          ? Number(form.approvedQuantity)
          : undefined
        if (qty) body.approved_quantity = qty
      }

      const resp = await fetch("/admin/dispense/decisions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.message || "Decision submission failed")
      }

      toast.success(`Item ${decision.replace("_", " ")} successfully`)
      updateForm(item.id, { mode: "idle" })
      fetchData()
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit decision")
    } finally {
      setSubmitting(null)
    }
  }

  if (loading) {
    return (
      <Container>
        <Heading level="h2">Pharmacist Adjustment</Heading>
        <Text className="text-ui-fg-subtle mt-2">Loading order items…</Text>
      </Container>
    )
  }

  // Hide widget entirely for OTC-only orders
  if (isRxOrder === false) return null

  if (items.length === 0) {
    return (
      <Container>
        <Heading level="h2">Pharmacist Adjustment</Heading>
        <Text className="text-ui-fg-subtle mt-2">
          No line items found for this order.
        </Text>
      </Container>
    )
  }

  const pendingCount = items.filter((i) => !getExistingDecision(i)).length

  return (
    <Container>
      <div className="flex items-center justify-between mb-4">
        <Heading level="h2">Pharmacist Adjustment</Heading>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge color="orange">{pendingCount} pending</Badge>
          )}
          <Badge color="blue">{items.length} items</Badge>
        </div>
      </div>

      {prescriptions.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <Text className="text-amber-800 text-sm">
            No prescription lines mapped yet. Review the linked prescription
            image and create drug line mappings to enable dispense decisions.
          </Text>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          initForm(item.id)
          const form = forms[item.id]
          const existing = getExistingDecision(item)
          const rxLineId = findPrescriptionLineId(item, prescriptions)
          const isSubmitting = submitting === item.id

          return (
            <div
              key={item.id}
              className="border border-ui-border-base rounded-lg p-4"
            >
              {/* Item header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-3">
                  {item.thumbnail && (
                    <img
                      src={item.thumbnail}
                      alt=""
                      className="w-10 h-10 rounded object-cover border"
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <Text className="font-medium">{item.title}</Text>
                      {drugSchedules[item.product_id] && (
                        <Badge
                          color={
                            drugSchedules[item.product_id] === "H" || drugSchedules[item.product_id] === "H1"
                              ? "orange"
                              : drugSchedules[item.product_id] === "X"
                                ? "red"
                                : "green"
                          }
                        >
                          {drugSchedules[item.product_id] === "OTC"
                            ? "OTC"
                            : `Sch. ${drugSchedules[item.product_id]}`}
                        </Badge>
                      )}
                    </div>
                    <Text className="text-xs text-ui-fg-subtle">
                      Qty: {item.quantity} × {formatINR(item.unit_price)}
                    </Text>
                  </div>
                </div>
                <Text className="font-semibold">
                  {formatINR(item.quantity * item.unit_price)}
                </Text>
              </div>

              {/* Existing decision badge */}
              {existing && (
                <div className="bg-ui-bg-subtle rounded p-2 mb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      color={DECISION_COLORS[existing.decision] || "grey"}
                    >
                      {existing.decision.replace("_", " ")}
                    </Badge>
                    <Text className="text-xs text-ui-fg-subtle">
                      by {existing.pharmacist_id}
                    </Text>
                  </div>
                  {existing.dispensing_notes && (
                    <Text className="text-xs text-ui-fg-subtle">
                      Notes: {existing.dispensing_notes}
                    </Text>
                  )}
                  {existing.rejection_reason && (
                    <Text className="text-xs text-red-600">
                      Reason: {existing.rejection_reason}
                    </Text>
                  )}
                  {existing.approved_variant_id && (
                    <Text className="text-xs text-ui-fg-subtle">
                      Substitute: {existing.approved_variant_id}
                    </Text>
                  )}
                </div>
              )}

              {/* Action buttons — only if no existing decision and Rx line exists */}
              {!existing && rxLineId && form && (
                <div className="border-t border-ui-border-base pt-2">
                  {form.mode === "idle" && (
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="small"
                        onClick={() => updateForm(item.id, { mode: "approve" })}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="small"
                        onClick={() => updateForm(item.id, { mode: "reject" })}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() =>
                          updateForm(item.id, { mode: "substitute" })
                        }
                      >
                        Substitute
                      </Button>
                    </div>
                  )}

                  {form.mode === "approve" && (
                    <div className="bg-green-50 border border-green-200 rounded p-3">
                      <Text className="text-sm font-medium text-green-800 mb-2">
                        Approve for Fulfillment
                      </Text>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="text-xs font-medium text-green-700">
                            Approved Quantity
                          </label>
                          <Input
                            type="number"
                            size="small"
                            placeholder={String(item.quantity)}
                            value={form.approvedQuantity}
                            onChange={(e) =>
                              updateForm(item.id, {
                                approvedQuantity: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="text-xs font-medium text-green-700">
                          Dispensing Notes (optional)
                        </label>
                        <Textarea
                          placeholder="Notes for warehouse / packing…"
                          value={form.notes}
                          onChange={(e) =>
                            updateForm(item.id, { notes: e.target.value })
                          }
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="small"
                          isLoading={isSubmitting}
                          disabled={isSubmitting}
                          onClick={() => submitDecision(item, "approved")}
                        >
                          Confirm Approval
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          disabled={isSubmitting}
                          onClick={() =>
                            updateForm(item.id, { mode: "idle" })
                          }
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {form.mode === "reject" && (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <Text className="text-sm font-medium text-red-800 mb-2">
                        Reject Item
                      </Text>
                      <div className="mb-3">
                        <label className="text-xs font-medium text-red-700">
                          Rejection Reason *
                        </label>
                        <Textarea
                          placeholder="Clinical reason for rejection…"
                          value={form.rejectionReason}
                          onChange={(e) =>
                            updateForm(item.id, {
                              rejectionReason: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="mb-3">
                        <label className="text-xs font-medium text-red-700">
                          Dispensing Notes (optional)
                        </label>
                        <Textarea
                          placeholder="Additional notes…"
                          value={form.notes}
                          onChange={(e) =>
                            updateForm(item.id, { notes: e.target.value })
                          }
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="danger"
                          size="small"
                          isLoading={isSubmitting}
                          disabled={isSubmitting}
                          onClick={() => submitDecision(item, "rejected")}
                        >
                          Confirm Rejection
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          disabled={isSubmitting}
                          onClick={() =>
                            updateForm(item.id, { mode: "idle" })
                          }
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {form.mode === "substitute" && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-3">
                      <Text className="text-sm font-medium text-amber-800 mb-2">
                        Suggest Substitute
                      </Text>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="text-xs font-medium text-amber-700">
                            Substitute Variant ID *
                          </label>
                          <Input
                            size="small"
                            placeholder="variant_01ABC..."
                            value={form.substituteVariantId}
                            onChange={(e) =>
                              updateForm(item.id, {
                                substituteVariantId: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-amber-700">
                            Approved Quantity
                          </label>
                          <Input
                            type="number"
                            size="small"
                            placeholder={String(item.quantity)}
                            value={form.approvedQuantity}
                            onChange={(e) =>
                              updateForm(item.id, {
                                approvedQuantity: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="text-xs font-medium text-amber-700">
                          Dispensing Notes (optional)
                        </label>
                        <Textarea
                          placeholder="Reason for substitution, equivalence notes…"
                          value={form.notes}
                          onChange={(e) =>
                            updateForm(item.id, { notes: e.target.value })
                          }
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="small"
                          isLoading={isSubmitting}
                          disabled={isSubmitting}
                          onClick={() =>
                            submitDecision(item, "substituted")
                          }
                        >
                          Confirm Substitution
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          disabled={isSubmitting}
                          onClick={() =>
                            updateForm(item.id, { mode: "idle" })
                          }
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* No Rx line linked warning — contextual based on drug schedule */}
              {!existing && !rxLineId && (() => {
                const schedule = drugSchedules[item.product_id]
                const isScheduled = schedule === "H" || schedule === "H1"
                return isScheduled ? (
                  <Text className="text-xs text-amber-600 font-medium mt-1">
                    ⚠️ Schedule {schedule} drug — awaiting pharmacist review.
                    Map this drug to a prescription line to enable dispensing.
                  </Text>
                ) : (
                  <Text className="text-xs text-ui-fg-muted mt-1">
                    No prescription line linked — OTC item, no Rx required.
                  </Text>
                )
              })()}
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

export default PharmacistAdjustmentWidget
