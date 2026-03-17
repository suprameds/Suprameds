import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading } from "@medusajs/ui"
import { DocumentText } from "@medusajs/icons"

const PrescriptionsQueue = () => {
  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Pharmacist Queue (Prescriptions)</Heading>
      </div>
      <div className="p-6">
        <p className="text-ui-fg-subtle">
          Queue implementation pending. Need to connect a data table to <code>GET /admin/prescriptions</code> to allow filtering by pending status.
        </p>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Rx Queue",
  icon: DocumentText,
})

export default PrescriptionsQueue
