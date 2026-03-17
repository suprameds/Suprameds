import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Stripe Webhook Handler (Backup Gateway)
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger")
  logger.info("[webhook] Stripe received")
  
  // TODO: Verify signature and process event
  
  res.status(200).send("OK")
}
