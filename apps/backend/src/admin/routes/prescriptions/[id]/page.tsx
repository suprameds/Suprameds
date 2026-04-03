import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Text,
  Textarea,
} from "@medusajs/ui"
import { ArrowLeftMini, PlusMini, XMarkMini } from "@medusajs/icons"
import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import { sdk } from "../../../lib/client"

type SearchProduct = {
  id: string
  title: string
  thumbnail: string | null
  drug_product: {
    schedule: string
    generic_name: string
    dosage_form: string
    strength: string
    is_narcotic: boolean
    requires_refrigeration: boolean
    pack_size: string | null
    unit_type: string | null
  } | null
  variant: {
    id: string
    title: string
    sku: string | null
    price: number | null
    currency_code: string
  } | null
}

type OrderItem = {
  variant_id: string
  product_title: string
  generic_name: string
  strength: string
  quantity: number
  unit_price: number
}

type PrescriptionDetail = {
  id: string
  customer_id: string | null
  guest_phone: string | null
  status: string
  file_key: string
  file_url: string | null
  original_filename: string | null
  mime_type: string | null
  file_size_bytes: number | null
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
  lines: any[]
}

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
  })
}

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

const PrescriptionDetailPage = () => {
  const { id: prescriptionId } = useParams<{ id: string }>()

  const [rx, setRx] = useState<PrescriptionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Approval form fields
  const [doctorName, setDoctorName] = useState("")
  const [doctorRegNo, setDoctorRegNo] = useState("")
  const [patientName, setPatientName] = useState("")
  const [prescribedOn, setPrescribedOn] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [pharmacistNotes, setPharmacistNotes] = useState("")

  // Rejection form fields
  const [rejectionReason, setRejectionReason] = useState("")

  const [submitting, setSubmitting] = useState(false)
  const [actionResult, setActionResult] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const fetchPrescription = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await sdk.client.fetch<{ prescription: PrescriptionDetail }>(
        `/admin/prescriptions/${prescriptionId}`
      )
      const p = data.prescription
      setRx(p)
      // Pre-fill form with existing data
      if (p.doctor_name) setDoctorName(p.doctor_name)
      if (p.doctor_reg_no) setDoctorRegNo(p.doctor_reg_no)
      if (p.patient_name) setPatientName(p.patient_name)
      if (p.prescribed_on)
        setPrescribedOn(new Date(p.prescribed_on).toISOString().split("T")[0])
      if (p.valid_until)
        setValidUntil(new Date(p.valid_until).toISOString().split("T")[0])
      if (p.pharmacist_notes) setPharmacistNotes(p.pharmacist_notes)
    } catch (err: any) {
      setError(err.message || "Failed to load prescription")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (prescriptionId) fetchPrescription()
  }, [prescriptionId])

  const handleApprove = async () => {
    setSubmitting(true)
    setActionResult(null)
    try {
      await sdk.client.fetch<{ prescription: PrescriptionDetail }>(
        `/admin/prescriptions/${prescriptionId}`,
        {
          method: "POST",
          body: {
            action: "approve",
            doctor_name: doctorName || undefined,
            doctor_reg_no: doctorRegNo || undefined,
            patient_name: patientName || undefined,
            prescribed_on: prescribedOn || undefined,
            valid_until: validUntil || undefined,
            pharmacist_notes: pharmacistNotes || undefined,
          },
        }
      )
      setActionResult({
        type: "success",
        message: "Prescription APPROVED successfully.",
      })
      fetchPrescription()
    } catch (err: any) {
      setActionResult({
        type: "error",
        message: err.message || "Approval failed",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setActionResult({
        type: "error",
        message: "Rejection reason is required.",
      })
      return
    }
    setSubmitting(true)
    setActionResult(null)
    try {
      await sdk.client.fetch<{ prescription: PrescriptionDetail }>(
        `/admin/prescriptions/${prescriptionId}`,
        {
          method: "POST",
          body: {
            action: "reject",
            rejection_reason: rejectionReason,
            pharmacist_notes: pharmacistNotes || undefined,
          },
        }
      )
      setActionResult({
        type: "success",
        message: "Prescription REJECTED.",
      })
      fetchPrescription()
    } catch (err: any) {
      setActionResult({
        type: "error",
        message: err.message || "Rejection failed",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Container className="p-6">
        <Text className="text-ui-fg-subtle">Loading prescription...</Text>
      </Container>
    )
  }

  if (error || !rx) {
    return (
      <Container className="p-6">
        <Text className="text-ui-fg-error">
          {error || "Prescription not found"}
        </Text>
        <a href="/app/prescriptions">
          <Button variant="secondary" className="mt-4">
            <ArrowLeftMini />
            Back to Queue
          </Button>
        </a>
      </Container>
    )
  }

  const isPending = rx.status === "pending_review"

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <a href="/app/prescriptions">
              <Button variant="transparent" size="small">
                <ArrowLeftMini />
              </Button>
            </a>
            <Heading level="h2">Prescription Review</Heading>
            <Badge color={statusColor(rx.status)}>
              {rx.status.replace("_", " ")}
            </Badge>
          </div>
          <Text className="font-mono text-xs text-ui-fg-subtle">{rx.id}</Text>
        </div>
      </Container>

      {/* Action result banner */}
      {actionResult && (
        <Container className="p-0">
          <div
            className="px-6 py-3"
            style={{
              background:
                actionResult.type === "success" ? "#ECFDF5" : "#FEF2F2",
              color: actionResult.type === "success" ? "#065F46" : "#991B1B",
            }}
          >
            <Text className="text-sm font-medium">{actionResult.message}</Text>
          </div>
        </Container>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Prescription Image / File */}
        <Container className="divide-y p-0">
          <div className="px-6 py-4">
            <Heading level="h3">Prescription Document</Heading>
          </div>
          <div className="p-6">
            {rx.file_url ? (
              <div className="flex flex-col gap-4">
                {rx.mime_type?.startsWith("image/") ? (
                  <img
                    src={rx.file_url}
                    alt={rx.original_filename || "Prescription"}
                    className="max-w-full rounded-lg border border-ui-border-base"
                    style={{ maxHeight: "600px", objectFit: "contain" }}
                  />
                ) : rx.mime_type === "application/pdf" ? (
                  <iframe
                    src={rx.file_url}
                    title="Prescription PDF"
                    className="w-full rounded-lg border border-ui-border-base"
                    style={{ height: "600px" }}
                  />
                ) : (
                  <div className="p-4 border rounded-lg text-center">
                    <Text className="text-ui-fg-subtle">
                      Cannot preview this file type ({rx.mime_type})
                    </Text>
                  </div>
                )}
                <a
                  href={rx.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="secondary" size="small">
                    Open in new tab
                  </Button>
                </a>
              </div>
            ) : (
              <div className="p-4 border rounded-lg text-center">
                <Text className="text-ui-fg-subtle">
                  No file URL available. File key: {rx.file_key}
                </Text>
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-ui-fg-subtle">
              <div>
                <strong>Filename:</strong> {rx.original_filename || "—"}
              </div>
              <div>
                <strong>Type:</strong> {rx.mime_type || "—"}
              </div>
              <div>
                <strong>Size:</strong> {formatFileSize(rx.file_size_bytes)}
              </div>
              <div>
                <strong>Uploaded:</strong> {formatDate(rx.created_at)}
              </div>
            </div>
          </div>
        </Container>

        {/* Right: Details & Actions */}
        <div className="flex flex-col gap-4">
          {/* Metadata */}
          <Container className="divide-y p-0">
            <div className="px-6 py-4">
              <Heading level="h3">Prescription Details</Heading>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Text className="text-ui-fg-subtle text-xs">
                    Customer ID
                  </Text>
                  <Text className="font-mono text-xs">
                    {rx.customer_id || "—"}
                  </Text>
                </div>
                <div>
                  <Text className="text-ui-fg-subtle text-xs">
                    Guest Phone
                  </Text>
                  <Text>{rx.guest_phone || "—"}</Text>
                </div>
                <div>
                  <Text className="text-ui-fg-subtle text-xs">Doctor</Text>
                  <Text>{rx.doctor_name || "—"}</Text>
                </div>
                <div>
                  <Text className="text-ui-fg-subtle text-xs">Doctor Reg</Text>
                  <Text>{rx.doctor_reg_no || "—"}</Text>
                </div>
                <div>
                  <Text className="text-ui-fg-subtle text-xs">Patient</Text>
                  <Text>{rx.patient_name || "—"}</Text>
                </div>
                <div>
                  <Text className="text-ui-fg-subtle text-xs">
                    Prescribed On
                  </Text>
                  <Text>{formatDate(rx.prescribed_on)}</Text>
                </div>
                <div>
                  <Text className="text-ui-fg-subtle text-xs">Valid Until</Text>
                  <Text>{formatDate(rx.valid_until)}</Text>
                </div>
                <div>
                  <Text className="text-ui-fg-subtle text-xs">Reviewed At</Text>
                  <Text>{formatDate(rx.reviewed_at)}</Text>
                </div>
              </div>

              {rx.rejection_reason && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                  <Text className="text-xs text-red-800 font-medium">
                    Rejection Reason:
                  </Text>
                  <Text className="text-sm text-red-700">
                    {rx.rejection_reason}
                  </Text>
                </div>
              )}
              {rx.pharmacist_notes && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Text className="text-xs text-blue-800 font-medium">
                    Pharmacist Notes:
                  </Text>
                  <Text className="text-sm text-blue-700">
                    {rx.pharmacist_notes}
                  </Text>
                </div>
              )}
            </div>
          </Container>

          {/* Approve / Reject Actions — only for pending prescriptions */}
          {isPending && (
            <Container className="divide-y p-0">
              <div className="px-6 py-4">
                <Heading level="h3">Pharmacist Action</Heading>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="doctor_name">Doctor Name</Label>
                    <Input
                      id="doctor_name"
                      placeholder="Dr. Name from prescription"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="doctor_reg_no">Doctor Reg. No.</Label>
                    <Input
                      id="doctor_reg_no"
                      placeholder="MCI / State Council No."
                      value={doctorRegNo}
                      onChange={(e) => setDoctorRegNo(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="patient_name">Patient Name</Label>
                    <Input
                      id="patient_name"
                      placeholder="Patient name on Rx"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="prescribed_on">Prescribed On</Label>
                    <Input
                      id="prescribed_on"
                      type="date"
                      value={prescribedOn}
                      onChange={(e) => setPrescribedOn(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="valid_until">
                      Valid Until (defaults to 90 days from prescribed date)
                    </Label>
                    <Input
                      id="valid_until"
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="pharmacist_notes">
                    Pharmacist Notes (internal)
                  </Label>
                  <Textarea
                    id="pharmacist_notes"
                    placeholder="Any notes about this prescription..."
                    value={pharmacistNotes}
                    onChange={(e) => setPharmacistNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    variant="primary"
                    onClick={handleApprove}
                    disabled={submitting}
                  >
                    {submitting ? "Processing..." : "Approve Prescription"}
                  </Button>
                </div>

                <div className="border-t pt-4 mt-2">
                  <Label htmlFor="rejection_reason" className="text-red-700">
                    Rejection Reason (required to reject)
                  </Label>
                  <Textarea
                    id="rejection_reason"
                    placeholder="e.g., Illegible handwriting, expired prescription, missing doctor signature..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={2}
                  />
                  <Button
                    variant="danger"
                    onClick={handleReject}
                    disabled={submitting}
                    className="mt-2"
                  >
                    {submitting ? "Processing..." : "Reject Prescription"}
                  </Button>
                </div>
              </div>
            </Container>
          )}

          {/* Already reviewed state */}
          {!isPending && (
            <Container className="divide-y p-0">
              <div className="px-6 py-4">
                <Heading level="h3">Review Complete</Heading>
              </div>
              <div className="p-6">
                <Text className="text-ui-fg-subtle">
                  This prescription has already been{" "}
                  <strong>{rx.status.replace("_", " ")}</strong>
                  {rx.reviewed_at && ` on ${formatDate(rx.reviewed_at)}`}.
                </Text>
              </div>
            </Container>
          )}
        </div>
      </div>

      {/* Create Order Section — only for approved prescriptions with a customer */}
      {rx.status === "approved" && rx.customer_id && (
        <CreateOrderSection
          prescriptionId={rx.id}
          customerId={rx.customer_id}
          onOrderCreated={fetchPrescription}
        />
      )}
    </div>
  )
}

/* ─── Create Order Section ─────────────────────────────────────────────── */

function CreateOrderSection({
  prescriptionId,
  customerId,
  onOrderCreated,
}: {
  prescriptionId: string
  customerId: string
  onOrderCreated: () => void
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [customerAddress, setCustomerAddress] = useState<any>(null)
  const [addressLoading, setAddressLoading] = useState(true)
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [orderResult, setOrderResult] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load customer address on mount
  useEffect(() => {
    const loadAddress = async () => {
      try {
        const data = await sdk.client.fetch<{ customer: any }>(
          `/admin/customers/${customerId}?fields=*addresses`
        )
        const addrs = data.customer?.addresses ?? []
        const defaultAddr =
          addrs.find((a: any) => a.is_default_shipping) ?? addrs[0]
        setCustomerAddress(defaultAddr || null)
      } catch {
        setCustomerAddress(null)
      } finally {
        setAddressLoading(false)
      }
    }
    loadAddress()
  }, [customerId])

  // Debounced product search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      setSearchResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const data = await sdk.client.fetch<{
          products: SearchProduct[]
          count: number
        }>(`/admin/products/search?q=${encodeURIComponent(value)}&limit=10`)
        setSearchResults(data.products ?? [])
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
  }, [])

  const addItem = (product: SearchProduct) => {
    if (!product.variant) return
    // Don't add duplicates
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

  const removeItem = (variantId: string) => {
    setOrderItems((prev) => prev.filter((i) => i.variant_id !== variantId))
  }

  const updateQuantity = (variantId: string, qty: number) => {
    if (qty < 1) return
    setOrderItems((prev) =>
      prev.map((i) => (i.variant_id === variantId ? { ...i, quantity: qty } : i))
    )
  }

  const orderTotal = orderItems.reduce(
    (sum, i) => sum + i.unit_price * i.quantity,
    0
  )

  const handleCreateOrder = async () => {
    if (!orderItems.length) return
    setCreatingOrder(true)
    setOrderResult(null)

    try {
      const payload: any = {
        items: orderItems.map((i) => ({
          variant_id: i.variant_id,
          quantity: i.quantity,
        })),
      }

      // Include address if we have one
      if (customerAddress) {
        payload.shipping_address = {
          first_name: customerAddress.first_name || "",
          last_name: customerAddress.last_name || "",
          address_1: customerAddress.address_1 || "",
          address_2: customerAddress.address_2 || "",
          city: customerAddress.city || "",
          province: customerAddress.province || "",
          postal_code: customerAddress.postal_code || "",
          country_code: customerAddress.country_code || "in",
          phone: customerAddress.phone || "",
        }
      }

      const data = await sdk.client.fetch<{
        order_id: string
        message: string
      }>(`/admin/prescriptions/${prescriptionId}/create-order`, {
        method: "POST",
        body: payload,
      })

      setOrderResult({
        type: "success",
        message: `Order created successfully (${data.order_id}).`,
      })
      setOrderItems([])
      setSearchQuery("")
      setSearchResults([])
      onOrderCreated()
    } catch (err: any) {
      setOrderResult({
        type: "error",
        message: err.message || "Failed to create order.",
      })
    } finally {
      setCreatingOrder(false)
    }
  }

  const formatINR = (amount: number) =>
    `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Create Order for Customer</Heading>
        <Text className="text-ui-fg-subtle text-sm mt-1">
          Search for medicines, add to order, then create. Payment: Cash on Delivery.
        </Text>
      </div>

      {/* Order result banner */}
      {orderResult && (
        <div
          className="px-6 py-3"
          style={{
            background:
              orderResult.type === "success" ? "#ECFDF5" : "#FEF2F2",
            color: orderResult.type === "success" ? "#065F46" : "#991B1B",
          }}
        >
          <Text className="text-sm font-medium">{orderResult.message}</Text>
        </div>
      )}

      <div className="p-6 flex flex-col gap-6">
        {/* Product Search */}
        <div>
          <Label htmlFor="product_search">Search Medicines</Label>
          <Input
            id="product_search"
            placeholder="Type medicine name, generic name, or composition..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />

          {/* Search Results */}
          {searchLoading && (
            <Text className="text-ui-fg-subtle text-xs mt-2">Searching...</Text>
          )}

          {searchResults.length > 0 && (
            <div className="mt-2 border rounded-lg max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-ui-bg-subtle sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Product</th>
                    <th className="text-left p-2 font-medium">Schedule</th>
                    <th className="text-left p-2 font-medium">Strength</th>
                    <th className="text-right p-2 font-medium">Price</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((p) => {
                    const isBlocked =
                      p.drug_product?.schedule === "X" ||
                      p.drug_product?.is_narcotic ||
                      p.drug_product?.requires_refrigeration
                    const alreadyAdded = orderItems.some(
                      (i) => i.variant_id === p.variant?.id
                    )
                    return (
                      <tr
                        key={p.id}
                        className="border-t hover:bg-ui-bg-subtle-hover"
                      >
                        <td className="p-2">
                          <div className="font-medium">{p.title}</div>
                          {p.drug_product?.generic_name && (
                            <div className="text-xs text-ui-fg-subtle">
                              {p.drug_product.generic_name}
                            </div>
                          )}
                        </td>
                        <td className="p-2">
                          {p.drug_product?.schedule ? (
                            <Badge
                              color={
                                p.drug_product.schedule === "X"
                                  ? "red"
                                  : p.drug_product.schedule === "H1"
                                    ? "orange"
                                    : p.drug_product.schedule === "H"
                                      ? "blue"
                                      : "green"
                              }
                            >
                              {p.drug_product.schedule}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-2 text-xs">
                          {p.drug_product?.strength || "—"}
                        </td>
                        <td className="p-2 text-right">
                          {p.variant?.price != null
                            ? formatINR(p.variant.price)
                            : "—"}
                        </td>
                        <td className="p-2 text-right">
                          {isBlocked ? (
                            <Text className="text-xs text-red-600">
                              Blocked
                            </Text>
                          ) : (
                            <Button
                              variant="secondary"
                              size="small"
                              disabled={!p.variant || alreadyAdded}
                              onClick={() => addItem(p)}
                            >
                              {alreadyAdded ? "Added" : <PlusMini />}
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Items */}
        {orderItems.length > 0 && (
          <div>
            <Label>Order Items ({orderItems.length})</Label>
            <div className="mt-2 border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-ui-bg-subtle">
                  <tr>
                    <th className="text-left p-2 font-medium">Medicine</th>
                    <th className="text-center p-2 font-medium w-28">Qty</th>
                    <th className="text-right p-2 font-medium">Price</th>
                    <th className="text-right p-2 font-medium">Subtotal</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map((item) => (
                    <tr key={item.variant_id} className="border-t">
                      <td className="p-2">
                        <div className="font-medium">{item.product_title}</div>
                        {item.generic_name && (
                          <div className="text-xs text-ui-fg-subtle">
                            {item.generic_name} {item.strength}
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="transparent"
                            size="small"
                            onClick={() =>
                              updateQuantity(item.variant_id, item.quantity - 1)
                            }
                            disabled={item.quantity <= 1}
                          >
                            −
                          </Button>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              updateQuantity(
                                item.variant_id,
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="w-14 text-center"
                            min={1}
                          />
                          <Button
                            variant="transparent"
                            size="small"
                            onClick={() =>
                              updateQuantity(item.variant_id, item.quantity + 1)
                            }
                          >
                            +
                          </Button>
                        </div>
                      </td>
                      <td className="p-2 text-right">
                        {formatINR(item.unit_price)}
                      </td>
                      <td className="p-2 text-right font-medium">
                        {formatINR(item.unit_price * item.quantity)}
                      </td>
                      <td className="p-2 text-right">
                        <Button
                          variant="transparent"
                          size="small"
                          onClick={() => removeItem(item.variant_id)}
                        >
                          <XMarkMini />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-ui-bg-subtle">
                    <td colSpan={3} className="p-2 text-right font-semibold">
                      Total (COD)
                    </td>
                    <td className="p-2 text-right font-semibold">
                      {formatINR(orderTotal)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Customer Address */}
        <div>
          <Label>Delivery Address</Label>
          {addressLoading ? (
            <Text className="text-ui-fg-subtle text-xs mt-1">
              Loading address...
            </Text>
          ) : customerAddress ? (
            <div className="mt-1 p-3 bg-ui-bg-subtle rounded-lg text-sm">
              <Text className="font-medium">
                {customerAddress.first_name} {customerAddress.last_name}
              </Text>
              <Text className="text-ui-fg-subtle">
                {customerAddress.address_1}
                {customerAddress.address_2 && `, ${customerAddress.address_2}`}
              </Text>
              <Text className="text-ui-fg-subtle">
                {customerAddress.city}
                {customerAddress.province && `, ${customerAddress.province}`} -{" "}
                {customerAddress.postal_code}
              </Text>
              {customerAddress.phone && (
                <Text className="text-ui-fg-subtle">
                  Phone: {customerAddress.phone}
                </Text>
              )}
            </div>
          ) : (
            <div className="mt-1 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <Text className="text-sm text-yellow-800">
                No saved address found. The order cannot be created without a
                delivery address. Ask the customer to add one.
              </Text>
            </div>
          )}
        </div>

        {/* Create Order Button */}
        <div className="flex items-center gap-3 pt-2 border-t">
          <Button
            variant="primary"
            onClick={handleCreateOrder}
            disabled={
              creatingOrder ||
              orderItems.length === 0 ||
              !customerAddress
            }
          >
            {creatingOrder
              ? "Creating Order..."
              : `Create Order — ${formatINR(orderTotal)}`}
          </Button>
          <Text className="text-xs text-ui-fg-subtle">
            Payment: Cash on Delivery
          </Text>
        </div>
      </div>
    </Container>
  )
}

export default PrescriptionDetailPage
