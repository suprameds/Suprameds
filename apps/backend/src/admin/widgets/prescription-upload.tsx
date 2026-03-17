import { defineWidgetConfig } from "@medusajs/admin-sdk"

const PrescriptionUploadWidget = () => {
  return (
    <div className="bg-white p-4 border rounded-lg shadow-sm">
      <h2 className="text-large font-semibold">prescription-upload Widget</h2>
      <p className="text-ui-fg-subtle">Placeholder for prescription-upload integration.</p>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after", // TODO: Update zone based on specific widget
})

export default PrescriptionUploadWidget
