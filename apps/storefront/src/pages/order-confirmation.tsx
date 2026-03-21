import { OrderDetails, deriveOrderProgress } from "@/components/order"
import { useOrder } from "@/lib/hooks/use-orders"
import { useLoaderData } from "@tanstack/react-router"
import { ORDER_FIELDS } from "@/routes/$countryCode/order/$orderId/confirmed"

const OrderConfirmation = () => {
  const { orderId } = useLoaderData({
    from: "/$countryCode/order/$orderId/confirmed",
  })

  const { data: order, isLoading } = useOrder({
    order_id: orderId,
    fields: ORDER_FIELDS,
  })

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

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF8" }}>
      <div className="content-container py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span style={{ color: "#27AE60" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </span>
            <h1 className="text-xl font-serif font-semibold" style={{ color: "#0D1B2A" }}>
              {summaryLabel === "Cancelled" ? "Order Cancelled" : "Order Confirmed"}
            </h1>
          </div>
          <p className="text-sm" style={{ color: "#6B7280" }}>
            Thank you for your order! We'll notify you as it progresses.
          </p>
        </div>

        <OrderDetails order={order} />
      </div>
    </div>
  )
}

export default OrderConfirmation
