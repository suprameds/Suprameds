import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CommandLineSolid } from "@medusajs/icons"

const DispensePage = () => {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4 text-[var(--suprameds-navy)]">
        Suprameds dispense
      </h1>
      <p className="text-ui-fg-subtle">
        Custom admin page for dispense management.
      </p>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Dispense",
  icon: CommandLineSolid, // TODO: Update icon
})

export default DispensePage
