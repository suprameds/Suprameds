import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { CRM_MODULE } from "../../../modules/crm"

/**
 * GET /store/reminders
 *
 * Lists all refill reminders for the authenticated customer
 * (both auto-detected chronic patterns and manually created ones).
 * Enriches each with product/variant info for storefront display.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ error: "Authentication required" })
  }

  const crmService = req.scope.resolve(CRM_MODULE) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any

  const patterns = await crmService.listChronicReorderPatterns(
    { customer_id: customerId },
    { order: { next_expected_at: "ASC" }, take: 50 }
  )

  if (!patterns.length) {
    return res.json({ reminders: [], count: 0 })
  }

  const variantIds = [...new Set(patterns.map((p: any) => p.variant_id))]
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "title",
      "product_id",
      "product.title",
      "product.handle",
      "product.thumbnail",
    ],
    filters: { id: variantIds },
  })

  const variantMap = new Map<string, any>()
  for (const v of variants ?? []) {
    variantMap.set(v.id, v)
  }

  const reminders = patterns.map((p: any) => {
    const variant = variantMap.get(p.variant_id)
    return {
      id: p.id,
      variant_id: p.variant_id,
      product_title: variant?.product?.title ?? "Unknown medicine",
      variant_title: variant?.title ?? null,
      product_handle: variant?.product?.handle ?? null,
      thumbnail: variant?.product?.thumbnail ?? null,
      frequency_days: p.average_days_between_orders,
      next_expected_at: p.next_expected_at,
      last_purchased_at: p.last_purchased_at,
      reminder_sent_at: p.reminder_sent_at,
      confidence_score: p.confidence_score,
      is_active: p.is_active,
      is_manual: p.confidence_score === 100,
    }
  })

  return res.json({ reminders, count: reminders.length })
}

/**
 * POST /store/reminders
 *
 * Creates a manual refill reminder. Expects:
 * { variant_id: string, frequency_days: number }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ error: "Authentication required" })
  }

  const { variant_id, frequency_days } = req.body as {
    variant_id?: string
    frequency_days?: number
  }

  if (!variant_id) {
    return res.status(400).json({ error: "variant_id is required" })
  }
  if (!frequency_days || frequency_days < 1 || frequency_days > 365) {
    return res
      .status(400)
      .json({ error: "frequency_days must be between 1 and 365" })
  }

  const crmService = req.scope.resolve(CRM_MODULE) as any

  // Check for existing reminder on same variant
  const [existing] = await crmService.listChronicReorderPatterns(
    { customer_id: customerId, variant_id },
    { take: 1 }
  )

  if (existing) {
    // Reactivate / update existing pattern
    const nextExpected = new Date(
      Date.now() + frequency_days * 24 * 60 * 60 * 1000
    )
    await crmService.updateChronicReorderPatterns(existing.id, {
      average_days_between_orders: frequency_days,
      next_expected_at: nextExpected,
      is_active: true,
      confidence_score: 100,
    })
    return res.json({
      reminder: { ...existing, average_days_between_orders: frequency_days, next_expected_at: nextExpected, is_active: true },
      updated: true,
    })
  }

  const now = new Date()
  const nextExpected = new Date(
    now.getTime() + frequency_days * 24 * 60 * 60 * 1000
  )

  const pattern = await crmService.createChronicReorderPatterns({
    customer_id: customerId,
    variant_id,
    average_days_between_orders: frequency_days,
    last_purchased_at: now,
    next_expected_at: nextExpected,
    confidence_score: 100,
    is_active: true,
    detected_at: now,
  })

  return res.status(201).json({ reminder: pattern })
}
