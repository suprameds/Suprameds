import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CommandLineSolid } from "@medusajs/icons"

const H1RegisterPage = () => {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4 text-[var(--suprameds-navy)]">
        Suprameds h1-register
      </h1>
      <p className="text-ui-fg-subtle">
        Custom admin page for h1-register management.
      </p>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "H1 Register",
  icon: CommandLineSolid, // TODO: Update icon
})

export default H1RegisterPage
