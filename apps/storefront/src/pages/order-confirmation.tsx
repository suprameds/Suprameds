import { OrderDetails, deriveOrderProgress } from "@/components/order"
import { useOrder } from "@/lib/hooks/use-orders"
import { trackPurchase } from "@/lib/utils/analytics"
import { sdk } from "@/lib/utils/sdk"
import { isManual } from "@/lib/utils/checkout"
import { useLoaderData } from "@tanstack/react-router"
import { ORDER_FIELDS } from "@/routes/$countryCode/order/$orderId/confirmed"
import { useCallback, useEffect, useRef, useState } from "react"
import { ReturnRequestForm, isOrderReturnable, isWithinReturnWindow } from "@/components/return-request-form"

// ============ COD CONFIRMATION BANNER ============

type CodStatus = "pending" | "confirming" | "confirmed" | "cancelled" | "error"

const CodConfirmationBanner = ({ order }: { order: any }) => {
  const orderStatus = order.status as string
  const codMeta = (order.metadata as Record<string, any> | undefined)?.cod_confirmed

  // Determine initial state: if the order exists and isn't cancelled,
  // the COD order is inherently confirmed (completeCart succeeded).
  const resolveInitialStatus = (): CodStatus => {
    if (codMeta === false) return "cancelled"
    if (codMeta === true) return "confirmed"
    if (orderStatus === "canceled" || orderStatus === "cancelled") return "cancelled"
    // Order placed successfully — treat as confirmed
    if (orderStatus === "pending" || orderStatus === "completed" || orderStatus === "archived") return "confirmed"
    return "confirmed"
  }

  const [status, setStatus] = useState<CodStatus>(resolveInitialStatus)
  const [errorMsg, setErrorMsg] = useState("")

  const isFinalState = orderStatus === "canceled" || orderStatus === "cancelled" || orderStatus === "completed"

  useEffect(() => {
    if (codMeta === true) setStatus("confirmed")
    if (codMeta === false) setStatus("cancelled")
  }, [codMeta])

  const handleCodAction = useCallback(async (confirmed: boolean) => {
    setStatus("confirming")
    setErrorMsg("")
    try {
      await sdk.client.fetch(`/store/orders/cod-confirm`, {
        method: "POST",
        body: { order_id: order.id, confirmed },
      })
      setStatus(confirmed ? "confirmed" : "cancelled")
    } catch (err) {
      setStatus("error")
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    }
  }, [order.id])

  if (isFinalState && status === "pending") return null

  // Already confirmed
  if (status === "confirmed") {
    return (
      <div
        className="rounded-xl border p-4 flex items-center gap-3"
        style={{ background: "#ECFDF5", borderColor: "#A7F3D0" }}
      >
        <CheckCircleIcon color="#065F46" />
        <div>
          <p className="text-sm font-semibold" style={{ color: "#065F46" }}>
            COD Order Confirmed
          </p>
          <p className="text-xs" style={{ color: "#047857" }}>
            Your cash on delivery order has been confirmed. We'll prepare it for dispatch.
          </p>
        </div>
      </div>
    )
  }

  // Cancelled
  if (status === "cancelled") {
    return (
      <div
        className="rounded-xl border p-4 flex items-center gap-3"
        style={{ background: "#FEF2F2", borderColor: "#FECACA" }}
      >
        <XCircleIcon color="#991B1B" />
        <div>
          <p className="text-sm font-semibold" style={{ color: "#991B1B" }}>
            Order Cancelled
          </p>
          <p className="text-xs" style={{ color: "#B91C1C" }}>
            You chose not to confirm this order. No charges will be applied.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl border-2 p-5 flex flex-col gap-4"
      style={{ background: "#FFFBEB", borderColor: "#F59E0B" }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <CodBadgeIcon />
        </div>
        <div>
          <p className="text-base font-semibold" style={{ color: "#92400E" }}>
            Please confirm your Cash on Delivery order
          </p>
          <p className="text-sm mt-1" style={{ color: "#78350F" }}>
            Your order is placed but requires confirmation. Please confirm below
            to proceed, or cancel if you've changed your mind.
            Unconfirmed COD orders are automatically cancelled after 30 minutes.
          </p>
        </div>
      </div>

      {status === "error" && (
        <div
          className="text-sm rounded-lg border px-3 py-2"
          style={{ background: "#FEF2F2", borderColor: "#FECACA", color: "#991B1B" }}
        >
          {errorMsg}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => handleCodAction(true)}
          disabled={status === "confirming"}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "#1A7A4A" }}
        >
          {status === "confirming" ? "Confirming…" : "Confirm Order"}
        </button>
        <button
          onClick={() => handleCodAction(false)}
          disabled={status === "confirming"}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold border transition-all hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ color: "#991B1B", borderColor: "#FCA5A5" }}
        >
          Cancel Order
        </button>
      </div>
    </div>
  )
}

// ============ ICONS ============

