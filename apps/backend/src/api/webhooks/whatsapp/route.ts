import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * WhatsApp (Meta) Webhook Handler
 * 2-way chat tracking or document submission via WA
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger")
  logger.info("[webhook] WhatsApp received")
  
  // TODO: Verify signature, parse message (Rx upload shortcut etc.)
  
  res.status(200).send("OK")
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  // Verification challenge for Meta
  res.status(200).send(req.query["hub.challenge"] || "OK")
}
