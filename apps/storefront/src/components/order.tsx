/* eslint-disable react-refresh/only-export-components */
import Address from "@/components/address"
import PaymentMethodInfo from "@/components/payment-method-info"
import { ShipmentTracker } from "@/components/shipment-tracker"
import { Price } from "@/components/ui/price"
import { Thumbnail } from "@/components/ui/thumbnail"
import { isPaidWithGiftCard } from "@/lib/utils/checkout"
import { HttpTypes } from "@medusajs/types"
import { useCallback, useState } from "react"

const BACKEND_URL = import.meta.env.VITE_MEDUSA_BACKEND_URL || "http://localhost:9000"
const PUBLISHABLE_KEY = import.meta.env.VITE_MEDUSA_PUBLISHABLE_KEY ?? ""

// ============ INVOICE DOWNLOAD BUTTON ============

/**
 * Fetches the invoice PDF as a blob with proper auth headers
 * and triggers a browser download.
 */
export const InvoiceDownloadButton = ({ orderId }: { orderId: string }) => {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState("")

  const handleDownload = useCallback(async () => {
    setDownloading(true)
    setError("")
    try {
      const headers: Record<string, string> = {}
      if (PUBLISHABLE_KEY) {
        headers["x-publishable-api-key"] = PUBLISHABLE_KEY
      }

      const res = await fetch(`${BACKEND_URL}/store/invoices/${orderId}/pdf`, {
        credentials: "include",
        headers,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
        throw new Error(body.message || `Download failed (${res.status})`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `invoice-${orderId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error("[invoice]", err)
      setError(err.message || "Download failed")
    } finally {
      setDownloading(false)
    }
  }, [orderId])

  return (
    <div className="inline-flex flex-col">
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        style={{ color: "var(--brand-teal)", borderColor: "var(--brand-teal)", background: "#F0FDFA" }}
      >
        <DownloadIcon />
        {downloading ? "Downloading…" : "Download Invoice"}
      </button>
      {error && (
        <span className="text-xs mt-1" style={{ color: "var(--brand-red)" }}>{error}</span>
      )}
    </div>
  )
}

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

type OrderInfoProps = {
  order: HttpTypes.StoreOrder
}

// ============ ORDER PROGRESS DERIVATION ============

type ProgressStep = {
  key: string
  label: string
  description: string
  status: "completed" | "active" | "upcoming"
  timestamp?: string | Date
}

/**
 * Derives a customer-friendly progress timeline from Medusa's order +
 * fulfillment + payment statuses. Returns exactly the steps that apply.
 */
export function deriveOrderProgress(order: HttpTypes.StoreOrder): {
  steps: ProgressStep[]
  summaryLabel: string
  summaryColor: string
  summaryBg: string
  isCanceled: boolean
} {
  const fulfillmentStatus = (order as any).fulfillment_status as string | undefined
  const paymentSessions = order.payment_collections?.[0]?.payment_sessions
  const paymentStatus = paymentSessions?.[0]?.status
  const providerId = paymentSessions?.[0]?.provider_id ?? ""
  const isCOD = providerId.includes("system_default") || providerId === "manual"

  const isCanceled = order.status === "canceled" || order.status === "cancelled"

  if (isCanceled) {
    return {
      steps: [
        { key: "placed", label: "Order Placed", description: "Your order was received", status: "completed", timestamp: order.created_at },
        { key: "cancelled", label: "Order Cancelled", description: "This order has been cancelled", status: "active" },
      ],
      summaryLabel: "Cancelled",
      summaryColor: "#991B1B",
      summaryBg: "#FEF2F2",
      isCanceled: true,
    }
  }

  const paymentConfirmed =
    isCOD ||
    paymentStatus === "authorized" ||
    paymentStatus === "captured"

  const isDelivered =
    fulfillmentStatus === "delivered" ||
    order.status === "completed"

  const isShipped =
    isDelivered ||
    fulfillmentStatus === "shipped" ||
    fulfillmentStatus === "fulfilled" ||
    fulfillmentStatus === "partially_shipped" ||
    fulfillmentStatus === "partially_fulfilled"

  const steps: ProgressStep[] = [
    {
      key: "placed",
      label: "Order Placed",
      description: "Your order has been received",
      status: "completed",
      timestamp: order.created_at,
    },
    {
      key: "payment",
      label: isCOD ? "COD Confirmed" : "Payment Received",
      description: isCOD
        ? "Pay when your order arrives"
        : "Payment has been processed",
      status: paymentConfirmed ? "completed" : "active",
    },
    {
      key: "processing",
      label: "Processing",
      description: "Our pharmacy team is preparing your order",
      status: paymentConfirmed
        ? (isShipped || isDelivered ? "completed" : "active")
        : "upcoming",
    },
    {
      key: "shipped",
      label: "Shipped",
      description: "Your order is on its way",
      status: isShipped
        ? (isDelivered ? "completed" : "active")
        : "upcoming",
    },
    {
      key: "delivered",
      label: "Delivered",
      description: "Order delivered successfully",
      status: isDelivered ? "completed" : "upcoming",
    },
  ]

  let summaryLabel = "Order Placed"
  let summaryColor = "var(--brand-amber-dark)"
  let summaryBg = "#FEF3C7"

  if (isDelivered) {
    summaryLabel = "Delivered"
    summaryColor = "#065F46"
    summaryBg = "#ECFDF5"
  } else if (isShipped) {
    summaryLabel = "Shipped"
    summaryColor = "#1E40AF"
    summaryBg = "#DBEAFE"
  } else if (paymentConfirmed) {
    summaryLabel = "Processing"
    summaryColor = "var(--brand-amber-dark)"
    summaryBg = "#FEF3C7"
  }

  return { steps, summaryLabel, summaryColor, summaryBg, isCanceled }
}

// ============ PROGRESS TRACKER COMPONENT ============

export const OrderProgressTracker = ({ order }: { order: HttpTypes.StoreOrder }) => {
  const { steps, isCanceled } = deriveOrderProgress(order)

  return (
    <div className="w-full">
      {/* Desktop: horizontal stepper */}
      <div className="hidden sm:flex items-start justify-between relative">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          return (
            <div key={step.key} className="flex flex-col items-center flex-1 relative">
              {/* Connector line */}
              {!isLast && (
                <div
                  className="absolute top-3.5 h-0.5 z-0"
                  style={{
                    left: "50%",
                    right: "-50%",
                    background: step.status === "completed" && steps[i + 1]?.status !== "upcoming"
                      ? "var(--brand-green)"
                      : "#E5E7EB",
                  }}
                />
              )}

              {/* Step circle */}
              <div
                className="relative z-10 flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all"
                style={{
                  borderColor:
                    step.status === "completed" ? "var(--brand-green)"
                    : step.status === "active" ? (isCanceled ? "var(--brand-red)" : "var(--brand-amber)")
                    : "#D1D5DB",
                  background:
                    step.status === "completed" ? "var(--brand-green)"
                    : step.status === "active" ? (isCanceled ? "#FEF2F2" : "#FFFBEB")
                    : "var(--bg-secondary)",
                }}
              >
                {step.status === "completed" ? (
                  <CheckIcon />
                ) : step.status === "active" ? (
                  isCanceled
                    ? <XIcon />
                    : <div className="w-2 h-2 rounded-full" style={{ background: "var(--brand-amber)" }} />
                ) : (
                  <div className="w-2 h-2 rounded-full" style={{ background: "#D1D5DB" }} />
                )}
              </div>

              {/* Label */}
              <p
                className="text-xs font-semibold mt-2 text-center"
                style={{
                  color:
                    step.status === "completed" ? "#065F46"
                    : step.status === "active" ? (isCanceled ? "#991B1B" : "var(--brand-amber-dark)")
                    : "var(--text-tertiary)",
                }}
              >
                {step.label}
              </p>
              <p
                className="text-[10px] mt-0.5 text-center max-w-[110px] leading-tight"
                style={{ color: step.status === "upcoming" ? "#D1D5DB" : "var(--text-tertiary)" }}
              >
                {step.description}
              </p>
              {step.timestamp && step.status === "completed" && (
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                  {new Date(step.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile: vertical stepper */}
      <div className="sm:hidden flex flex-col gap-0">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          return (
            <div key={step.key} className="flex gap-3">
              {/* Track column */}
              <div className="flex flex-col items-center">
                <div
                  className="flex items-center justify-center w-6 h-6 rounded-full border-2 flex-shrink-0"
                  style={{
                    borderColor:
                      step.status === "completed" ? "var(--brand-green)"
                      : step.status === "active" ? (isCanceled ? "var(--brand-red)" : "var(--brand-amber)")
                      : "#D1D5DB",
                    background:
                      step.status === "completed" ? "var(--brand-green)"
                      : step.status === "active" ? (isCanceled ? "#FEF2F2" : "#FFFBEB")
                      : "var(--bg-secondary)",
                  }}
                >
                  {step.status === "completed" ? (
                    <CheckIcon size={12} />
                  ) : step.status === "active" ? (
                    isCanceled
                      ? <XIcon size={10} />
                      : <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--brand-amber)" }} />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#D1D5DB" }} />
                  )}
                </div>
                {!isLast && (
                  <div
                    className="w-0.5 flex-1 min-h-[24px]"
                    style={{
                      background: step.status === "completed" && steps[i + 1]?.status !== "upcoming"
                        ? "var(--brand-green)"
                        : "#E5E7EB",
                    }}
                  />
                )}
              </div>

              {/* Text column */}
              <div className="pb-4 -mt-0.5">
                <p
                  className="text-sm font-semibold"
                  style={{
                    color:
                      step.status === "completed" ? "#065F46"
                      : step.status === "active" ? (isCanceled ? "#991B1B" : "var(--brand-amber-dark)")
                      : "var(--text-tertiary)",
                  }}
                >
                  {step.label}
                </p>
                <p className="text-xs" style={{ color: step.status === "upcoming" ? "#D1D5DB" : "var(--text-tertiary)" }}>
                  {step.description}
                </p>
                {step.timestamp && step.status === "completed" && (
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                    {new Date(step.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const CheckIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--text-inverse)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const XIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

// ============ TRACKING INFO ============

/** Medusa v2: tracking may live on tracking_links or fulfillment labels */
function collectTrackingEntries(fulfillments: any[] | undefined): { key: string; number: string; url?: string }[] {
  if (!fulfillments?.length) return []
  const out: { key: string; number: string; url?: string }[] = []
  for (const f of fulfillments) {
    for (const t of f.tracking_links ?? []) {
      if (t?.tracking_number) {
        out.push({
          key: `tl-${f.id ?? "f"}-${t.tracking_number}`,
          number: t.tracking_number,
          url: t.url ?? undefined,
        })
      }
    }
    for (const lab of f.labels ?? []) {
      const num = lab.tracking_number ?? lab.trackingNumber
      if (num) {
        out.push({
          key: `lb-${f.id ?? "f"}-${num}`,
          number: String(num),
          url: lab.tracking_url ?? lab.trackingUrl ?? undefined,
        })
      }
    }
  }
  return out
}

// ============ ORDER INFO ============

export const OrderInfo = ({ order }: OrderInfoProps) => {
  const fulfillments = (order as any).fulfillments as any[] | undefined
  const trackingEntries = collectTrackingEntries(fulfillments)
  const isCancelled = order.status === "canceled" || order.status === "cancelled"

  return (
    <div className="flex flex-col gap-5">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
        <div className="flex gap-2 items-center">
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Order #{order.display_id ?? order.id}
          </span>
        </div>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          Placed on{" "}
          {new Date(order.created_at!).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
        {/* Invoice download — shown for non-cancelled orders */}
        {!isCancelled && <InvoiceDownloadButton orderId={order.id} />}
      </div>

      {/* Progress tracker */}
      <div
        className="rounded-xl border p-5"
        style={{ borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}
      >
        <OrderProgressTracker order={order} />
      </div>

      {/* Rich shipment tracking (fetches from custom /store/shipments endpoint) */}
      <ShipmentTracker orderId={order.id} />

      {/* Fallback: Medusa fulfillment tracking links (shown only if present) */}
      {trackingEntries.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Tracking Number
          </span>
          {trackingEntries.map((t) => (
            <span key={t.key} className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {t.url ? (
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                  style={{ color: "var(--brand-teal)" }}
                >
                  {t.number}
                </a>
              ) : (
                t.number
              )}
            </span>
          ))}
        </div>
      )}

      {/* Contact info */}
      <div className="flex gap-2 items-center">
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Email:</span>
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {order.customer?.email ?? order.email ?? "N/A"}
        </span>
      </div>
    </div>
  )
}

type OrderLineItemProps = {
  item: HttpTypes.StoreOrderLineItem
  order: HttpTypes.StoreOrder
}

export const OrderLineItem = ({ item, order }: OrderLineItemProps) => {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-[var(--border-primary)] last:border-b-0">
      <Thumbnail
        thumbnail={item.thumbnail}
        alt={item.product_title || item.title}
        className="w-16 h-16"
      />
      <div className="flex-1 flex flex-col gap-y-1">
        <span className="text-base font-semibold text-[var(--text-primary)]">{item.product_title}</span>
        {item.variant_title && item.variant_title !== "Default Variant" && (
          <span className="text-sm text-[var(--text-secondary)]">{item.variant_title}</span>
        )}
        <span className="text-sm text-[var(--text-secondary)]">Quantity: {item.quantity}</span>
      </div>
      <div className="text-right">
        <Price
          price={item.total}
          currencyCode={order.currency_code}
          className="text-[var(--text-secondary)]"
        />
      </div>
    </div>
  )
}

type OrderSummaryProps = {
  order: HttpTypes.StoreOrder
}

export const OrderSummary = ({ order }: OrderSummaryProps) => {
  return (
    <div className="space-y-4">
      <h3 className="mb-4 font-semibold">Summary</h3>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-secondary)]">Subtotal</span>
          <Price
            price={(order as any).item_subtotal ?? order.subtotal}
            currencyCode={order.currency_code}
            className="text-[var(--text-secondary)]"
          />
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-secondary)]">Shipping</span>
          <Price
            price={
              (order as any).shipping_subtotal
                ?? Math.round(((order.shipping_total ?? 0) / 1.05) * 100) / 100
            }
            currencyCode={order.currency_code}
            className="text-[var(--text-secondary)]"
          />
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-secondary)]">Discount</span>
          <Price
            price={order.discount_total}
            currencyCode={order.currency_code}
            type="discount"
            className="text-[var(--text-secondary)]"
          />
        </div>

        {(order.tax_total ?? 0) > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-[var(--text-tertiary)]">Tax (incl. 5% GST)</span>
            <Price
              price={order.tax_total}
              currencyCode={order.currency_code}
              className="text-[var(--text-tertiary)]"
            />
          </div>
        )}
      </div>

      <hr className="bg-[var(--border-primary)]" />

      <div className="flex justify-between">
        <span className="text-[var(--text-primary)] text-sm">Total</span>
        <Price price={(order.total ?? 0) - (order.tax_total ?? 0)} currencyCode={order.currency_code} />
      </div>
    </div>
  )
}

type OrderShippingProps = {
  order: HttpTypes.StoreOrder
}

export const OrderShipping = ({ order }: OrderShippingProps) => {
  return (
    <div>
      <h3 className="mb-4 font-semibold">Delivery Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <span className="text-base font-semibold text-[var(--text-primary)] mb-2">
            Shipping Address
          </span>
          {order.shipping_address && <Address address={order.shipping_address} />}
        </div>

        {order.shipping_methods?.[0] && (
          <div>
            <span className="text-base font-semibold text-[var(--text-primary)] mb-2">
              Shipping Method
            </span>
            <div className="text-sm text-[var(--text-secondary)] flex items-center justify-between">
              <div>{order.shipping_methods[0].name}</div>
              <Price
                price={order.shipping_methods[0].amount}
                currencyCode={order.currency_code}
                className="text-[var(--text-secondary)]"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

type OrderBillingProps = {
  order: HttpTypes.StoreOrder
}

export const OrderBilling = ({ order }: OrderBillingProps) => {
  const paidByGiftcard = isPaidWithGiftCard(order)

  return (
    <div>
      <h3 className="mb-4">Billing Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <span className="text-base font-semibold text-[var(--text-primary)] mb-2">
            Billing Address
          </span>
          <div className="text-sm text-[var(--text-secondary)]">
            {order.billing_address ? (
              <Address address={order.billing_address} />
            ) : (
              <span>Same as shipping address</span>
            )}
          </div>
        </div>
        <div>
          <span className="text-base font-semibold text-[var(--text-primary)] mb-2">Payment Method</span>
          <div className="text-sm text-[var(--text-secondary)]">
            {order.payment_collections?.[0].payment_sessions?.[0] && (
              <PaymentMethodInfo
                provider_id={order.payment_collections[0].payment_sessions[0].provider_id}
              />
            )}
            {paidByGiftcard && <span>Gift Card</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

interface OrderDetailsProps {
  order: HttpTypes.StoreOrder
}

export const OrderDetails = ({ order }: OrderDetailsProps) => {
  return (
    <div>
      <div className="flex flex-col gap-8">
        <OrderInfo order={order} />
        <hr className="bg-[var(--border-primary)]" />
        <div className="flex flex-col gap-4">
          <h3 className="mb-4 font-semibold">Items</h3>
          {order.items?.map((item) => (
            <OrderLineItem key={item.id} item={item} order={order} />
          ))}
        </div>
        <hr className="bg-[var(--border-primary)]" />
        <OrderShipping order={order} />
        <hr className="bg-[var(--border-primary)]" />
        <OrderBilling order={order} />
        <hr className="bg-[var(--border-primary)]" />
        <OrderSummary order={order} />
      </div>
    </div>
  )
}

export default OrderDetails