const CheckCircleIcon = ({ color = "#065F46", size = 20 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
)

const XCircleIcon = ({ color = "#991B1B" }: { color?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
)

const CodBadgeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D68910" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
)

// ============ ORDER EDIT BANNER ============

const OrderEditBanner = ({ order }: { order: any }) => {
  const meta = order.metadata as Record<string, any> | undefined
  const editedAt = meta?.edited_at as string | undefined
  const editSummary = meta?.edit_summary as string | undefined

  if (!editedAt) return null

  const formattedDate = new Date(editedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div
      className="rounded-xl border p-4 flex items-start gap-3"
      style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}
    >
      <svg
        width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="flex-shrink-0 mt-0.5"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
      <div>
        <p className="text-sm font-semibold" style={{ color: "#1E40AF" }}>
          Order Modified
        </p>
        <p className="text-xs mt-0.5" style={{ color: "#3B82F6" }}>
          {editSummary || "Your order was updated by our pharmacy team."}{" "}
          <span style={{ color: "#6B7280" }}>({formattedDate})</span>
        </p>
        <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
          The items and total below reflect the latest version of your order.
          Contact us if you have questions.
        </p>
      </div>
    </div>
  )
}

// ============ RETURN REQUEST SECTION ============

const ReturnSection = ({ order }: { order: any }) => {
  const [isOpen, setIsOpen] = useState(false)

  const returnable = isOrderReturnable(order)
  const withinWindow = isWithinReturnWindow(order.created_at)

  // Show the section only if the order is delivered/completed and within 48h window
  // Also show with a "window closed" state up to 24h after window expiry so
  // users who just missed it can still see messaging.
  const justMissed =
    returnable && !withinWindow && isWithinReturnWindow(order.created_at, 72)

  if (!returnable) return null
  if (!withinWindow && !justMissed) return null

  if (justMissed) {
    return (
      <div
        className="rounded-xl border p-4 flex items-start gap-3"
        style={{ background: "#FEF2F2", borderColor: "#FECACA" }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#991B1B"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-shrink-0 mt-0.5"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div>
          <p className="text-sm font-semibold" style={{ color: "#991B1B" }}>
            Return window has closed
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#B91C1C" }}>
            The 48-hour return window for this order has passed. For batch recall or
            exceptional cases, please contact support at{" "}
            <a
              href="tel:+918008005678"
              className="underline"
              style={{ color: "#991B1B" }}
            >
              +91 800 800 5678
            </a>
            .
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6"
        style={{ background: "#F0FDFA", borderColor: "#99F6E4" }}
      >
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: "#0D1B2A" }}>
            Something wrong with your order?
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
            You have 48 hours from delivery to request a return. Opened medicines
            cannot be returned.
          </p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold border transition-all hover:bg-teal-50"
          style={{ color: "#0E7C86", borderColor: "#0E7C86", background: "#fff" }}
        >
          Request Return
        </button>
      </div>

      <ReturnRequestForm
        order={{
          id: order.id,
          items: order.items ?? [],
          status: order.status,
          created_at: order.created_at,
          fulfillment_status: order.fulfillment_status,
        }}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  )
}

// ============ MAIN PAGE ============

const OrderConfirmation = () => {
  const { orderId } = useLoaderData({
    from: "/$countryCode/order/$orderId/confirmed",
  })

  const { data: order, isLoading } = useOrder({
    order_id: orderId,
    fields: ORDER_FIELDS,
  })

  // GA4: track purchase event once per order
  const purchaseTracked = useRef(false)
  useEffect(() => {
    if (!order || purchaseTracked.current) return
    purchaseTracked.current = true
    trackPurchase(
      order.display_id?.toString() || order.id,
      (order as any).total ?? 0,
      ((order as any).items || []).map((item: any) => ({
        item_id: item.product_id || item.id,
        item_name: item.product_title || item.title || "",
        price: item.unit_price ?? 0,
        quantity: item.quantity ?? 1,
      })),
      (order as any).currency_code?.toUpperCase() || "INR",
      (order as any).tax_total ?? 0,
      (order as any).shipping_total ?? 0,
    )
  }, [order])

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" style={{ background: "#FAFAF8" }}>
        <p className="text-sm" style={{ color: "#9CA3AF" }}>Loading order details…</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="content-container py-12 text-center" style={{ background: "#FAFAF8" }}>
        <h1 className="text-xl font-serif font-semibold mb-2" style={{ color: "#0D1B2A" }}>
          Order Not Found
        </h1>
        <p className="text-sm" style={{ color: "#9CA3AF" }}>
          The order could not be found. Please check the link or contact support.
        </p>
      </div>
    )
  }

  const { summaryLabel } = deriveOrderProgress(order)

  // Detect COD payment
  const paymentSessions = order.payment_collections?.[0]?.payment_sessions
  const providerId = paymentSessions?.[0]?.provider_id ?? ""
  const isCOD = isManual(providerId)

  // Show invoice for non-cancelled orders
  const isCancelled = order.status === "canceled" || order.status === "cancelled"

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF8" }}>
      <div className="content-container py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span style={{ color: "#27AE60" }}>
              <CheckCircleIcon color="#27AE60" />
            </span>
            <h1 className="text-xl font-serif font-semibold" style={{ color: "#0D1B2A" }}>
              {summaryLabel === "Cancelled" ? "Order Cancelled" : "Order Confirmed"}
            </h1>
          </div>
          <p className="text-sm" style={{ color: "#6B7280" }}>
            Thank you for your order! We'll notify you as it progresses.
          </p>
        </div>

        {/* COD Confirmation Banner */}
        {isCOD && <div className="mb-6"><CodConfirmationBanner order={order} /></div>}

        {/* Order Edit Banner */}
        <div className="mb-6"><OrderEditBanner order={order} /></div>

        <OrderDetails order={order} />

        {/* Return Request Section — shown only for delivered/completed orders within window */}
        {!isCancelled && (
          <div className="mt-8">
            <ReturnSection order={order} />
          </div>
        )}
      </div>
    </div>
  )
}

export default OrderConfirmation
