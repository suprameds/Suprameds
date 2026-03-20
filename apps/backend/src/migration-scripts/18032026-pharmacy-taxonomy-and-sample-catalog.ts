import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
} from "@medusajs/framework/utils"
import {
  batchLinkProductsToCategoryWorkflow,
  batchInventoryItemLevelsWorkflow,
  createCollectionsWorkflow,
  createInventoryItemsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createProductTagsWorkflow,
  createProductTypesWorkflow,
  deleteProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { PHARMA_MODULE } from "../modules/pharma"

type ProductSchedule = "OTC" | "H" | "H1" | "X"
type DosageForm =
  | "tablet"
  | "capsule"
  | "syrup"
  | "suspension"
  | "cream"
  | "drops"
  | "injection"
  | "inhaler"
  | "patch"
  | "other"

type UnitType =
  | "tablet"
  | "strip"
  | "bottle"
  | "tube"
  | "box"
  | "sachet"
  | "vial"
  | "ampoule"

type SeedCatalogProduct = {
  title: string
  handle: string
  description: string
  category_handles: string[]
  collection_title: string
  type_value: "Medicine" | "Supplement" | "Device" | "PersonalCare"
  tag_values: Array<
    "otc" | "rx_required" | "schedule_h" | "schedule_h1" | "chronic" | "pediatric"
  >
  pharma: {
    schedule: ProductSchedule
    generic_name: string
    therapeutic_class: string
    dosage_form: DosageForm
    strength: string | null
    composition: string
    unit_type: UnitType
    gst_rate: number
    hsn_code?: string | null
  }
}

const SEED_SOURCES = new Set<string>([
  "supracyn-brochure-2025",
  "seed-basic-pharmacy-2026",
])

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function makeSku(handle: string): string {
  return `SUPRA-${handle.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`.slice(0, 48)
}

const DEFAULT_STOCK_QTY = 50

const CATEGORY_TREE: Array<{
  name: string
  handle: string
  parent_handle?: string
  rank?: number
}> = [
  { name: "Medicines", handle: "medicines", rank: 1 },
  { name: "Pain & Fever", handle: "pain-fever", parent_handle: "medicines", rank: 1 },
  { name: "Cold & Cough", handle: "cold-cough", parent_handle: "medicines", rank: 2 },
  { name: "Allergy", handle: "allergy", parent_handle: "medicines", rank: 3 },
  { name: "Stomach & Digestion", handle: "stomach-digestion", parent_handle: "medicines", rank: 4 },
  { name: "Diabetes Care", handle: "diabetes-care", parent_handle: "medicines", rank: 5 },
  { name: "Heart & BP", handle: "heart-bp", parent_handle: "medicines", rank: 6 },
  { name: "Antibiotics (Rx)", handle: "antibiotics-rx", parent_handle: "medicines", rank: 7 },
  { name: "Dermatology", handle: "dermatology", parent_handle: "medicines", rank: 8 },
  { name: "Eye & Ear", handle: "eye-ear", parent_handle: "medicines", rank: 9 },

  { name: "Wellness", handle: "wellness", rank: 2 },
  { name: "Vitamins & Supplements", handle: "vitamins-supplements", parent_handle: "wellness", rank: 1 },
  { name: "Immunity", handle: "immunity", parent_handle: "wellness", rank: 2 },
  { name: "Ayurveda", handle: "ayurveda", parent_handle: "wellness", rank: 3 },

  { name: "Personal Care", handle: "personal-care", rank: 3 },
  { name: "Skin Care", handle: "skin-care", parent_handle: "personal-care", rank: 1 },
  { name: "Oral Care", handle: "oral-care", parent_handle: "personal-care", rank: 2 },
  { name: "Hair Care", handle: "hair-care", parent_handle: "personal-care", rank: 3 },

  { name: "Devices", handle: "devices", rank: 4 },
  { name: "Monitoring Devices", handle: "monitoring-devices", parent_handle: "devices", rank: 1 },
  { name: "Supports & Braces", handle: "supports-braces", parent_handle: "devices", rank: 2 },

  { name: "Mother & Baby", handle: "mother-baby", rank: 5 },
  { name: "Baby Care", handle: "baby-care", parent_handle: "mother-baby", rank: 1 },
  { name: "Women Health", handle: "women-health", parent_handle: "mother-baby", rank: 2 },
]

const COLLECTION_TITLES = [
  "Antidiabetic",
  "Cardiology",
  "Respiratory",
  "Gastro",
  "Pain Relief",
  "Antibiotics",
  "Dermatology",
  "Vitamins",
] as const

const TYPE_VALUES = ["Medicine", "Supplement", "Device", "PersonalCare"] as const

const TAG_VALUES = ["otc", "rx_required", "schedule_h", "schedule_h1", "chronic", "pediatric"] as const

const SAMPLE_PRODUCTS: SeedCatalogProduct[] = [
  // Diabetes (brochure-aligned)
  {
    title: "GLIMCYN-M Tab",
    handle: "glimcyn-m-tab",
    description: "Glimepiride 1mg + Metformin 500mg (Sustained Release)",
    category_handles: ["diabetes-care"],
    collection_title: "Antidiabetic",
    type_value: "Medicine",
    tag_values: ["rx_required", "schedule_h", "chronic"],
    pharma: {
      schedule: "H",
      generic_name: "Glimepiride",
      therapeutic_class: "antidiabetic",
      dosage_form: "tablet",
      strength: "1mg/500mg",
      composition: "Glimepiride 1mg + Metformin 500mg (SR)",
      unit_type: "strip",
      gst_rate: 12,
      hsn_code: null,
    },
  },
  {
    title: "DAPACYN-10 Tab",
    handle: "dapacyn-10-tab",
    description: "Dapagliflozin 10mg",
    category_handles: ["diabetes-care"],
    collection_title: "Antidiabetic",
    type_value: "Medicine",
    tag_values: ["rx_required", "schedule_h", "chronic"],
    pharma: {
      schedule: "H",
      generic_name: "Dapagliflozin",
      therapeutic_class: "antidiabetic",
      dosage_form: "tablet",
      strength: "10mg",
      composition: "Dapagliflozin 10mg",
      unit_type: "strip",
      gst_rate: 12,
      hsn_code: null,
    },
  },

  // Heart/BP (brochure-aligned)
  {
    title: "SUPRATEL-40 Tab",
    handle: "supratel-40-tab",
    description: "Telmisartan 40mg",
    category_handles: ["heart-bp"],
    collection_title: "Cardiology",
    type_value: "Medicine",
    tag_values: ["rx_required", "schedule_h", "chronic"],
    pharma: {
      schedule: "H",
      generic_name: "Telmisartan",
      therapeutic_class: "cardiology",
      dosage_form: "tablet",
      strength: "40mg",
      composition: "Telmisartan 40mg",
      unit_type: "strip",
      gst_rate: 12,
      hsn_code: null,
    },
  },
  {
    title: "AMICYN-5 Tab",
    handle: "amicyn-5-tab",
    description: "Amlodipine 5mg",
    category_handles: ["heart-bp"],
    collection_title: "Cardiology",
    type_value: "Medicine",
    tag_values: ["rx_required", "schedule_h", "chronic"],
    pharma: {
      schedule: "H",
      generic_name: "Amlodipine",
      therapeutic_class: "cardiology",
      dosage_form: "tablet",
      strength: "5mg",
      composition: "Amlodipine 5mg",
      unit_type: "strip",
      gst_rate: 12,
      hsn_code: null,
    },
  },

  // Pain/Fever (OTC baseline)
  {
    title: "Paracetamol 500mg Tablet",
    handle: "paracetamol-500mg-tablet",
    description: "Paracetamol 500mg for pain and fever relief.",
    category_handles: ["pain-fever"],
    collection_title: "Pain Relief",
    type_value: "Medicine",
    tag_values: ["otc"],
    pharma: {
      schedule: "OTC",
      generic_name: "Paracetamol",
      therapeutic_class: "analgesic-antipyretic",
      dosage_form: "tablet",
      strength: "500mg",
      composition: "Paracetamol 500mg",
      unit_type: "strip",
      gst_rate: 12,
      hsn_code: null,
    },
  },

  // Cold/Cough + Allergy
  {
    title: "Cetirizine 10mg Tablet",
    handle: "cetirizine-10mg-tablet",
    description: "Cetirizine 10mg for allergy relief (sneezing, runny nose).",
    category_handles: ["allergy"],
    collection_title: "Respiratory",
    type_value: "Medicine",
    tag_values: ["otc"],
    pharma: {
      schedule: "OTC",
      generic_name: "Cetirizine",
      therapeutic_class: "antihistamine",
      dosage_form: "tablet",
      strength: "10mg",
      composition: "Cetirizine 10mg",
      unit_type: "strip",
      gst_rate: 12,
      hsn_code: null,
    },
  },
  {
    title: "Cough Relief Syrup",
    handle: "cough-relief-syrup",
    description: "Dextromethorphan + Phenylephrine + Chlorpheniramine cough syrup.",
    category_handles: ["cold-cough"],
    collection_title: "Respiratory",
    type_value: "Medicine",
    tag_values: ["otc"],
    pharma: {
      schedule: "OTC",
      generic_name: "Dextromethorphan",
      therapeutic_class: "respiratory",
      dosage_form: "syrup",
      strength: null,
      composition: "Dextromethorphan + Phenylephrine + Chlorpheniramine (syrup)",
      unit_type: "bottle",
      gst_rate: 12,
      hsn_code: null,
    },
  },

  // Stomach/Digestion
  {
    title: "Pantoprazole 40mg Tablet",
    handle: "pantoprazole-40mg-tablet",
    description: "Pantoprazole 40mg for acidity and GERD.",
    category_handles: ["stomach-digestion"],
    collection_title: "Gastro",
    type_value: "Medicine",
    tag_values: ["rx_required", "schedule_h"],
    pharma: {
      schedule: "H",
      generic_name: "Pantoprazole",
      therapeutic_class: "gastro",
      dosage_form: "tablet",
      strength: "40mg",
      composition: "Pantoprazole 40mg",
      unit_type: "strip",
      gst_rate: 12,
      hsn_code: null,
    },
  },

  // Antibiotics (Rx)
  {
    title: "Amoxicillin 500mg Capsule",
    handle: "amoxicillin-500mg-capsule",
    description: "Amoxicillin 500mg antibiotic capsule (Rx only).",
    category_handles: ["antibiotics-rx"],
    collection_title: "Antibiotics",
    type_value: "Medicine",
    tag_values: ["rx_required", "schedule_h"],
    pharma: {
      schedule: "H",
      generic_name: "Amoxicillin",
      therapeutic_class: "antibiotic",
      dosage_form: "capsule",
      strength: "500mg",
      composition: "Amoxicillin 500mg",
      unit_type: "strip",
      gst_rate: 12,
      hsn_code: null,
    },
  },

  // Dermatology
  {
    title: "Clotrimazole 1% Cream 20g",
    handle: "clotrimazole-1pct-cream-20g",
    description: "Antifungal cream for skin infections.",
    category_handles: ["dermatology", "skin-care"],
    collection_title: "Dermatology",
    type_value: "PersonalCare",
    tag_values: ["otc"],
    pharma: {
      schedule: "OTC",
      generic_name: "Clotrimazole",
      therapeutic_class: "dermatology",
      dosage_form: "cream",
      strength: "1%",
      composition: "Clotrimazole 1% w/w",
      unit_type: "tube",
      gst_rate: 12,
      hsn_code: null,
    },
  },

  // Eye/Ear
  {
    title: "Carboxymethylcellulose Eye Drops 0.5%",
    handle: "cmc-eye-drops-0-5pct",
    description: "Lubricating eye drops for dry eyes.",
    category_handles: ["eye-ear"],
    collection_title: "Respiratory",
    type_value: "Medicine",
    tag_values: ["otc"],
    pharma: {
      schedule: "OTC",
      generic_name: "Carboxymethylcellulose",
      therapeutic_class: "ophthalmic",
      dosage_form: "drops",
      strength: "0.5%",
      composition: "Carboxymethylcellulose sodium 0.5% w/v",
      unit_type: "bottle",
      gst_rate: 12,
      hsn_code: null,
    },
  },

  // Vitamins/Supplements
  {
    title: "Vitamin D3 60000 IU Capsule",
    handle: "vitamin-d3-60000iu-capsule",
    description: "Cholecalciferol 60000 IU weekly vitamin D supplement.",
    category_handles: ["vitamins-supplements", "immunity"],
    collection_title: "Vitamins",
    type_value: "Supplement",
    tag_values: ["otc"],
    pharma: {
      schedule: "OTC",
      generic_name: "Cholecalciferol",
      therapeutic_class: "vitamin",
      dosage_form: "capsule",
      strength: "60000 IU",
      composition: "Vitamin D3 (Cholecalciferol) 60000 IU",
      unit_type: "strip",
      gst_rate: 12,
      hsn_code: null,
    },
  },

  // Devices
  {
    title: "Digital Thermometer",
    handle: "digital-thermometer",
    description: "Digital thermometer for home temperature monitoring.",
    category_handles: ["monitoring-devices"],
    collection_title: "Vitamins",
    type_value: "Device",
    tag_values: ["otc"],
    pharma: {
      schedule: "OTC",
      generic_name: "Thermometer",
      therapeutic_class: "device",
      dosage_form: "other",
      strength: null,
      composition: "Digital thermometer device",
      unit_type: "box",
      gst_rate: 12,
      hsn_code: null,
    },
  },

  // Mother & Baby
  {
    title: "ORS Sachet",
    handle: "ors-sachet",
    description: "Oral rehydration salts sachet for dehydration support.",
    category_handles: ["baby-care", "stomach-digestion"],
    collection_title: "Gastro",
    type_value: "Supplement",
    tag_values: ["otc", "pediatric"],
    pharma: {
      schedule: "OTC",
      generic_name: "Oral Rehydration Salts",
      therapeutic_class: "electrolyte",
      dosage_form: "other",
      strength: null,
      composition: "WHO ORS formulation (sachet)",
      unit_type: "sachet",
      gst_rate: 12,
      hsn_code: null,
    },
  },
]

async function ensureDefaultSalesChannel(container: MedusaContainer) {
  const salesChannelModuleService = container.resolve(
    ModuleRegistrationName.SALES_CHANNEL
  ) as any
  const [defaultSalesChannel] = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  })
  return defaultSalesChannel
}

