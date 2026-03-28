import { createLogger } from "./logger"

const logger = createLogger("lib:whatsapp")

/**
 * WhatsApp Business API client — Meta Cloud API integration.
 *
 * Uses pre-approved message templates for transactional notifications
 * (order updates, Rx status, payment confirmations) which are the primary
 * messaging channel for Indian customers.
 *
 * Env vars:
 *   WHATSAPP_PHONE_NUMBER_ID  — Business phone number ID from Meta dashboard
 *   WHATSAPP_ACCESS_TOKEN     — Permanent or system-user token
 *   WHATSAPP_VERIFY_TOKEN     — Webhook verification token (chosen by us)
 */

const GRAPH_API_VERSION = "v18.0"
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`

// Rate limit: Meta allows 80 msg/s for verified businesses; we track locally
let _lastSendTs = 0
const MIN_SEND_INTERVAL_MS = 13 // ~77 msg/s ceiling to stay safely under 80

// ── Env helpers ──────────────────────────────────────────────────────────────

function getPhoneNumberId(): string {
  return process.env.WHATSAPP_PHONE_NUMBER_ID ?? ""
}

function getAccessToken(): string {
  return process.env.WHATSAPP_ACCESS_TOKEN ?? ""
}

export function getVerifyToken(): string {
  return process.env.WHATSAPP_VERIFY_TOKEN ?? ""
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(getPhoneNumberId() && getAccessToken())
}

// ── Phone formatting ─────────────────────────────────────────────────────────

/**
 * Normalise an Indian phone number to E.164 format (e.g. "919876543210").
 * Strips spaces, dashes, leading +, and prepends 91 if needed.
 */
export function toE164(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]+/g, "")
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1)

  // Already has country code
  if (cleaned.startsWith("91") && cleaned.length === 12) return cleaned

  // 10-digit Indian mobile
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) return `91${cleaned}`

  // 0-prefixed landline/mobile
  if (cleaned.startsWith("0") && cleaned.length === 11) return `91${cleaned.slice(1)}`

  return cleaned
}

// ── Template names ───────────────────────────────────────────────────────────

export const TEMPLATES = {
  ORDER_CONFIRMATION: "order_confirmation",
  ORDER_SHIPPED: "order_shipped",
  ORDER_DELIVERED: "order_delivered",
  PRESCRIPTION_APPROVED: "prescription_approved",
  PRESCRIPTION_REJECTED: "prescription_rejected",
  PAYMENT_RECEIVED: "payment_received",
  REFUND_PROCESSED: "refund_processed",
} as const

export type TemplateName = (typeof TEMPLATES)[keyof typeof TEMPLATES]

// ── Types ────────────────────────────────────────────────────────────────────

export type TemplateParameter = {
  type: "text"
  text: string
}

export type TemplateComponent = {
  type: "body" | "header" | "button"
  sub_type?: string
  index?: number
  parameters: TemplateParameter[]
}

type SendResult = {
  ok: boolean
  messageId?: string
  error?: string
}

// ── Rate-limit throttle ──────────────────────────────────────────────────────

async function throttle(): Promise<void> {
  const now = Date.now()
  const elapsed = now - _lastSendTs
  if (elapsed < MIN_SEND_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_SEND_INTERVAL_MS - elapsed))
  }
  _lastSendTs = Date.now()
}

// ── Core send function ───────────────────────────────────────────────────────

async function postMessage(body: Record<string, unknown>): Promise<SendResult> {
  if (!isWhatsAppConfigured()) {
    return { ok: false, error: "whatsapp_not_configured" }
  }

  await throttle()

  const url = `${BASE_URL}/${getPhoneNumberId()}/messages`

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const json = (await res.json()) as {
      messages?: Array<{ id: string }>
      error?: { message: string; code: number }
    }

    if (!res.ok || json.error) {
      const errMsg = json.error?.message ?? `HTTP ${res.status}`
      logger.warn(`Send failed: ${errMsg}`, JSON.stringify(json))
      return { ok: false, error: errMsg }
    }

    const messageId = json.messages?.[0]?.id
    logger.info(`Message sent — id=${messageId}`)
    return { ok: true, messageId }
  } catch (err) {
    const errMsg = (err as Error).message
    logger.error(`Network error: ${errMsg}`)
    return { ok: false, error: errMsg }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a pre-approved template message (works outside the 24h window).
 * `parameters` are positional body-component params — e.g. [{ type: "text", text: "ORD-123" }].
 */
export async function sendTemplateMessage(
  to: string,
  templateName: TemplateName | string,
  parameters: TemplateParameter[],
  languageCode = "en"
): Promise<SendResult> {
  const recipient = toE164(to)

  const components: TemplateComponent[] =
    parameters.length > 0
      ? [{ type: "body", parameters }]
      : []

  return postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components.length > 0 && { components }),
    },
  })
}

/**
 * Send a free-form text message (only works within the 24h conversation window).
 */
export async function sendTextMessage(
  to: string,
  text: string
): Promise<SendResult> {
  const recipient = toE164(to)

  return postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "text",
    text: { preview_url: false, body: text },
  })
}

/**
 * Mark an incoming message as "read" (blue ticks).
 */
export async function markMessageRead(messageId: string): Promise<void> {
  if (!isWhatsAppConfigured()) return

  const url = `${BASE_URL}/${getPhoneNumberId()}/messages`

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    })
  } catch {
    // Best-effort — don't throw on read-receipt failures
  }
}
