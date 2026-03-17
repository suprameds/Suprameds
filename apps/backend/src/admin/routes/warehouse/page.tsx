import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CommandLineSolid } from "@medusajs/icons"

const WarehousePage = () => {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4 text-[var(--suprameds-navy)]">
        Suprameds warehouse
      </h1>
      <p className="text-ui-fg-subtle">
        Custom admin page for warehouse management.
      </p>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Warehouse",
  icon: CommandLineSolid, // TODO: Update icon
})

export default WarehousePage
