import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, MedusaError } from "@medusajs/framework/utils"

const VALID_ROLES = ["pharmacist", "customer", ""] as const

/**
 * GET /admin/customers/:id/role
 * Returns the customer's current role from metadata.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const customerService = req.scope.resolve(Modules.CUSTOMER) as any

  const customer = await customerService.retrieveCustomer(id)
  if (!customer) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Customer not found.")
  }

  return res.json({
    customer_id: id,
    role: (customer.metadata as any)?.role || "customer",
  })
}

/**
 * POST /admin/customers/:id/role
 * Sets the customer's role in metadata.
 * Body: { role: "pharmacist" | "customer" | "" }
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const { role } = req.body as { role: string }

  if (!VALID_ROLES.includes(role as any)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Invalid role "${role}". Valid: ${VALID_ROLES.filter(Boolean).join(", ")}`
    )
  }

  const customerService = req.scope.resolve(Modules.CUSTOMER) as any
  const customer = await customerService.retrieveCustomer(id)
  if (!customer) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Customer not found.")
  }

  const metadata = { ...(customer.metadata || {}), role: role || undefined }
  if (!role) delete metadata.role

  await customerService.updateCustomers({ id, metadata })

  return res.json({
    customer_id: id,
    role: role || "customer",
    message: `Role updated to "${role || "customer"}".`,
  })
}
