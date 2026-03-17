import { defineWidgetConfig } from "@medusajs/admin-sdk"

const OrderRxReviewWidget = () => {
  return (
    <div className="bg-white p-4 border rounded-lg shadow-sm">
      <h2 className="text-large font-semibold">order-rx-review Widget</h2>
      <p className="text-ui-fg-subtle">Placeholder for order-rx-review integration.</p>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after", // TODO: Update zone based on specific widget
})

export default OrderRxReviewWidget
