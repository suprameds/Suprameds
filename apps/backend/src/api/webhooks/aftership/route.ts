import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * AfterShip Webhook Handler
 * Transforms status (in_transit, out_for_delivery, delivered, rto)
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger")
  logger.info("[webhook] AfterShip received")
  
  // TODO: Verify signature and update shipment status
  
  res.status(200).send("OK")
}
