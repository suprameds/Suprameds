import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getVerifyToken, isWhatsAppConfigured, markMessageRead } from "../../../lib/whatsapp"

const LOG = "[webhook:whatsapp]"

// ── Types for Meta webhook payloads ──────────────────────────────────────────

type WhatsAppStatusUpdate = {
  id: string
  status: "sent" | "delivered" | "read" | "failed"
  timestamp: string
  recipient_id: string
  errors?: Array<{ code: number; title: string }>
}

type WhatsAppMessage = {
  from: string
  id: string
  timestamp: string
  type: string
  text?: { body: string }
  image?: { id: string; mime_type: string; caption?: string }
  document?: { id: string; mime_type: string; filename?: string }
}

type WhatsAppChange = {
  value: {
    messaging_product: string
    metadata: { display_phone_number: string; phone_number_id: string }
    contacts?: Array<{ profile: { name: string }; wa_id: string }>
    messages?: WhatsAppMessage[]
    statuses?: WhatsAppStatusUpdate[]
  }
  field: string
}

type WhatsAppWebhookBody = {
  object: string
  entry?: Array<{
    id: string
    changes: WhatsAppChange[]
  }>
}

// ── GET: Meta webhook verification ───────────────────────────────────────────

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const mode = req.query["hub.mode"] as string | undefined
  const token = req.query["hub.verify_token"] as string | undefined
  const challenge = req.query["hub.challenge"] as string | undefined

  if (mode === "subscribe" && token === getVerifyToken()) {
    console.info(`${LOG} Webhook verified`)
    res.status(200).send(challenge ?? "OK")
    return
  }

  console.warn(`${LOG} Verification failed — token mismatch or missing mode`)
  res.status(403).send("Forbidden")
}

// ── POST: Incoming messages & status updates ─────────────────────────────────

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as {
    info: (msg: string) => void
    warn: (msg: string) => void
    error: (msg: string) => void
  }

  // Always respond 200 quickly — Meta retries on non-2xx
  res.status(200).send("OK")

  if (!isWhatsAppConfigured()) {
    logger.warn(`${LOG} WhatsApp not configured, ignoring webhook`)
    return
  }

  try {
    const body = req.body as WhatsAppWebhookBody

    if (body.object !== "whatsapp_business_account") {
      logger.warn(`${LOG} Unexpected object type: ${body.object}`)
      return
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes) {
        if (change.field !== "messages") continue

        const value = change.value

        // ── Handle incoming messages ─────────────────────────────────
        for (const msg of value.messages ?? []) {
          const senderName =
            value.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name ?? "Unknown"

          logger.info(
            `${LOG} Incoming ${msg.type} from ${msg.from} (${senderName}): ` +
              `${msg.text?.body?.slice(0, 100) ?? msg.type}`
          )

          // Auto-read incoming messages
          markMessageRead(msg.id).catch(() => {})

          // Future: handle document/image uploads as prescription submissions
          if (msg.type === "image" || msg.type === "document") {
            logger.info(
              `${LOG} Media received from ${msg.from} — type=${msg.type}, ` +
                `mime=${msg.image?.mime_type ?? msg.document?.mime_type}`
            )
          }
        }

        // ── Handle outbound status updates ───────────────────────────
        for (const status of value.statuses ?? []) {
          logger.info(
            `${LOG} Status update: msg=${status.id} → ${status.status} ` +
              `(recipient=${status.recipient_id})`
          )

          if (status.status === "failed" && status.errors?.length) {
            logger.warn(
              `${LOG} Delivery failure for ${status.recipient_id}: ` +
                status.errors.map((e) => `${e.code} ${e.title}`).join(", ")
            )
          }
        }
      }
    }
  } catch (err) {
    logger.error(`${LOG} Error processing webhook: ${(err as Error).message}`)
  }
}
