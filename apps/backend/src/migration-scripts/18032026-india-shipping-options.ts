/**
 * Adds India (country code "in") to the default fulfillment service zone and
 * adds an INR price to the default shipping option so that storefront
 * checkout shows delivery choices for Indian addresses.
 *
 * Root cause: Initial seed (25022026) only created geo_zones for US + EU and
 * shipping option prices for USD/EUR. Carts with shipping_address.country_code
 * "in" matched no service zone, so listCartOptions returned empty.
 */

import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
} from "@medusajs/framework/utils"

export default async function india_shipping_options({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  )
  const pricingModuleService = container.resolve(
    ModuleRegistrationName.PRICING
  )

  // --- 1. Add India to the default fulfillment set's service zone ---
  const fulfillmentSets = await fulfillmentModuleService.listFulfillmentSets(
    {},
    { relations: ["service_zones", "service_zones.geo_zones"] }
  )

  const fulfillmentSet = fulfillmentSets[0]
  if (!fulfillmentSet?.service_zones?.length) {
    logger.warn(
      "[india-shipping] No fulfillment set or service zones found; skipping."
    )
    return
  }

  const serviceZone = fulfillmentSet.service_zones[0]
  const existingGeoZones = serviceZone.geo_zones ?? []
  const hasIndia = existingGeoZones.some(
    (g: { country_code?: string }) => g.country_code === "in"
  )

  if (!hasIndia) {
    const newGeoZones = [
      ...existingGeoZones.map((g: { id: string; country_code: string; type: string }) => ({
        id: g.id,
        country_code: g.country_code,
        type: g.type,
      })),
      { country_code: "in" as const, type: "country" as const },
    ]
    await (fulfillmentModuleService as any).updateServiceZones({
      id: serviceZone.id,
      geo_zones: newGeoZones,
    })
    logger.info(
      `[india-shipping] Added India (in) to service zone ${serviceZone.id}`
    )
  } else {
    logger.info("[india-shipping] India already in service zone; skipping.")
  }

  // --- 2. Add INR price to the default shipping option's price set ---
  const { data: shippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name"],
  })
  const { data: optionPriceSetLinks } = await query.graph({
    entity: "shipping_option_price_set",
    fields: ["shipping_option_id", "price_set_id"],
  })

  const options = (shippingOptions as { id: string; name: string }[]) ?? []
  const links = (optionPriceSetLinks as { shipping_option_id: string; price_set_id: string }[]) ?? []
  const linkByOptionId = new Map(links.map((l) => [l.shipping_option_id, l.price_set_id]))

  const defaultOption = options.find((o) => o.name === "Standard Worldwide Shipping") ?? options[0]
  const price_set_id = defaultOption ? linkByOptionId.get(defaultOption.id) : undefined

  if (!defaultOption || !price_set_id) {
    logger.warn(
      "[india-shipping] No shipping option with price_set_id found; skipping INR price."
    )
    return
  }

  try {
    await pricingModuleService.addPrices({
      priceSetId: price_set_id,
      prices: [
        {
          amount: 0,
          currency_code: "inr",
        },
      ],
    })
    logger.info(
      `[india-shipping] Added INR price (₹0) to shipping option ${defaultOption.id}`
    )
  } catch (err: unknown) {
    // Duplicate currency or already exists — ignore
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes("inr") || msg.toLowerCase().includes("already") || msg.toLowerCase().includes("duplicate")) {
      logger.info("[india-shipping] INR price already present; skipping.")
    } else {
      throw err
    }
  }
}
