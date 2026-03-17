import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * MSG91 Webhook Handler
 * Callback for SMS delivery status / NDR updates
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger")
  logger.info("[webhook] MSG91 received")
  
  // TODO: Update delivery bounds/logs
  
  res.status(200).send("OK")
}
