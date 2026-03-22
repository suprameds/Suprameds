import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../modules/prescription"
import {
  sendTemplateMessage,
  isWhatsAppConfigured,
  TEMPLATES,
  type TemplateParameter,
} from "../lib/whatsapp"

const LOG = "[subscriber:whatsapp-order-updates]"

/**
 * Unified WhatsApp notification subscriber.
 *
 * Listens to key order/prescription lifecycle events and sends the
 * appropriate pre-approved template message via WhatsApp Business API.
 * Falls back silently when WhatsApp is not configured (env vars missing)
 * so it never blocks the primary order flow.
 */

type EventData = {
  id?: string
  order_id?: string
}

// ── Helper: resolve customer phone from an order ─────────────────────────────

async function getOrderPhone(
  container: SubscriberArgs<EventData>["container"],
  orderId: string
): Promise<{ phone: string | null; displayId: string }> {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: rows } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "shipping_address.phone",
        "customer.phone",
        "customer.metadata",
      ],
      filters: { id: orderId },
    })

    const order = (rows as any)?.[0]
    const phone =
      order?.shipping_address?.phone ??
      order?.customer?.phone ??
      order?.customer?.metadata?.whatsapp_phone ??
      null

    return {
      phone,
      displayId: order?.display_id ? `#${order.display_id}` : orderId.slice(-8),
    }
  } catch {
    return { phone: null, displayId: orderId.slice(-8) }
  }
}

// ── Helper: resolve customer phone from a prescription ───────────────────────

async function getPrescriptionPhone(
  container: SubscriberArgs<EventData>["container"],
  prescriptionId: string
): Promise<{ phone: string | null; customerName: string }> {
  try {
    const prescriptionModule: any = container.resolve(PRESCRIPTION_MODULE)
    const [rx] = await prescriptionModule.listPrescriptions({ id: prescriptionId })

    const phone = rx?.guest_phone ?? null
    const customerName = rx?.customer_name ?? "Customer"

    // If no guest_phone, try to get phone from the linked customer
    if (!phone && rx?.customer_id) {
      const customerService = container.resolve(Modules.CUSTOMER) as any
      const customer = await customerService.retrieveCustomer(rx.customer_id)
      return { phone: customer?.phone ?? null, customerName: customer?.first_name ?? "Customer" }
    }

    return { phone, customerName }
  } catch {
    return { phone: null, customerName: "Customer" }
  }
}

// ── Helper: safe send with logging ───────────────────────────────────────────

async function safeSend(
  to: string,
  templateName: string,
  params: TemplateParameter[],
  eventLabel: string
): Promise<void> {
  try {
    const result = await sendTemplateMessage(to, templateName, params)
    if (result.ok) {
      console.info(`${LOG} [${eventLabel}] WhatsApp sent to ${to.slice(-4)}***`)
    } else {
      console.warn(`${LOG} [${eventLabel}] WhatsApp failed: ${result.error}`)
    }
  } catch (err) {
    console.warn(`${LOG} [${eventLabel}] WhatsApp error: ${(err as Error).message}`)
  }
}

// ── Param builder shorthand ──────────────────────────────────────────────────

const textParam = (text: string): TemplateParameter => ({ type: "text", text })

// ── Event handlers ───────────────────────────────────────────────────────────

export default async function whatsappOrderUpdatesHandler({
  event: { name, data },
  container,
}: SubscriberArgs<EventData>) {
  if (!isWhatsAppConfigured()) return

  const logger = container.resolve("logger") as {
    info: (msg: string) => void
    warn: (msg: string) => void
  }

  try {
    switch (name) {
      // ── Order placed ───────────────────────────────────────────────
      case "order.placed": {
        const orderId = data.id
        if (!orderId) break

        const { phone, displayId } = await getOrderPhone(container, orderId)
        if (!phone) {
          logger.info(`${LOG} No phone for order ${orderId}, skipping WA`)
          break
        }

        await safeSend(
          phone,
          TEMPLATES.ORDER_CONFIRMATION,
          [textParam(displayId)],
          "order.placed"
        )
        break
      }

      // ── Order dispatched / shipped ─────────────────────────────────
      case "order.dispatched": {
        const orderId = data.order_id ?? data.id
        if (!orderId) break

        const { phone, displayId } = await getOrderPhone(container, orderId)
        if (!phone) break

        await safeSend(
          phone,
          TEMPLATES.ORDER_SHIPPED,
          [textParam(displayId)],
          "order.dispatched"
        )
        break
      }

      // ── Order delivered ────────────────────────────────────────────
      case "order.delivered": {
        const orderId = data.order_id ?? data.id
        if (!orderId) break

        const { phone, displayId } = await getOrderPhone(container, orderId)
        if (!phone) break

        await safeSend(
          phone,
          TEMPLATES.ORDER_DELIVERED,
          [textParam(displayId)],
          "order.delivered"
        )
        break
      }

      // ── Prescription approved ──────────────────────────────────────
      case "prescription.fully-approved":
      case "prescription.approved": {
        const rxId = data.id
        if (!rxId) break

        const { phone, customerName } = await getPrescriptionPhone(container, rxId)
        if (!phone) break

        await safeSend(
          phone,
          TEMPLATES.PRESCRIPTION_APPROVED,
          [textParam(customerName)],
          "prescription.approved"
        )
        break
      }

      // ── Prescription rejected ──────────────────────────────────────
      case "prescription.rejected": {
        const rxId = data.id
        if (!rxId) break

        const { phone, customerName } = await getPrescriptionPhone(container, rxId)
        if (!phone) break

        await safeSend(
          phone,
          TEMPLATES.PRESCRIPTION_REJECTED,
          [textParam(customerName)],
          "prescription.rejected"
        )
        break
      }

      default:
        logger.warn(`${LOG} Unhandled event: ${name}`)
    }
  } catch (err) {
    // Never break order flow due to WhatsApp failures
    console.error(`${LOG} Unhandled error for ${name}: ${(err as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: [
    "order.placed",
    "order.dispatched",
    "order.delivered",
    "prescription.fully-approved",
    "prescription.approved",
    "prescription.rejected",
  ],
}
