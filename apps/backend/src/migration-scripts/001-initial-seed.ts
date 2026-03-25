/**
 * Initial seed for Suprameds — India-only pharmaceutical eCommerce.
 *
 * Creates:
 *   - Store defaults with INR as the sole currency
 *   - India region (INR, tax-inclusive, Razorpay + COD)
 *   - India GST tax region at 5% (standard rate for pharmaceutical formulations)
 *   - Stock location in India (ambient warehouse)
 *   - Default shipping profile
 *   - Fulfillment set with India-only geo zone
 *   - Shipping option with INR pricing (legacy flat-rate; replaced by
 *     conditional-shipping in a later migration)
 *
 * Idempotent — skips if products already exist or SKIP_INITIAL_SEED=true.
 */

import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
} from "@medusajs/framework/utils"
import {
  createDefaultsWorkflow,
  createRegionsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"

const RAZORPAY_PROVIDER_ID = "pp_razorpay_razorpay"
const SYSTEM_DEFAULT_ID = "pp_system_default"

export default async function migration_25022026_initial_seed({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const storeModuleService = container.resolve(ModuleRegistrationName.STORE) as any
  const salesChannelModuleService = container.resolve(ModuleRegistrationName.SALES_CHANNEL) as any
  const fulfillmentModuleService = container.resolve(ModuleRegistrationName.FULFILLMENT) as any

  const { data: existingProductsAtStartup } = await query.graph({
    entity: "product",
    fields: ["id"],
  })

  if (process.env.SKIP_INITIAL_SEED === "true" || existingProductsAtStartup.length > 0) {
    return
  }

  // ── 1. Defaults ──────────────────────────────────────────────────────
  logger.info("Seeding defaults...")
  await createDefaultsWorkflow(container).run()

  // ── 2. Store — INR as default and only currency ──────────────────────
  const [store] = await storeModuleService.listStores()
  const defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  })

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_currencies: [
          { currency_code: "inr", is_default: true },
        ],
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  })

  // Clean up any auto-created price preferences
  const { data: pricePreferences } = await query.graph({
    entity: "price_preference",
    fields: ["id"],
  })
  if (pricePreferences.length > 0) {
    const ids = pricePreferences.map((pp) => pp.id)
    await container.resolve(Modules.PRICING).deletePricePreferences(ids)
  }

  // ── 3. India region (INR, tax-inclusive) ──────────────────────────────
  const { data: existingRegions } = await query.graph({
    entity: "region",
    fields: ["id", "name"],
  })

  let indiaRegion
  if (!existingRegions.length) {
    logger.info("Creating India region...")

    // Try Razorpay + COD first, fall back to COD only
    const paymentProviders = [RAZORPAY_PROVIDER_ID, SYSTEM_DEFAULT_ID]
    try {
      const { result: regionResult } = await createRegionsWorkflow(container).run({
        input: {
          regions: [
            {
              name: "India",
              currency_code: "inr",
              countries: ["in"],
              payment_providers: paymentProviders,
              automatic_taxes: true,
              is_tax_inclusive: true,
            },
          ],
        },
      })
      indiaRegion = regionResult[0]
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("Payment providers") || msg.includes("not found")) {
        logger.warn("[initial-seed] Razorpay not available; creating India region with COD only.")
        const { result: regionResult } = await createRegionsWorkflow(container).run({
          input: {
            regions: [
              {
                name: "India",
                currency_code: "inr",
                countries: ["in"],
                payment_providers: [SYSTEM_DEFAULT_ID],
                automatic_taxes: true,
                is_tax_inclusive: true,
              },
            ],
          },
        })
        indiaRegion = regionResult[0]
      } else {
        throw err
      }
    }
  } else {
    logger.info("Regions already exist, skipping creation...")
    indiaRegion = existingRegions.find((r) => r.name === "India") ?? existingRegions[0]
  }

  // ── 4. India GST 5% tax region (standard rate for medicines) ─────────
  const { data: existingTaxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id", "country_code"],
  })

  const hasIndiaTax = (existingTaxRegions as any[])?.some(
    (tr) => tr.country_code === "in"
  )

  if (!hasIndiaTax) {
    logger.info("Creating India tax region (GST 5% for medicines)...")
    await createTaxRegionsWorkflow(container).run({
      input: [
        {
          country_code: "in",
          provider_id: "tp_system",
          default_tax_rate: {
            rate: 5,
            code: "GST5",
            name: "India GST (Medicines)",
            is_default: true,
          },
        },
      ],
    })
    logger.info("Created India GST 5% tax region.")
  } else {
    logger.info("Tax regions already exist, skipping creation...")
  }

  // ── 5. Stock location — India warehouse ──────────────────────────────
  const { data: existingStockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })

  let stockLocation
  if (!existingStockLocations.length) {
    logger.info("Creating stock location (India)...")
    const { result: stockLocationResult } = await createStockLocationsWorkflow(
      container
    ).run({
      input: {
        locations: [
          {
            name: "Suprameds Warehouse",
            address: {
              city: "",
              country_code: "IN",
              address_1: "",
            },
          },
        ],
      },
    })
    stockLocation = stockLocationResult[0]

    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_provider_id: "manual_manual",
      },
    })
  } else {
    logger.info("Stock location already exists, skipping creation...")
    stockLocation = existingStockLocations[0]
  }

  // ── 6. Shipping profile ──────────────────────────────────────────────
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  let shippingProfile

  if (!shippingProfiles.length) {
    logger.info("Creating shipping profile...")
    const { result: shippingProfileResult } =
      await createShippingProfilesWorkflow(container).run({
        input: {
          data: [
            {
              name: "Default Shipping Profile",
              type: "default",
            },
          ],
        },
      })
    shippingProfile = shippingProfileResult[0]
  } else {
    logger.info("Shipping profile already exists, skipping creation...")
    shippingProfile = shippingProfiles[0]
  }

  // ── 7. Fulfillment set — India only ──────────────────────────────────
  const fulfillmentSets = await fulfillmentModuleService.listFulfillmentSets()

  let fulfillmentSet
  if (!fulfillmentSets.length) {
    logger.info("Creating fulfillment set (India)...")
    fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: "Suprameds India Delivery",
      type: "shipping",
      service_zones: [
        {
          name: "India",
          geo_zones: [
            { country_code: "in", type: "country" as const },
          ],
        },
      ],
    })

    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_set_id: fulfillmentSet.id,
      },
    })
  } else {
    logger.info("Fulfillment set already exists, skipping creation...")
    fulfillmentSet = fulfillmentSets[0]
  }

  // ── 8. Shipping option — INR pricing ─────────────────────────────────
  const { data: existingShippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name"],
  })

  if (!existingShippingOptions.length) {
    logger.info("Creating shipping option (INR)...")
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "Standard Shipping (India)",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Standard",
            description: "Delivery within India",
            code: "standard-india",
          },
          prices: [
            {
              currency_code: "inr",
              amount: 50,
            },
          ],
          rules: [
            {
              attribute: "enabled_in_store",
              value: "true",
              operator: "eq",
            },
            {
              attribute: "is_return",
              value: "false",
              operator: "eq",
            },
          ],
        },
      ],
    })
  } else {
    logger.info("Shipping option already exists, skipping creation...")
  }

  // ── 9. Link sales channel to stock location ──────────────────────────
  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  })

  logger.info("Finished seeding India-only data.")
}
