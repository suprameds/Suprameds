import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CommandLineSolid } from "@medusajs/icons"

const CompliancePage = () => {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4 text-[var(--suprameds-navy)]">
        Suprameds compliance
      </h1>
      <p className="text-ui-fg-subtle">
        Custom admin page for compliance management.
      </p>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Compliance",
  icon: CommandLineSolid, // TODO: Update icon
})

export default CompliancePage