export default async function seed_basic_pharmacy_store({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  const defaultSalesChannel = await ensureDefaultSalesChannel(container)
  if (!defaultSalesChannel?.id) {
    logger.warn(
      "[seed] Default Sales Channel not found. Run base seed (createDefaultsWorkflow) first."
    )
    return
  }

  const fulfillmentModuleService = container.resolve(ModuleRegistrationName.FULFILLMENT) as any
  const [shippingProfile] = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  if (!shippingProfile?.id) {
    logger.warn("[seed] No default shipping profile found; skipping.")
    return
  }

  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
    filters: { name: "Main Warehouse" },
  })
  const stockLocation = (stockLocations as any[])?.[0] ?? null
  if (!stockLocation?.id) {
    logger.warn(
      "[seed] Main Warehouse stock location not found; run base seed first. Skipping."
    )
    return
  }

  // 1) Delete seeded/demo products only (metadata.source OR handle prefix)
  const { data: allProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "metadata"],
  })

  const seededIds = (allProducts as any[])
    .filter((p) => {
      const source = p?.metadata?.source as string | undefined
      const handle = String(p?.handle || "")
      return (
        (source && SEED_SOURCES.has(source)) ||
        handle.startsWith("supracyn-") ||
        handle.startsWith("seed-")
      )
    })
    .map((p) => p.id as string)

  if (seededIds.length) {
    logger.info(`[seed] Deleting ${seededIds.length} seeded/demo products...`)
    await deleteProductsWorkflow(container).run({ input: { ids: seededIds } })
  } else {
    logger.info("[seed] No seeded/demo products found to delete.")
  }

  // 2) Ensure categories (parent first, then children)
  const { data: existingCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle", "parent_category_id"],
  })
  const categoryByHandle = new Map<string, any>(
    (existingCategories as any[]).map((c) => [c.handle, c])
  )

  const byDepth = (a: (typeof CATEGORY_TREE)[number], b: (typeof CATEGORY_TREE)[number]) =>
    Number(Boolean(a.parent_handle)) - Number(Boolean(b.parent_handle))

  for (const cat of [...CATEGORY_TREE].sort(byDepth)) {
    if (categoryByHandle.has(cat.handle)) continue

    const parent = cat.parent_handle ? categoryByHandle.get(cat.parent_handle) : undefined
    const { result: created } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: [
          {
            name: cat.name,
            handle: cat.handle,
            parent_category_id: parent?.id,
            rank: cat.rank,
            is_active: true,
            is_internal: false,
            metadata: { source: "seed-basic-pharmacy-2026" },
          },
        ],
      },
    })
    const createdCat = (created as any[])[0]
    categoryByHandle.set(createdCat.handle, createdCat)
  }

  // 3) Ensure collections
  const { data: existingCollections } = await query.graph({
    entity: "product_collection",
    fields: ["id", "title", "handle"],
  })
  const collectionByTitle = new Map<string, any>(
    (existingCollections as any[]).map((c) => [c.title, c])
  )

  const missingCollections = COLLECTION_TITLES.filter((t) => !collectionByTitle.has(t))
  if (missingCollections.length) {
    const { result: created } = await createCollectionsWorkflow(container).run({
      input: {
        collections: missingCollections.map((title) => ({
          title,
          handle: slugify(title),
          metadata: { source: "seed-basic-pharmacy-2026" },
        })),
      },
    })
    for (const c of created as any[]) {
      collectionByTitle.set(c.title, c)
    }
  }

  // 4) Ensure product types
  const { data: existingTypes } = await query.graph({
    entity: "product_type",
    fields: ["id", "value"],
  })
  const typeByValue = new Map<string, any>((existingTypes as any[]).map((t) => [t.value, t]))
  const missingTypes = TYPE_VALUES.filter((t) => !typeByValue.has(t))
  if (missingTypes.length) {
    const { result: created } = await createProductTypesWorkflow(container).run({
      input: {
        product_types: missingTypes.map((value) => ({
          value,
          metadata: { source: "seed-basic-pharmacy-2026" },
        })),
      },
    })
    for (const t of created as any[]) {
      typeByValue.set(t.value, t)
    }
  }

  // 5) Ensure product tags
  const { data: existingTags } = await query.graph({
    entity: "product_tag",
    fields: ["id", "value"],
  })
  const tagByValue = new Map<string, any>((existingTags as any[]).map((t) => [t.value, t]))
  const missingTags = TAG_VALUES.filter((t) => !tagByValue.has(t))
  if (missingTags.length) {
    const { result: created } = await createProductTagsWorkflow(container).run({
      input: {
        product_tags: missingTags.map((value) => ({
          value,
          metadata: { source: "seed-basic-pharmacy-2026" },
        })),
      },
    })
    for (const t of created as any[]) {
      tagByValue.set(t.value, t)
    }
  }

  // 6) Create products (published, linked to sales channel + collection + type + tags)
  const { result: createdProducts } = await createProductsWorkflow(container).run({
    input: {
      products: SAMPLE_PRODUCTS.map((p) => {
        const collection = collectionByTitle.get(p.collection_title)
        const type = typeByValue.get(p.type_value)
        const tag_ids = p.tag_values.map((tv) => tagByValue.get(tv)?.id).filter(Boolean)

        return {
          title: p.title,
          handle: p.handle,
          description: p.description,
          status: "published",
          sales_channels: [{ id: defaultSalesChannel.id }],
          collection_id: collection?.id,
          type_id: type?.id,
          tag_ids,
          options: [{ title: "Pack", values: ["default"] }],
          variants: [
            {
              title: p.title,
              sku: makeSku(p.handle),
              options: { Pack: "default" },
              prices: [{ currency_code: "inr", amount: 1 }],
              manage_inventory: true,
              allow_backorder: false,
            },
          ],
          shipping_profile_id: shippingProfile.id,
          metadata: {
            source: "seed-basic-pharmacy-2026",
            pharma: true,
          },
        }
      }),
    },
  })

  const productByHandle = new Map<string, any>(
    (createdProducts as any[]).map((p) => [p.handle, p])
  )

  // 6.5) Create inventory items + stock levels and link them to variants.
  // We query variants explicitly (ProductDTO may not include variants in result).
  const createdProductIds = (createdProducts as any[]).map((p) => p.id).filter(Boolean)
  const { data: variants } = await query.graph({
    entity: "variant",
    fields: ["id", "sku", "product_id", "manage_inventory"],
    filters: { product_id: createdProductIds },
  })

  const variantsBySku = new Map<string, any>(
    (variants as any[]).filter((v) => v?.sku).map((v) => [v.sku, v])
  )

  const wantedSkus = SAMPLE_PRODUCTS.map((p) => makeSku(p.handle))

  const { data: existingInventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
    filters: { sku: wantedSkus },
  })

  const inventoryItemBySku = new Map<string, any>(
    (existingInventoryItems as any[]).filter((i) => i?.sku).map((i) => [i.sku, i])
  )

  const missingInventorySkus = wantedSkus.filter((sku) => !inventoryItemBySku.has(sku))
  if (missingInventorySkus.length) {
    const { result: createdInventoryItems } = await createInventoryItemsWorkflow(container).run(
      {
        input: {
          items: missingInventorySkus.map((sku) => ({
            sku,
          })) as any,
        },
      }
    )
    for (const item of createdInventoryItems as any[]) {
      if (item?.sku) inventoryItemBySku.set(item.sku, item)
    }
  }

  // Ensure inventory levels at Main Warehouse: create missing, update existing to DEFAULT_STOCK_QTY
  const inventoryItemIds = wantedSkus
    .map((sku) => inventoryItemBySku.get(sku)?.id)
    .filter(Boolean)

  const { data: existingLevels } = await query.graph({
    entity: "inventory_levels",
    fields: ["id", "inventory_item_id", "location_id"],
    filters: {
      inventory_item_id: inventoryItemIds,
      location_id: [stockLocation.id],
    },
  })

  const levelIdByKey = new Map<string, string>(
    (existingLevels as any[]).map((l) => [`${l.inventory_item_id}:${l.location_id}`, l.id])
  )

  const createLevels: any[] = []
  const updateLevels: any[] = []

  for (const inventory_item_id of inventoryItemIds) {
    const key = `${inventory_item_id}:${stockLocation.id}`
    const id = levelIdByKey.get(key)
    if (id) {
      updateLevels.push({
        id,
        inventory_item_id,
        location_id: stockLocation.id,
        stocked_quantity: DEFAULT_STOCK_QTY,
      })
    } else {
      createLevels.push({
        inventory_item_id,
        location_id: stockLocation.id,
        stocked_quantity: DEFAULT_STOCK_QTY,
      })
    }
  }

  if (createLevels.length || updateLevels.length) {
    await batchInventoryItemLevelsWorkflow(container).run({
      input: {
        creates: createLevels,
        updates: updateLevels,
        deletes: [],
      } as any,
    })
  }

  const linkDefinitions = SAMPLE_PRODUCTS.map((p) => {
    const sku = makeSku(p.handle)
    const variant = variantsBySku.get(sku)
    const inventoryItem = inventoryItemBySku.get(sku)
    if (!variant?.id || !inventoryItem?.id) {
      throw new Error(`[seed] Missing variant/inventory item for sku "${sku}".`)
    }

    return {
      [Modules.PRODUCT]: { variant_id: variant.id },
      [Modules.INVENTORY]: { inventory_item_id: inventoryItem.id },
    }
  })

  await link.create(linkDefinitions as any)

  // 7) Link products to categories
  const productIdsByCategory = new Map<string, string[]>()
  for (const p of SAMPLE_PRODUCTS) {
    const created = productByHandle.get(p.handle)
    if (!created?.id) continue
    for (const catHandle of p.category_handles) {
      const arr = productIdsByCategory.get(catHandle) ?? []
      arr.push(created.id)
      productIdsByCategory.set(catHandle, arr)
    }
  }

  for (const [catHandle, prodIds] of productIdsByCategory.entries()) {
    const cat = categoryByHandle.get(catHandle)
    if (!cat?.id) continue
    await batchLinkProductsToCategoryWorkflow(container).run({
      input: {
        id: cat.id,
        add: prodIds,
        remove: [],
      },
    })
  }

  // 8) Create pharma metadata records
  const pharmaService = container.resolve(PHARMA_MODULE) as any
  await pharmaService.createDrugProducts(
    SAMPLE_PRODUCTS.map((p) => {
      const created = productByHandle.get(p.handle)
      if (!created?.id) {
        throw new Error(`[seed] Missing created product for handle "${p.handle}".`)
      }

      return {
        product_id: created.id,
        schedule: p.pharma.schedule,
        generic_name: p.pharma.generic_name,
        therapeutic_class: p.pharma.therapeutic_class,
        dosage_form: p.pharma.dosage_form,
        strength: p.pharma.strength,
        composition: p.pharma.composition,
        unit_type: p.pharma.unit_type,
        gst_rate: p.pharma.gst_rate,
        hsn_code: p.pharma.hsn_code ?? null,
        metadata: { source: "seed-basic-pharmacy-2026" },
      }
    })
  )

  logger.info(
    `[seed] Seeded taxonomy + ${createdProducts.length} sample products (basic pharmacy store).`
  )
}

