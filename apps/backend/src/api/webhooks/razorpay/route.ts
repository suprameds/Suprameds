import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Razorpay Webhook Handler
 * - payment.captured
 * - payment.failed
 * - refund.processed
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger")
  logger.info("[webhook] Razorpay received")
  
  // TODO: Verify signature and process event
  
  res.status(200).send("OK")
}
