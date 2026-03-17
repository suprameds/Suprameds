import { defineWidgetConfig } from "@medusajs/admin-sdk"

const PharmacistAdjustmentWidget = () => {
  return (
    <div className="bg-white p-4 border rounded-lg shadow-sm">
      <h2 className="text-large font-semibold">pharmacist-adjustment Widget</h2>
      <p className="text-ui-fg-subtle">Placeholder for pharmacist-adjustment integration.</p>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after", // TODO: Update zone based on specific widget
})

export default PharmacistAdjustmentWidget
