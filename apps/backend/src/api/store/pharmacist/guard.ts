import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { createLogger } from "../../../lib/logger"

const logger = createLogger("store:pharmacist:guard")

/**
 * Middleware that verifies the authenticated customer has `metadata.role === "pharmacist"`.
 * Must run after Medusa's `authenticate("customer", ...)` middleware.
 */
export function requirePharmacistRole() {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const customerId = (req as any).auth_context?.actor_id
    if (!customerId) {
      return res.status(401).json({ message: "Authentication required." })
    }

    try {
      const customerService = req.scope.resolve(Modules.CUSTOMER) as any
      const customer = await customerService.retrieveCustomer(customerId)

      if (customer?.metadata?.role !== "pharmacist") {
        return res.status(403).json({ message: "Pharmacist access required." })
      }

      // Attach customer to request for downstream handlers
      ;(req as any).pharmacist_customer = customer
      next()
    } catch (err) {
      logger.error(`Pharmacist guard failed: ${(err as Error).message}`)
      return res.status(403).json({ message: "Access denied." })
    }
  }
}
