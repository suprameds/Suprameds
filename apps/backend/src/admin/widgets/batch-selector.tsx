import { defineWidgetConfig } from "@medusajs/admin-sdk"

const BatchSelectorWidget = () => {
  return (
    <div className="bg-white p-4 border rounded-lg shadow-sm">
      <h2 className="text-large font-semibold">batch-selector Widget</h2>
      <p className="text-ui-fg-subtle">Placeholder for batch-selector integration.</p>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after", // TODO: Update zone based on specific widget
})

export default BatchSelectorWidget
