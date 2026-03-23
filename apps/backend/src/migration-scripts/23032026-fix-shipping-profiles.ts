/**
 * Ensures every product has a shipping_profile_id and the conditional-shipping
 * option exists for India.
 *
 * Root cause: products created via Admin UI or CSV import don't automatically
 * receive a shipping_profile_id. Medusa then cannot match them to any shipping
 * option, producing "cart items require shipping profiles that are not satisfied
 * by the current shipping methods."
 *
 * This script:
 *   1. Gets (or creates) the default shipping profile
 *   2. Assigns it to every product that lacks one
 *   3. Ensures India is in the service zone
 *   4. Ensures the conditional-shipping option exists (₹50 / free above ₹300)
 *   5. Ensures stock-location ↔ fulfillment-provider link exists for the
 *      conditional-shipping provider
 */

import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
} from "@medusajs/framework/utils"
import {
  createShippingProfilesWorkflow,
} from "@medusajs/medusa/core-flows"

export default async function fixShippingProfiles({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  ) as any
  const productModuleService = container.resolve(
    ModuleRegistrationName.PRODUCT
  ) as any

  // ── 1. Default shipping profile ──────────────────────────────────────
  let profiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  let shippingProfile = profiles?.[0]

  if (!shippingProfile) {
    logger.info("[fix-shipping] No default shipping profile — creating one.")
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: {
        data: [{ name: "Default Shipping Profile", type: "default" }],
      },
    })
    shippingProfile = result[0]
  }

  logger.info(
    `[fix-shipping] Using shipping profile: ${shippingProfile.id} (${shippingProfile.name})`
  )

  // ── 2. Assign profile to every product missing one ───────────────────
  const allProducts = await productModuleService.listProducts(
    {},
    { select: ["id", "title", "shipping_profile_id"] }
  )

  const orphans = (allProducts as any[]).filter(
    (p) => !p.shipping_profile_id
  )

  if (orphans.length > 0) {
    logger.info(
      `[fix-shipping] ${orphans.length} product(s) missing shipping_profile_id — assigning default.`
    )
    for (const product of orphans) {
      try {
        await productModuleService.updateProducts(product.id, {
          shipping_profile_id: shippingProfile.id,
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.warn(
          `[fix-shipping] Could not update product ${product.id} (${product.title}): ${msg}`
        )
      }
    }
    logger.info("[fix-shipping] All orphan products assigned.")
  } else {
    logger.info("[fix-shipping] All products already have a shipping profile.")
  }

  // ── 3. Ensure India is in the service zone ───────────────────────────
  const fulfillmentSets = await fulfillmentModuleService.listFulfillmentSets(
    {},
    { relations: ["service_zones", "service_zones.geo_zones"] }
  )

  let serviceZoneId: string | null = null

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

  if (!serviceZoneId && fulfillmentSets.length > 0) {
    const fs = fulfillmentSets[0]
    const sz = fs.service_zones?.[0]
    if (sz) {
      const existingGeoZones = (sz.geo_zones ?? []).map(
        (g: { id: string; country_code: string; type: string }) => ({
          id: g.id,
          country_code: g.country_code,
          type: g.type,
        })
      )
      await fulfillmentModuleService.updateServiceZones({
        id: sz.id,
        geo_zones: [
          ...existingGeoZones,
          { country_code: "in", type: "country" },
        ],
      })
      serviceZoneId = sz.id
      logger.info(`[fix-shipping] Added India to service zone ${sz.id}`)
    }
  }

  if (!serviceZoneId) {
    logger.warn(
      "[fix-shipping] No fulfillment set / service zone found at all. " +
        "Run the initial seed first."
    )
    return
  }

  // ── 4. Ensure the conditional-shipping option exists ─────────────────
  const { data: existingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "price_type", "provider_id"],
  })

  const conditionalExists = (existingOptions as any[])?.some(
    (o: any) =>
      o.price_type === "calculated" &&
      o.provider_id === "conditional-shipping_conditional-shipping"
  )

  if (!conditionalExists) {
    try {
      const created = await fulfillmentModuleService.createShippingOptions({
        name: "Standard Shipping (India)",
        price_type: "calculated",
        service_zone_id: serviceZoneId,
        shipping_profile_id: shippingProfile.id,
        provider_id: "conditional-shipping_conditional-shipping",
        type: {
          label: "Standard",
          description: "₹50 shipping, free above ₹300",
          code: "standard-conditional",
        },
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
        data: {},
      })
      logger.info(
        `[fix-shipping] Created conditional shipping option: ${created.id}`
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (
        msg.includes("already") ||
        msg.includes("duplicate")
      ) {
        logger.info("[fix-shipping] Conditional option already exists.")
      } else {
        throw err
      }
    }
  } else {
    logger.info("[fix-shipping] Conditional shipping option already exists.")
  }

  // ── 5. Ensure stock-location ↔ conditional-shipping provider link ────
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id"],
  })
  const stockLocationId = (stockLocations as any[])?.[0]?.id

  if (stockLocationId) {
    try {
      await link.create({
        [Modules.STOCK_LOCATION]: {
          stock_location_id: stockLocationId,
        },
        [Modules.FULFILLMENT]: {
          fulfillment_provider_id:
            "conditional-shipping_conditional-shipping",
        },
      })
      logger.info(
        "[fix-shipping] Linked stock location to conditional-shipping provider."
      )
    } catch {
      // Link may already exist — safe to ignore
      logger.info(
        "[fix-shipping] Stock-location ↔ provider link already exists."
      )
    }
  }

  logger.info("[fix-shipping] Done.")
}
