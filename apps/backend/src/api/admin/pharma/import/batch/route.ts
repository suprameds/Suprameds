import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
} from "@medusajs/framework/utils"
import {
  batchLinkProductsToCategoryWorkflow,
  batchInventoryItemLevelsWorkflow,
  createInventoryItemsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { PHARMA_MODULE } from "../../../../../modules/pharma"

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

function makeSku(handle: string): string {
  return `SUPRA-${handle.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`.slice(0, 48)
}

function toBool(val: string | undefined): boolean {
  if (!val) return false
  return val.trim().toLowerCase() === "true" || val.trim() === "1"
}

/**
 * POST /admin/pharma/import/batch
 *
 * Batch import — creates products in batches of 50 instead of one-by-one.
 * ~10x faster than the per-row endpoint.
 *
 * Body: { rows: Record<string, string>[] }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const startTime = Date.now()
  const body = req.body as { rows?: Record<string, string>[] }

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return res.status(400).json({ message: "rows array is required" })
  }

  const rows = body.rows
  const container = req.scope
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const pharmaService = container.resolve(PHARMA_MODULE) as any
  const fulfillmentService = container.resolve(ModuleRegistrationName.FULFILLMENT) as any
  const salesChannelService = container.resolve(ModuleRegistrationName.SALES_CHANNEL) as any
  const productService = container.resolve(ModuleRegistrationName.PRODUCT) as any

  // ── Prerequisites ──────────────────────────────────────────────────
  const [defaultSalesChannel] = await salesChannelService.listSalesChannels({ name: "Default Sales Channel" })
  const [shippingProfile] = await fulfillmentService.listShippingProfiles({ type: "default" })
  const { data: stockLocations } = await query.graph({ entity: "stock_location", fields: ["id"] })
  const stockLocation = (stockLocations as any[])?.[0]

  if (!defaultSalesChannel?.id || !shippingProfile?.id || !stockLocation?.id) {
    return res.status(400).json({ message: "Missing prerequisites. Run db:setup first." })
  }

  // ── Load existing data ─────────────────────────────────────────────
  // Paginate to avoid OOM on large catalogs
  let allProducts: any[] = []
  let offset = 0
  while (true) {
    const { data: batch } = await query.graph({ entity: "product", fields: ["id", "handle"], pagination: { take: 1000, skip: offset } })
    allProducts = allProducts.concat(batch as any[])
    if ((batch as any[]).length < 1000) break
    offset += 1000
  }
  const existingByHandle = new Map<string, string>(allProducts.map(p => [p.handle, p.id]))

  const existingDrugProducts = new Set<string>()
  try {
    // Paginate drug products too
    let drugOffset = 0
    while (true) {
      const drugs = await pharmaService.listDrugProducts({}, { take: 1000, skip: drugOffset })
      const drugArr = (Array.isArray(drugs) ? drugs : (drugs?.[0] ?? [])) as any[]
      for (const dp of drugArr) {
        if (dp?.product_id) existingDrugProducts.add(dp.product_id)
      }
      if (drugArr.length < 1000) break
      drugOffset += 1000
    }
  } catch { /* pharma module may not be ready */ }

  const { data: cats } = await query.graph({ entity: "product_category", fields: ["id", "handle"] })
  const categoryByHandle = new Map<string, any>((cats as any[]).map(c => [c.handle, c]))

  const { data: collections } = await query.graph({ entity: "product_collection", fields: ["id", "handle"] })
  const collectionByHandle = new Map<string, any>((collections as any[]).map(c => [c.handle, c]))

  // ── Split rows into new vs existing ────────────────────────────────
  const newRows: any[] = []
  const existingRows: any[] = []

  for (const row of rows) {
    if (!row.brand_name) continue
    const handle = slugify(row.brand_name)
    const sku = makeSku(handle)
    if (existingByHandle.has(handle)) {
      existingRows.push({ ...row, _handle: handle, _sku: sku, _productId: existingByHandle.get(handle)! })
    } else {
      newRows.push({ ...row, _handle: handle, _sku: sku })
    }
  }

  logger.info(`[batch-import] ${rows.length} total: ${newRows.length} new, ${existingRows.length} existing`)

  const errors: { brand_name: string; phase: string; message: string }[] = []

  // ══════════════════════════════════════════════════════════════════
  // PHASE 1: Create products in batches of 50
  // ══════════════════════════════════════════════════════════════════
  const BATCH_SIZE = 50
  const createdProducts: { row: typeof newRows[0]; productId: string; variantId: string }[] = []

  for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
    const batch = newRows.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(newRows.length / BATCH_SIZE)

    try {
      const productInputs = batch.map(row => {
        const sellingPrice = Number(row.selling_price_inr) || 1
        const description = row.description || `${row.brand_name} — ${row.composition || row.generic_name}`

        return {
          title: row.brand_name,
          handle: row._handle,
          description,
          status: "published" as const,
          sales_channels: [{ id: defaultSalesChannel.id }],
          options: [{ title: "Pack", values: ["default"] }],
          variants: [{
            title: row.brand_name,
            sku: row._sku,
            options: { Pack: "default" },
            prices: [{ currency_code: "inr", amount: sellingPrice }],
            manage_inventory: false,
            allow_backorder: true,
          }],
          shipping_profile_id: shippingProfile.id,
          metadata: { source: "batch-import", pharma: true, manufacturer: row.manufacturer || null },
        }
      })

      const { result } = await createProductsWorkflow(container).run({
        input: { products: productInputs },
      })

      const products = result as any[]
      for (let j = 0; j < products.length; j++) {
        const product = products[j]
        const row = batch[j]
        if (product?.id) {
          existingByHandle.set(row._handle, product.id)
          const variantId = product.variants?.[0]?.id
          createdProducts.push({ row, productId: product.id, variantId })
        }
      }

      logger.info(`[batch-import] Phase 1: batch ${batchNum}/${totalBatches} — ${products.length} products created`)
    } catch (err: any) {
      logger.error(`[batch-import] Phase 1 batch ${batchNum} failed: ${err.message}. Falling back to one-by-one.`)
      // Fallback: try one-by-one for this batch
      for (const row of batch) {
        try {
          const sellingPrice = Number(row.selling_price_inr) || 1
          const description = row.description || `${row.brand_name} — ${row.composition || row.generic_name}`
          const { result } = await createProductsWorkflow(container).run({
            input: {
              products: [{
                title: row.brand_name,
                handle: row._handle,
                description,
                status: "published" as const,
                sales_channels: [{ id: defaultSalesChannel.id }],
                options: [{ title: "Pack", values: ["default"] }],
                variants: [{
                  title: row.brand_name,
                  sku: row._sku,
                  options: { Pack: "default" },
                  prices: [{ currency_code: "inr", amount: sellingPrice }],
                  manage_inventory: false,
                  allow_backorder: true,
                }],
                shipping_profile_id: shippingProfile.id,
                metadata: { source: "batch-import", pharma: true },
              }],
            },
          })
          const product = (result as any[])[0]
          if (product?.id) {
            existingByHandle.set(row._handle, product.id)
            createdProducts.push({ row, productId: product.id, variantId: product.variants?.[0]?.id })
          }
        } catch (rowErr: any) {
          errors.push({ brand_name: row.brand_name, phase: "product_creation", message: rowErr.message })
        }
      }
    }
  }

  logger.info(`[batch-import] Phase 1 complete: ${createdProducts.length} products created`)

  // ══════════════════════════════════════════════════════════════════
  // PHASE 2: Batch-link categories and collections
  // ══════════════════════════════════════════════════════════════════
  // Group new products by category
  const productsByCategory = new Map<string, string[]>()
  const allProductRows = [
    ...createdProducts.map(cp => ({ ...cp.row, _productId: cp.productId })),
    ...existingRows,
  ]

  for (const row of allProductRows) {
    if (!row.category) continue
    const catHandle = slugify(row.category)
    const cat = categoryByHandle.get(catHandle) || categoryByHandle.get(row.category)
    if (!cat?.id) continue
    if (!productsByCategory.has(cat.id)) productsByCategory.set(cat.id, [])
    productsByCategory.get(cat.id)!.push(row._productId)
  }

  // Link all products to their categories in one call per category
  for (const [catId, productIds] of productsByCategory) {
    try {
      await batchLinkProductsToCategoryWorkflow(container).run({
        input: { id: catId, add: productIds, remove: [] },
      })
    } catch (err: any) {
      logger.error(`[batch-import] Phase 2 category link failed for ${catId}: ${err.message}`)
    }
  }

  // Collection links (no batch workflow, but we can do them quickly)
  for (const row of allProductRows) {
    if (!row.collection) continue
    const colHandle = slugify(row.collection)
    const col = collectionByHandle.get(colHandle) || collectionByHandle.get(row.collection)
    if (col?.id) {
      try {
        await productService.updateProducts({ id: row._productId, collection_id: col.id })
      } catch { /* skip */ }
    }
  }

  logger.info(`[batch-import] Phase 2 complete: ${productsByCategory.size} categories linked`)

  // ══════════════════════════════════════════════════════════════════
  // PHASE 3: Batch inventory creation
  // ══════════════════════════════════════════════════════════════════
  // Only for newly created products
  if (createdProducts.length > 0) {
    const INV_BATCH = 100
    for (let i = 0; i < createdProducts.length; i += INV_BATCH) {
      const batch = createdProducts.slice(i, i + INV_BATCH)
      try {
        // Create inventory items
        const { result: invItems } = await createInventoryItemsWorkflow(container).run({
          input: { items: batch.map(cp => ({ sku: cp.row._sku })) as any },
        })

        const invItemsArr = invItems as any[]

        // Create inventory levels
        const levelCreates = invItemsArr
          .filter((inv: any) => inv?.id)
          .map((inv: any, idx: number) => ({
            inventory_item_id: inv.id,
            location_id: stockLocation.id,
            stocked_quantity: Number(batch[idx]?.row.stock_qty) || 0,
          }))

        if (levelCreates.length > 0) {
          await batchInventoryItemLevelsWorkflow(container).run({
            input: { creates: levelCreates, updates: [], deletes: [] } as any,
          })
        }

        // Link variants to inventory items
        for (let j = 0; j < invItemsArr.length; j++) {
          const inv = invItemsArr[j]
          const cp = batch[j]
          if (inv?.id && cp?.variantId) {
            try {
              await link.create({
                [Modules.PRODUCT]: { variant_id: cp.variantId },
                [Modules.INVENTORY]: { inventory_item_id: inv.id },
              })
            } catch { /* link may already exist */ }
          }
        }
      } catch (err: any) {
        logger.error(`[batch-import] Phase 3 inventory batch failed: ${err.message}`)
        // Fall back to individual creation
        for (const cp of batch) {
          try {
            const { result: invItems } = await createInventoryItemsWorkflow(container).run({
              input: { items: [{ sku: cp.row._sku }] as any },
            })
            const inv = (invItems as any[])[0]
            if (inv?.id) {
              await batchInventoryItemLevelsWorkflow(container).run({
                input: {
                  creates: [{ inventory_item_id: inv.id, location_id: stockLocation.id, stocked_quantity: Number(cp.row.stock_qty) || 0 }],
                  updates: [], deletes: [],
                } as any,
              })
              if (cp.variantId) {
                await link.create({
                  [Modules.PRODUCT]: { variant_id: cp.variantId },
                  [Modules.INVENTORY]: { inventory_item_id: inv.id },
                }).catch(() => {})
              }
            }
          } catch (invErr: any) {
            errors.push({ brand_name: cp.row.brand_name, phase: "inventory", message: invErr.message })
          }
        }
      }
    }
  }

  logger.info(`[batch-import] Phase 3 complete: inventory created`)

  // ══════════════════════════════════════════════════════════════════
  // PHASE 4: Batch drug metadata
  // ══════════════════════════════════════════════════════════════════
  const drugMetadataToCreate: any[] = []

  for (const row of allProductRows) {
    if (existingDrugProducts.has(row._productId)) continue
    const mrpPrice = Number(row.mrp_inr) || Number(row.selling_price_inr) || 1

    drugMetadataToCreate.push({
      product_id: row._productId,
      schedule: row.schedule || "OTC",
      generic_name: row.generic_name,
      therapeutic_class: row.therapeutic_class || null,
      dosage_form: row.dosage_form || "tablet",
      strength: row.strength || null,
      composition: row.composition || null,
      pack_size: row.pack_size || null,
      unit_type: row.unit_type || "strip",
      mrp_paise: mrpPrice * 100,
      gst_rate: Number(row.gst_rate) || 5,
      hsn_code: row.hsn_code || null,
      indications: row.indications || null,
      contraindications: row.contraindications || null,
      side_effects: row.side_effects || null,
      storage_instructions: row.storage_instructions || null,
      dosage_instructions: row.dosage_instructions || null,
      requires_refrigeration: toBool(row.requires_refrigeration),
      is_narcotic: toBool(row.is_narcotic),
      habit_forming: toBool(row.habit_forming),
      is_chronic: toBool(row.is_chronic),
      metadata: { source: "batch-import", manufacturer: row.manufacturer || null },
    })
  }

  // MedusaService.create() returns array for array input
  const DRUG_BATCH = 100
  for (let i = 0; i < drugMetadataToCreate.length; i += DRUG_BATCH) {
    const batch = drugMetadataToCreate.slice(i, i + DRUG_BATCH)
    try {
      await pharmaService.createDrugProducts(batch)
    } catch (err: any) {
      // Fallback: one by one
      for (const drug of batch) {
        try {
          await pharmaService.createDrugProducts(drug)
        } catch (drugErr: any) {
          errors.push({ brand_name: drug.generic_name || "unknown", phase: "drug_metadata", message: drugErr.message })
        }
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const created = createdProducts.length
  const updated = existingRows.length

  logger.info(`[batch-import] DONE in ${elapsed}s: ${created} created, ${updated} existing, ${errors.length} errors`)

  return res.json({
    summary: {
      total: rows.length,
      created,
      updated,
      errors: errors.length,
      elapsed_seconds: Number(elapsed),
    },
    errors: errors.slice(0, 50), // Cap error list at 50
  })
}
