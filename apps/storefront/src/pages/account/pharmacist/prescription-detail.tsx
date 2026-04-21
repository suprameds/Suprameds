import {
  usePharmacistPrescription,
  useReviewPrescription,
  usePharmacistProductSearch,
  useCreateOrderForCustomer,
  type SearchProduct,
} from "@/lib/hooks/use-pharmacist"
import { Link, useParams } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"

type OrderItem = {
  variant_id: string
  product_title: string
  generic_name: string
  strength: string
  quantity: number
  unit_price: number
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending_review: { bg: "rgba(245,158,11,0.1)", color: "var(--brand-amber)", label: "Pending Review" },
  approved: { bg: "rgba(22,163,74,0.1)", color: "var(--price-color)", label: "Approved" },
  rejected: { bg: "rgba(239,68,68,0.1)", color: "var(--brand-red)", label: "Rejected" },
  expired: { bg: "rgba(107,114,128,0.1)", color: "var(--text-tertiary)", label: "Expired" },
  used: { bg: "rgba(14,124,134,0.1)", color: "var(--brand-teal)", label: "Used" },
}

export default function PrescriptionDetailPage() {
  const { prescriptionId } = useParams({
    from: "/account/_layout/pharmacist/prescription/$prescriptionId",
  })

  const { data: rx, isLoading, refetch } = usePharmacistPrescription(prescriptionId)
  const reviewMutation = useReviewPrescription()
  const createOrderMutation = useCreateOrderForCustomer()

  // Approve/reject form
  const [doctorName, setDoctorName] = useState("")
  const [doctorRegNo, setDoctorRegNo] = useState("")
  const [patientName, setPatientName] = useState("")
  const [prescribedOn, setPrescribedOn] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [pharmacistNotes, setPharmacistNotes] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [reviewResult, setReviewResult] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Order creation
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [orderResult, setOrderResult] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: searchResults } = usePharmacistProductSearch(debouncedQuery)

  // Pre-fill form when prescription loads
  useEffect(() => {
    if (!rx) return
    if (rx.doctor_name) setDoctorName(rx.doctor_name)
    if (rx.doctor_reg_no) setDoctorRegNo(rx.doctor_reg_no)
    if (rx.patient_name) setPatientName(rx.patient_name)
    if (rx.prescribed_on) setPrescribedOn(new Date(rx.prescribed_on).toISOString().split("T")[0])
    if (rx.valid_until) setValidUntil(new Date(rx.valid_until).toISOString().split("T")[0])
    if (rx.pharmacist_notes) setPharmacistNotes(rx.pharmacist_notes)
  }, [rx])

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      setDebouncedQuery("")
      return
    }
    debounceRef.current = setTimeout(() => setDebouncedQuery(value), 300)
  }, [])

  const addItem = (product: SearchProduct) => {
    if (!product.variant) return
    if (orderItems.some((i) => i.variant_id === product.variant!.id)) return
    setOrderItems((prev) => [
      ...prev,
      {
        variant_id: product.variant!.id,
        product_title: product.title,
        generic_name: product.drug_product?.generic_name || "",
        strength: product.drug_product?.strength || "",
        quantity: 1,
        unit_price: product.variant!.price ?? 0,
      },
    ])
  }

  const removeItem = (variantId: string) =>
    setOrderItems((prev) => prev.filter((i) => i.variant_id !== variantId))

  const updateQuantity = (variantId: string, qty: number) => {
    if (qty < 1) return
    setOrderItems((prev) =>
      prev.map((i) => (i.variant_id === variantId ? { ...i, quantity: qty } : i))
    )
  }

  const orderTotal = orderItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)

  const handleApprove = async () => {
    setReviewResult(null)
    try {
      await reviewMutation.mutateAsync({
        prescriptionId: prescriptionId!,
        action: "approve",
        doctor_name: doctorName || undefined,
        doctor_reg_no: doctorRegNo || undefined,
        patient_name: patientName || undefined,
        prescribed_on: prescribedOn || undefined,
        valid_until: validUntil || undefined,
        pharmacist_notes: pharmacistNotes || undefined,
      })
      setReviewResult({ type: "success", message: "Prescription approved." })
      refetch()
    } catch (err: any) {
      setReviewResult({ type: "error", message: err.message || "Approval failed." })
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setReviewResult({ type: "error", message: "Rejection reason is required." })
      return
    }
    setReviewResult(null)
    try {
      await reviewMutation.mutateAsync({
        prescriptionId: prescriptionId!,
        action: "reject",
        rejection_reason: rejectionReason,
        pharmacist_notes: pharmacistNotes || undefined,
      })
      setReviewResult({ type: "success", message: "Prescription rejected." })
      refetch()
    } catch (err: any) {
      setReviewResult({ type: "error", message: err.message || "Rejection failed." })
    }
  }

  const handleCreateOrder = async () => {
    if (!orderItems.length) return
    setOrderResult(null)
    try {
      const result = await createOrderMutation.mutateAsync({
        prescriptionId: prescriptionId!,
        items: orderItems.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
      })
      setOrderResult({ type: "success", message: `Order created (${result.order_id}).` })
      setOrderItems([])
      setSearchQuery("")
      setDebouncedQuery("")
      refetch()
    } catch (err: any) {
      setOrderResult({ type: "error", message: err.message || "Order creation failed." })
    }
  }

  const formatINR = (amount: number) =>
    `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`

  const formatDate = (d: string | null) => {
    if (!d) return "—"
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading prescription...</p>
      </div>
    )
  }

  if (!rx) {
    return (
      <div className="text-center py-20">
        <p className="text-sm mb-4" style={{ color: "var(--brand-red)" }}>Prescription not found.</p>
        <Link
          to="/account/pharmacist/rx-queue"
          className="text-sm font-medium underline"
          style={{ color: "var(--brand-teal)" }}
        >
          Back to Rx Queue
        </Link>
      </div>
    )
  }

  const isPending = rx.status === "pending_review"
  const isApproved = rx.status === "approved"
  const style = STATUS_STYLES[rx.status] ?? STATUS_STYLES.pending_review

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/account/pharmacist/rx-queue"
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
          style={{ color: "var(--text-secondary)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)", fontFamily: "Fraunces, Georgia, serif" }}>
              Prescription Review
            </h1>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: style.bg, color: style.color }}
            >
              {style.label}
            </span>
          </div>
          <p className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
            #{rx.id.slice(-8).toUpperCase()}
          </p>
        </div>
      </div>

      {/* Review result banner */}
      {reviewResult && (
        <div
          className="rounded-lg px-4 py-3"
          style={{
            background: reviewResult.type === "success" ? "rgba(22,163,74,0.06)" : "rgba(239,68,68,0.06)",
            color: reviewResult.type === "success" ? "var(--price-color)" : "var(--brand-red)",
          }}
        >
          <p className="text-sm font-medium">{reviewResult.message}</p>
        </div>
      )}

      {/* Prescription document */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border-primary)" }}
      >
        <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border-primary)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Prescription Document
          </h2>
        </div>
        <div className="p-5">
          {rx.file_url ? (
            rx.mime_type?.startsWith("image/") ? (
              <img
                src={rx.file_url}
                alt="Prescription"
                className="max-w-full rounded-lg border"
                style={{ maxHeight: 500, objectFit: "contain", borderColor: "var(--border-primary)" }}
              />
            ) : rx.mime_type === "application/pdf" ? (
              <iframe
                src={rx.file_url}
                title="Prescription PDF"
                className="w-full rounded-lg border"
                style={{ height: 500, borderColor: "var(--border-primary)" }}
              />
            ) : (
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Cannot preview ({rx.mime_type})</p>
            )
          ) : (
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>No file available. Key: {rx.file_key}</p>
          )}

          {/* Metadata row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs" style={{ color: "var(--text-secondary)" }}>
            <div><strong>Patient:</strong> {rx.patient_name || "—"}</div>
            <div><strong>Doctor:</strong> {rx.doctor_name || "—"}</div>
            <div><strong>Uploaded:</strong> {formatDate(rx.created_at)}</div>
            <div><strong>Valid Until:</strong> {formatDate(rx.valid_until)}</div>
          </div>
        </div>
      </div>

      {/* Approve/Reject — only for pending */}
      {isPending && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border-primary)" }}
        >
          <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border-primary)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Pharmacist Review
            </h2>
          </div>
          <div className="p-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Doctor Name" value={doctorName} onChange={setDoctorName} placeholder="Dr. Name from Rx" />
              <Field label="Doctor Reg. No." value={doctorRegNo} onChange={setDoctorRegNo} placeholder="MCI / State Council No." />
              <Field label="Patient Name" value={patientName} onChange={setPatientName} placeholder="Patient name on Rx" />
              <Field label="Prescribed On" value={prescribedOn} onChange={setPrescribedOn} type="date" />
              <Field label="Valid Until" value={validUntil} onChange={setValidUntil} type="date" />
            </div>
            <Field label="Pharmacist Notes (internal)" value={pharmacistNotes} onChange={setPharmacistNotes} placeholder="Notes..." multiline />

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleApprove}
                disabled={reviewMutation.isPending}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: "var(--brand-green)", color: "var(--text-inverse)" }}
              >
                {reviewMutation.isPending ? "Processing..." : "Approve"}
              </button>
            </div>

            <div className="border-t pt-4 mt-2" style={{ borderColor: "var(--border-primary)" }}>
              <Field label="Rejection Reason (required to reject)" value={rejectionReason} onChange={setRejectionReason} placeholder="e.g., Illegible, expired, missing signature..." multiline />
              <button
                onClick={handleReject}
                disabled={reviewMutation.isPending}
                className="mt-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: "var(--brand-red)", color: "var(--text-inverse)" }}
              >
                {reviewMutation.isPending ? "Processing..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Order — only for approved prescriptions with a customer */}
      {isApproved && rx.customer_id && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border-primary)" }}
        >
          <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border-primary)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Create Order for Customer
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Search medicines, add to order, then create. Payment: Cash on Delivery.
            </p>
          </div>

          {/* Order result */}
          {orderResult && (
            <div
              className="px-5 py-3"
              style={{
                background: orderResult.type === "success" ? "rgba(22,163,74,0.06)" : "rgba(239,68,68,0.06)",
                color: orderResult.type === "success" ? "var(--price-color)" : "var(--brand-red)",
              }}
            >
              <p className="text-sm font-medium">{orderResult.message}</p>
            </div>
          )}

          <div className="p-5 flex flex-col gap-5">
            {/* Product search */}
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>
                Search Medicines
              </label>
              <input
                type="text"
                placeholder="Type medicine name, generic name, or composition..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none transition-colors focus:border-[var(--brand-teal)]"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
              />

              {/* Search results */}
              {(searchResults?.length ?? 0) > 0 && (
                <div className="mt-2 border rounded-lg max-h-60 overflow-y-auto" style={{ borderColor: "var(--border-primary)" }}>
                  {searchResults!.map((p) => {
                    const isBlocked = p.drug_product?.schedule === "X" || p.drug_product?.is_narcotic || p.drug_product?.requires_refrigeration
                    const alreadyAdded = orderItems.some((i) => i.variant_id === p.variant?.id)
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between px-3 py-2.5 border-b last:border-b-0"
                        style={{ borderColor: "var(--border-primary)" }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{p.title}</p>
                          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                            {p.drug_product?.generic_name} {p.drug_product?.strength}
                            {p.drug_product?.schedule && (
                              <span
                                className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold"
                                style={{
                                  background: p.drug_product.schedule === "X" ? "rgba(239,68,68,0.1)" : p.drug_product.schedule === "H1" ? "rgba(245,158,11,0.1)" : "rgba(14,124,134,0.1)",
                                  color: p.drug_product.schedule === "X" ? "var(--brand-red)" : p.drug_product.schedule === "H1" ? "var(--brand-amber)" : "var(--brand-teal)",
                                }}
                              >
                                {p.drug_product.schedule}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {p.variant?.price != null ? formatINR(p.variant.price) : "—"}
                          </span>
                          {isBlocked ? (
                            <span className="text-[10px] font-bold" style={{ color: "var(--brand-red)" }}>Blocked</span>
                          ) : (
                            <button
                              disabled={!p.variant || alreadyAdded}
                              onClick={() => addItem(p)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-40"
                              style={{ background: "var(--brand-teal)", color: "var(--text-inverse)" }}
                            >
                              {alreadyAdded ? "Added" : "+ Add"}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Selected items */}
            {orderItems.length > 0 && (
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>
                  Order Items ({orderItems.length})
                </label>
                <div className="border rounded-lg" style={{ borderColor: "var(--border-primary)" }}>
                  {orderItems.map((item, idx) => (
                    <div
                      key={item.variant_id}
                      className="flex items-center justify-between px-3 py-3"
                      style={{ borderTop: idx > 0 ? "1px solid var(--border-primary)" : undefined }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.product_title}</p>
                        {item.generic_name && (
                          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                            {item.generic_name} {item.strength}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQuantity(item.variant_id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="w-7 h-7 rounded flex items-center justify-center text-sm font-bold transition-colors disabled:opacity-30"
                            style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.variant_id, parseInt(e.target.value) || 1)}
                            className="w-10 text-center text-sm border rounded py-0.5"
                            style={{ background: "var(--bg-primary)", borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
                            min={1}
                          />
                          <button
                            onClick={() => updateQuantity(item.variant_id, item.quantity + 1)}
                            className="w-7 h-7 rounded flex items-center justify-center text-sm font-bold transition-colors"
                            style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                          >
                            +
                          </button>
                        </div>
                        <span className="text-sm font-medium w-20 text-right" style={{ color: "var(--text-primary)" }}>
                          {formatINR(item.unit_price * item.quantity)}
                        </span>
                        <button
                          onClick={() => removeItem(item.variant_id)}
                          className="p-1 rounded transition-colors hover:bg-red-50"
                          style={{ color: "var(--brand-red)" }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Total */}
                  <div
                    className="flex items-center justify-between px-3 py-3"
                    style={{ borderTop: "1px solid var(--border-primary)", background: "var(--bg-tertiary)" }}
                  >
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Total (COD)</span>
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{formatINR(orderTotal)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Create order button */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleCreateOrder}
                disabled={createOrderMutation.isPending || orderItems.length === 0}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: "var(--brand-green)", color: "var(--text-inverse)" }}
              >
                {createOrderMutation.isPending
                  ? "Creating Order..."
                  : `Create Order — ${formatINR(orderTotal)}`}
              </button>
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Cash on Delivery
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Non-actionable states */}
      {!isPending && !isApproved && (
        <div
          className="rounded-xl border p-6"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border-primary)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            This prescription has been <strong>{rx.status.replace("_", " ")}</strong>
            {rx.reviewed_at && ` on ${formatDate(rx.reviewed_at)}`}.
          </p>
          {rx.rejection_reason && (
            <p className="text-sm mt-2" style={{ color: "var(--brand-red)" }}>
              Reason: {rx.rejection_reason}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Field Component ──────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, type = "text", multiline,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; multiline?: boolean
}) {
  const inputStyle = {
    background: "var(--bg-primary)",
    borderColor: "var(--border-primary)",
    color: "var(--text-primary)",
  }

  return (
    <div>
      <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors focus:border-[var(--brand-teal)]"
          style={inputStyle}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors focus:border-[var(--brand-teal)]"
          style={inputStyle}
        />
      )}
    </div>
  )
}
