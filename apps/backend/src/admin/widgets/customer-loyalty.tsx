import { defineWidgetConfig } from "@medusajs/admin-sdk"

const CustomerLoyaltyWidget = () => {
  return (
    <div className="bg-white p-4 border rounded-lg shadow-sm">
      <h2 className="text-large font-semibold">customer-loyalty Widget</h2>
      <p className="text-ui-fg-subtle">Placeholder for customer-loyalty integration.</p>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after", // TODO: Update zone based on specific widget
})

export default CustomerLoyaltyWidget
