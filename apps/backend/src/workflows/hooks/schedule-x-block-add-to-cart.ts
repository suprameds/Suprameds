import { addToCartWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { PHARMA_MODULE } from "../../modules/pharma"
import { checkInteractions } from "../../utils/drug-interactions"

/**
 * Unified add-to-cart validation hook.
 *
 * 1. Schedule X block — NDPS Act, 1985: absolute prohibition on online sale
 * 2. Cold chain block — no refrigeration in our delivery network
 * 3. Drug interaction warnings — non-blocking, attached to cart metadata
 */
addToCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
  const items = input?.items ?? []
  if (items.length === 0) return

  const variantIds = items
    .map((i: { variant_id?: string }) => i.variant_id)
    .filter((v): v is string => Boolean(v))
  if (variantIds.length === 0) return

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const pharmaService = container.resolve(PHARMA_MODULE) as any

  const { data: variants } = await query.graph({
    entity: "variants",
    fields: ["id", "product_id"],
    filters: { id: variantIds },
  })

  // ── Schedule X & Cold Chain Block ─────────────────────────────────
  for (const item of items) {
    const variant = (variants as { id: string; product_id?: string }[])?.find(
      (v) => v.id === item.variant_id
    )
    const productId = variant?.product_id
    if (!productId) continue

    let drugProducts: any[]
    try {
      drugProducts = await pharmaService.listDrugProducts({
        product_id: productId,
      })
    } catch {
      continue
    }

    if (!drugProducts?.length) continue
    const drug = drugProducts[0]

    if (drug.schedule === "X" || drug.is_narcotic) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This product cannot be sold online. NDPS Act, 1985 prohibits online sale of Schedule X / narcotic substances."
      )
    }

    if (drug.requires_refrigeration) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This product requires cold chain storage which is not available through our delivery network."
      )
    }
  }

  // ── Drug Interaction Warnings (non-blocking) ──────────────────────
  try {
    const cartId = (input as any)?.cart_id
    if (!cartId) return

    const { data: carts } = await query.graph({
      entity: "cart",
      fields: ["id", "items.variant.product_id"],
      filters: { id: cartId },
    })

    const cartData = (carts as any[])?.[0]
    if (!cartData?.items?.length) return

    const productIds = cartData.items
      .map((item: any) => item.variant?.product_id)
      .filter((id: unknown): id is string => Boolean(id))

    const uniqueProductIds = [...new Set(productIds)]
    if (uniqueProductIds.length < 2) return

    const { data: drugProducts } = await query.graph({
      entity: "drug_product",
      fields: ["product_id", "composition"],
      filters: { product_id: uniqueProductIds },
    })

    const compositions = (drugProducts as any[])
      .filter((dp) => dp.composition)
      .map((dp) => dp.composition as string)

    if (compositions.length < 2) return

    const warnings = checkInteractions(compositions)
    if (warnings.length === 0) return

    const cartService = container.resolve(Modules.CART) as any
    await cartService.updateCarts(cartId, {
      metadata: {
        drug_interactions: warnings,
        has_major_interaction: warnings.some((w) => w.severity === "major"),
      },
    })

    const majorCount = warnings.filter((w) => w.severity === "major").length
    if (majorCount > 0) {
      logger.warn(
        `[drug-interactions] Cart ${cartId} has ${majorCount} MAJOR interaction(s)`
      )
    }
  } catch (error) {
    logger.error(
      `[drug-interactions] Failed to check interactions: ${(error as Error).message}`
    )
  }
})
