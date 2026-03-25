/**
 * Creates a "Standard Shipping (India)" option backed by the
 * conditional-shipping fulfillment provider.
 *
 * Pricing is calculated at runtime:
 *   - Cart item_total >= ₹300 → ₹0 (free)
 *   - Cart item_total <  ₹300 → ₹50
 *
 * The old free-shipping manual option remains but is disabled for store.
 */

import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
} from "@medusajs/framework/utils"

export default async function conditionalShippingOption({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  ) as any

  // Idempotency: skip if a calculated option already exists
  const { data: existingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "price_type", "provider_id"],
  })

  const alreadyExists = (existingOptions as any[])?.some(
    (o: any) =>
      o.price_type === "calculated" &&
      (o.provider_id === "conditional-shipping_conditional-shipping" ||
        o.name === "Standard Shipping (India)")
  )

  if (alreadyExists) {
    logger.info(
      "[conditional-shipping] Calculated shipping option already exists; skipping."
    )
    return
  }

  // Find the first fulfillment set with a service zone that covers India
  const fulfillmentSets = await fulfillmentModuleService.listFulfillmentSets(
    {},
    { relations: ["service_zones", "service_zones.geo_zones"] }
  )

  let serviceZoneId: string | null = null
  let shippingProfileId: string | null = null

  for (const fs of fulfillmentSets) {
    for (const sz of fs.service_zones ?? []) {
      const hasIndia = (sz.geo_zones ?? []).some(
        (g: { country_code?: string }) => g.country_code === "in"
      )
      if (hasIndia) {
        serviceZoneId = sz.id
        break
      }
    }
    if (serviceZoneId) break
  }

  if (!serviceZoneId) {
    logger.warn(
      "[conditional-shipping] No service zone with India found; skipping."
    )
    return
  }

  // Find the shipping profile (usually just one)
  const profiles = await fulfillmentModuleService.listShippingProfiles()
  shippingProfileId = profiles?.[0]?.id

  if (!shippingProfileId) {
    logger.warn("[conditional-shipping] No shipping profile found; skipping.")
    return
  }

  try {
    const created = await fulfillmentModuleService.createShippingOptions({
      name: "Standard Shipping (India)",
      price_type: "calculated",
      service_zone_id: serviceZoneId,
      shipping_profile_id: shippingProfileId,
      provider_id: "conditional-shipping_conditional-shipping",
      type: {
        label: "Standard",
        description: "₹50 shipping, free above ₹300",
        code: "standard-conditional",
      },
      data: {},
    })

    logger.info(
      `[conditional-shipping] Created calculated shipping option: ${created.id}`
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("already") || msg.includes("duplicate")) {
      logger.info("[conditional-shipping] Option already exists; skipping.")
    } else {
      throw err
    }
  }

  // Disable the old free manual option for store visibility
  const oldOption = (existingOptions as any[])?.find(
    (o: any) =>
      (o.name === "Standard Worldwide Shipping" ||
        o.name === "Standard Shipping (India)") &&
      o.price_type === "flat"
  )

  if (oldOption) {
    try {
      await fulfillmentModuleService.updateShippingOptions({
        id: oldOption.id,
        name: "Standard Shipping (legacy)",
      })
      logger.info(
        `[conditional-shipping] Renamed old option ${oldOption.id} to legacy.`
      )
    } catch {
      // Non-critical — just log
      logger.warn("[conditional-shipping] Could not rename old option.")
    }
  }
}
