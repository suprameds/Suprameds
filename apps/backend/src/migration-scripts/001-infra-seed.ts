/**
 * Infrastructure seed for Suprameds -- India-only pharmaceutical eCommerce.
 *
 * Merged from former 001-initial-seed.ts + 009-conditional-shipping-option.ts.
 *
 * Creates (in order, all idempotent):
 *   1. Store defaults via createDefaultsWorkflow
 *   2. Store updated to INR as sole currency
 *   3. Auto-created price preferences cleaned up
 *   4. India region (INR, tax-inclusive) with Razorpay + COD (fallback COD-only)
 *   5. India GST 5% tax region (standard pharma rate)
 *   6. Stock location "Suprameds Warehouse" in India, linked to manual fulfillment
 *   7. Default shipping profile
 *   8. Fulfillment set "Suprameds India Delivery" with India geo zone
 *   9. Calculated shipping option via conditional-shipping provider
 *      (free >= 300, 50 INR below) -- renames any old flat-rate options to legacy
 *  10. Sales channel linked to stock location
 *  11. Product categories (hierarchical: Medicines with 14 subcategories + 4 parents)
 *  12. Product collections (12 flat collections matching Cloud state)
 *
 * Idempotent -- every step uses check-before-create via query.graph().
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
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import { createLogger } from "../lib/logger"

const RAZORPAY_PROVIDER_ID = "pp_razorpay_razorpay"
const SYSTEM_DEFAULT_ID = "pp_system_default"
const CONDITIONAL_SHIPPING_PROVIDER = "conditional-shipping_conditional-shipping"

const logger = createLogger("migration:001-infra-seed")

export default async function infraSeed({
  container,
}: {
  container: MedusaContainer
}) {
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const storeModuleService = container.resolve(ModuleRegistrationName.STORE) as any
  const salesChannelModuleService = container.resolve(ModuleRegistrationName.SALES_CHANNEL) as any
  const fulfillmentModuleService = container.resolve(ModuleRegistrationName.FULFILLMENT) as any

  // ── 1. Defaults ──────────────────────────────────────────────────────────
  logger.info("Running createDefaultsWorkflow...")
  await createDefaultsWorkflow(container).run()
  logger.info("Defaults created.")

  // ── 2. Store -- INR as default and only currency ─────────────────────────
  const [store] = await storeModuleService.listStores()
  const defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  })

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        name: "Suprameds",
        supported_currencies: [
          { currency_code: "inr", is_default: true },
        ],
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  })
  logger.info("Store updated with INR currency.")

  // ── 3. Clean up auto-created price preferences ───────────────────────────
  const { data: pricePreferences } = await query.graph({
    entity: "price_preference",
    fields: ["id"],
  })
  if (pricePreferences.length > 0) {
    const ids = pricePreferences.map((pp: any) => pp.id)
    await container.resolve(Modules.PRICING).deletePricePreferences(ids)
    logger.info(`Cleaned up ${ids.length} auto-created price preferences.`)
  }

  // ── 4. India region (INR, tax-inclusive) ──────────────────────────────────
  const { data: existingRegions } = await query.graph({
    entity: "region",
    fields: ["id", "name"],
  })

  let indiaRegion: any
  if (!existingRegions.length) {
    logger.info("Creating India region...")

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
      logger.info("India region created with Razorpay + COD.")
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("Payment providers") || msg.includes("not found")) {
        logger.warn("Razorpay not available; creating India region with COD only.")
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
        logger.info("India region created with COD only (Razorpay fallback).")
      } else {
        throw err
      }
    }
  } else {
    indiaRegion = existingRegions.find((r: any) => r.name === "India") ?? existingRegions[0]
    logger.info(`India region already exists (${indiaRegion.id}), skipping.`)
  }

  // ── 5. India GST 5% tax region ──────────────────────────────────────────
  const { data: existingTaxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id", "country_code"],
  })

  const hasIndiaTax = (existingTaxRegions as any[])?.some(
    (tr) => tr.country_code === "in"
  )

  if (!hasIndiaTax) {
    logger.info("Creating India GST 5% tax region...")
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
    logger.info("India GST 5% tax region created.")
  } else {
    logger.info("India tax region already exists, skipping.")
  }

  // ── 6. Stock location -- Suprameds Warehouse ────────────────────────────
  const { data: existingStockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })

  let stockLocation: any
  if (!existingStockLocations.length) {
    logger.info("Creating stock location (Suprameds Warehouse)...")
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
    logger.info(`Stock location created (${stockLocation.id}), linked to manual fulfillment.`)
  } else {
    stockLocation = existingStockLocations[0]
    logger.info(`Stock location already exists (${stockLocation.id}), skipping.`)
  }

  // ── 7. Default shipping profile ─────────────────────────────────────────
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })

  let shippingProfile: any
  if (!shippingProfiles.length) {
    logger.info("Creating default shipping profile...")
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
    logger.info(`Shipping profile created (${shippingProfile.id}).`)
  } else {
    shippingProfile = shippingProfiles[0]
    logger.info(`Shipping profile already exists (${shippingProfile.id}), skipping.`)
  }

  // ── 8. Fulfillment set -- India geo zone ────────────────────────────────
  const fulfillmentSets = await fulfillmentModuleService.listFulfillmentSets(
    {},
    { relations: ["service_zones", "service_zones.geo_zones"] }
  )

  let fulfillmentSet: any
  if (!fulfillmentSets.length) {
    logger.info("Creating fulfillment set (Suprameds India Delivery)...")
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
    logger.info(`Fulfillment set created (${fulfillmentSet.id}), linked to stock location.`)
  } else {
    fulfillmentSet = fulfillmentSets[0]
    logger.info(`Fulfillment set already exists (${fulfillmentSet.id}), skipping.`)
  }

  // ── 9. Calculated shipping option (conditional-shipping provider) ───────
  const { data: existingShippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "price_type", "provider_id"],
  })

  const hasCalculatedOption = (existingShippingOptions as any[])?.some(
    (o: any) =>
      o.price_type === "calculated" &&
      (o.provider_id === CONDITIONAL_SHIPPING_PROVIDER ||
        o.name === "Standard Shipping (India)")
  )

  if (!hasCalculatedOption) {
    // Resolve the service zone that covers India
    let serviceZoneId: string | null = null
    const allFulfillmentSets = await fulfillmentModuleService.listFulfillmentSets(
      {},
      { relations: ["service_zones", "service_zones.geo_zones"] }
    )

    for (const fs of allFulfillmentSets) {
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
      logger.warn("No service zone with India found; skipping calculated shipping option.")
    } else {
      try {
        const created = await fulfillmentModuleService.createShippingOptions({
          name: "Standard Shipping (India)",
          price_type: "calculated",
          service_zone_id: serviceZoneId,
          shipping_profile_id: shippingProfile.id,
          provider_id: CONDITIONAL_SHIPPING_PROVIDER,
          type: {
            label: "Standard",
            description: "Free above INR 300, INR 50 below",
            code: "standard-conditional",
          },
          data: {},
        })
        logger.info(`Calculated shipping option created (${created.id}).`)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes("already") || msg.includes("duplicate")) {
          logger.info("Calculated shipping option already exists; skipping.")
        } else {
          throw err
        }
      }
    }

    // Rename any old flat-rate options to legacy
    const oldFlatOptions = (existingShippingOptions as any[])?.filter(
      (o: any) =>
        o.price_type === "flat" &&
        (o.name === "Standard Worldwide Shipping" ||
          o.name === "Standard Shipping (India)")
    )

    for (const oldOption of oldFlatOptions ?? []) {
      try {
        await fulfillmentModuleService.updateShippingOptions({
          id: oldOption.id,
          name: "Standard Shipping (legacy)",
        })
        logger.info(`Renamed old flat-rate option ${oldOption.id} to legacy.`)
      } catch {
        logger.warn(`Could not rename old shipping option ${oldOption.id}; non-critical.`)
      }
    }
  } else {
    logger.info("Calculated shipping option already exists, skipping.")
  }

  // ── 10. Link sales channel to stock location ────────────────────────────
  // Use direct link.create() — the workflow wrapper can silently fail
  // to persist the link that the storefront inventory queries rely on.
  const { data: existingSCLinks } = await query.graph({
    entity: "stock_location",
    fields: ["id", "sales_channels.id"],
    filters: { id: stockLocation.id },
  })

  const alreadyLinked = (existingSCLinks[0] as any)?.sales_channels?.some(
    (sc: any) => sc.id === defaultSalesChannel[0].id
  )

  if (!alreadyLinked) {
    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.SALES_CHANNEL]: {
        sales_channel_id: defaultSalesChannel[0].id,
      },
    })
    logger.info("Sales channel linked to stock location.")
  } else {
    logger.info("Sales channel already linked to stock location, skipping.")
  }

  // ── 11. Product categories (hierarchical) ──────────────────────────────
  const productService = container.resolve(ModuleRegistrationName.PRODUCT) as any

  const existingCategories = await productService.listProductCategories(
    {},
    { take: 100 }
  )
  const existingByHandle = new Map(
    existingCategories.map((c: any) => [c.handle, c])
  )

  const SUBCATEGORIES = [
    { name: "Antibiotics", handle: "antibiotics" },
    { name: "Diabetic", handle: "diabetic" },
    { name: "Hypertension", handle: "hypertension" },
    { name: "Cardiac Care", handle: "cardiac-care" },
    { name: "Cholesterol", handle: "cholesterol" },
    { name: "Gastroenterology", handle: "gastroenterology" },
    { name: "General Medicines", handle: "general-medicines" },
    { name: "Gynecology", handle: "gynecology" },
    { name: "Nephrology", handle: "nephrology" },
    { name: "Neurology", handle: "neurology" },
    { name: "Respiratory", handle: "respiratory" },
    { name: "Dermatology", handle: "dermatology" },
    { name: "Pain & Fever", handle: "pain-fever" },
    { name: "Vitamins & Supplements", handle: "vitamins-supplements" },
  ]

  // Helper: create category if it doesn't exist (handles race conditions + stale cache)
  async function ensureCategory(data: {
    name: string
    handle: string
    is_active?: boolean
    is_internal?: boolean
    rank?: number
    parent_category_id?: string
  }) {
    if (existingByHandle.has(data.handle)) {
      return existingByHandle.get(data.handle)
    }
    try {
      const created = await productService.createProductCategories({
        ...data,
        is_active: data.is_active ?? true,
        is_internal: data.is_internal ?? false,
      })
      existingByHandle.set(data.handle, created)
      logger.info(`  Created category: ${data.name}`)
      return created
    } catch (err: any) {
      if (err.message?.includes("already exists")) {
        logger.info(`  Category '${data.name}' already exists, skipping.`)
        // Fetch it so we have the ID for subcategories
        const [found] = await productService.listProductCategories({ handle: data.handle }, { take: 1 })
        if (found) existingByHandle.set(data.handle, found)
        return found
      }
      throw err
    }
  }

  // Create "Medicines" parent with subcategories
  const medicinesParent = await ensureCategory({ name: "Medicines", handle: "medicines", rank: 0 })
  if (medicinesParent?.id) {
    for (const sub of SUBCATEGORIES) {
      await ensureCategory({ ...sub, parent_category_id: medicinesParent.id })
    }
  }

  // Create standalone parent categories
  const STANDALONE_PARENTS = [
    { name: "Wellness", handle: "wellness", rank: 1 },
    { name: "Personal Care", handle: "personal-care", rank: 2 },
    { name: "Devices", handle: "devices", rank: 3 },
    { name: "Mother & Baby", handle: "mother-baby", rank: 4 },
  ]

  for (const cat of STANDALONE_PARENTS) {
    await ensureCategory(cat)
  }

  // ── 12. Product collections (flat) ────────────────────────────────────
  const COLLECTIONS = [
    { title: "Antidiabetic", handle: "antidiabetic" },
    { title: "Cardiology", handle: "cardiology" },
    { title: "Pain Relief", handle: "pain-relief" },
    { title: "Vitamins", handle: "vitamins" },
    { title: "Dermatology", handle: "dermatology" },
    { title: "Gastro", handle: "gastro" },
    { title: "Antibiotics", handle: "antibiotics" },
    { title: "Respiratory", handle: "respiratory" },
    { title: "Cardiac", handle: "cardiac" },
    { title: "Vitamins & Wellness", handle: "vitamins-wellness" },
    { title: "Antihypertensive", handle: "antihypertensive" },
    { title: "Pain & Fever", handle: "pain-fever" },
  ]

  const existingCollections = await productService.listProductCollections(
    {},
    { take: 100 }
  )
  const collectionByHandle = new Map(
    existingCollections.map((c: any) => [c.handle, c])
  )

  for (const col of COLLECTIONS) {
    if (!collectionByHandle.has(col.handle)) {
      try {
        await productService.createProductCollections({
          title: col.title,
          handle: col.handle,
        })
        logger.info(`Created collection: ${col.title}`)
      } catch (err: any) {
        if (err.message?.includes("already exists")) {
          logger.info(`Collection '${col.title}' already exists, skipping.`)
        } else {
          throw err
        }
      }
    } else {
      logger.info(`Collection '${col.title}' already exists, skipping.`)
    }
  }

  logger.info("Infrastructure seed complete.")
}
