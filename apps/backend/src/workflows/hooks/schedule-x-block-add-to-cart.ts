import { addToCartWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { PHARMA_MODULE } from "../../modules/pharma"

/**
 * Schedule X block — add-to-cart (stateless).
 *
 * Prevents Schedule X and narcotic products from ever being added to the cart.
 * NDPS Act, 1985: absolute prohibition on online sale of Schedule X / narcotic substances.
 *
 * Enforced at add-to-cart so the cart never contains prohibited items; completeCart
 * hook provides a second layer of defense.
 */
addToCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  const items = input?.items ?? []
  if (items.length === 0) return

  const variantIds = items
    .map((i: { variant_id?: string }) => i.variant_id)
    .filter((v): v is string => Boolean(v))
  if (variantIds.length === 0) return

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const pharmaService = container.resolve(PHARMA_MODULE) as any

  // Resolve variant_id → product_id via query
  const { data: variants } = await query.graph({
    entity: "variants",
    fields: ["id", "product_id"],
    filters: { id: variantIds },
  })

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
})
