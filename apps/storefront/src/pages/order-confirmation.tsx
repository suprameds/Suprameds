import { OrderDetails } from "@/components/order"
import { useOrder } from "@/lib/hooks/use-orders"
import { useLoaderData } from "@tanstack/react-router"
import { ORDER_FIELDS } from "@/routes/$countryCode/order/$orderId/confirmed"

const OrderConfirmation = () => {
  const { orderId } = useLoaderData({
    from: "/$countryCode/order/$orderId/confirmed",
  })

  // Live query — refetches on mount and window focus so fulfillment status
  // updates appear immediately without needing a full page reload.
  const { data: order, isLoading } = useOrder({
    order_id: orderId,
    fields: ORDER_FIELDS,
  })

  if (isLoading) {
    return (
      <div className="content-container py-6">
        <p className="text-secondary-text">Loading order details…</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="content-container py-6">
        <h1 className="text-xl mb-6">Order Not Found</h1>
        <p className="text-secondary-text mb-6">The order could not be found.</p>
      </div>
    )
  }

  return (
    <div className="content-container py-6">
      <h1 className="text-xl mb-6">Order Confirmed</h1>
      <p className="text-secondary-text mb-6">Thank you for your order!</p>
      <OrderDetails order={order} />
    </div>
  )
}

export default OrderConfirmation
