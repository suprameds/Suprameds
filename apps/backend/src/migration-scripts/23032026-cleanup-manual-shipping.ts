/**
 * Removes the old "Standard Worldwide Shipping" flat-rate manual option
 * so that only the calculated conditional-shipping option remains.
 *
 * Root cause: The initial seed created a shipping option with
 * provider_id "manual_manual". On Medusa Cloud, the manual fulfillment
 * provider fails to resolve (`Could not resolve 'fp_manual_manual'`),
 * causing a 500 when the storefront adds a shipping method to the cart.
 *
 * This migration deletes any non-conditional shipping options, leaving
 * only the "Standard Shipping (India)" conditional option.
 */

import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
} from "@medusajs/framework/utils"

export default async function cleanupManualShipping({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  ) as any

  const { data: existingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "price_type", "provider_id"],
  })

  const options = existingOptions as any[]
  if (!options?.length) {
    logger.info("[cleanup-manual-shipping] No shipping options found; nothing to do.")
    return
  }

  // Find manual/legacy options that are NOT the conditional-shipping provider
  const manualOptions = options.filter(
    (o: any) =>
      o.provider_id !== "conditional-shipping_conditional-shipping"
  )

  if (manualOptions.length === 0) {
    logger.info("[cleanup-manual-shipping] No manual/legacy shipping options found; skipping.")
    return
  }

  // Verify the conditional option exists before deleting manual ones
  const conditionalExists = options.some(
    (o: any) => o.provider_id === "conditional-shipping_conditional-shipping"
  )

  if (!conditionalExists) {
    logger.warn(
      "[cleanup-manual-shipping] Conditional shipping option not found — skipping cleanup " +
      "to avoid leaving the store with no shipping options."
    )
    return
  }

  for (const opt of manualOptions) {
    try {
      await fulfillmentModuleService.deleteShippingOptions(opt.id)
      logger.info(
        `[cleanup-manual-shipping] Deleted: "${opt.name}" (${opt.id}, provider=${opt.provider_id})`
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.warn(
        `[cleanup-manual-shipping] Could not delete option ${opt.id}: ${msg}`
      )
    }
  }

  logger.info("[cleanup-manual-shipping] Done.")
}
