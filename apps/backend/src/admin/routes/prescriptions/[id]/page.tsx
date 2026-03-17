// @ts-ignore
import { useParams } from "react-router-dom"
import { Container, Heading } from "@medusajs/ui"

const PrescriptionDetail = () => {
  const { id } = useParams()

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Review Prescription Details</Heading>
      </div>
      <div className="p-6">
        <p className="text-ui-fg-subtle mb-4">
          Reviewing ID: <strong>{id}</strong>
        </p>
        <p className="text-ui-fg-subtle">
          Implementation pending. Need to connect to <code>GET /admin/prescriptions/:id</code> for image display and <code>POST /admin/prescriptions/:id</code> to submit approval line items or rejection reasons.
        </p>
      </div>
    </Container>
  )
}

export default PrescriptionDetail
