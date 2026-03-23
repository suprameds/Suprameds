import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ModuleRegistrationName } from "@medusajs/framework/utils"

/**
 * Auto-assigns the default shipping profile to newly created products.
 *
 * Without this, products added via Admin UI or CSV import will lack a
 * shipping_profile_id, causing "cart items require shipping profiles that
 * are not satisfied by the current shipping methods" at checkout.
 */
export default async function handler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const productId = event.data?.id
  if (!productId) return

  const productModuleService = container.resolve(
    ModuleRegistrationName.PRODUCT
  ) as any
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  ) as any

  try {
    const product = await productModuleService.retrieveProduct(productId, {
      select: ["id", "shipping_profile_id"],
    })

    if (product.shipping_profile_id) return

    const profiles = await fulfillmentModuleService.listShippingProfiles({
      type: "default",
    })
    const defaultProfile = profiles?.[0]
    if (!defaultProfile) return

    await productModuleService.updateProducts(productId, {
      shipping_profile_id: defaultProfile.id,
    })

    console.info(
      `[product-shipping-profile] Assigned profile ${defaultProfile.id} to product ${productId}`
    )
  } catch (err) {
    console.error(
      `[product-shipping-profile] Failed to assign profile to ${productId}:`,
      err
    )
  }
}

export const config: SubscriberConfig = { event: "product.created" }
