import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CommandLineSolid } from "@medusajs/icons"

const GrnPage = () => {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4 text-[var(--suprameds-navy)]">
        Suprameds grn
      </h1>
      <p className="text-ui-fg-subtle">
        Custom admin page for grn management.
      </p>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Grn",
  icon: CommandLineSolid, // TODO: Update icon
})

export default GrnPage
