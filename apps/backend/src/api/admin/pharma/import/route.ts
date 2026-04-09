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
import { PHARMA_MODULE } from "../../../../modules/pharma"
import { INVENTORY_BATCH_MODULE } from "../../../../modules/inventoryBatch"

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

function parseLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === "," && !inQuotes) {
      result.push(current); current = ""
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split("\n")
  if (lines.length < 2) return []
  const headers = parseLine(lines[0]).map((h) => h.trim())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = (values[idx] || "").trim() })
    if (row.brand_name) rows.push(row)
  }
  return rows
}

/**
 * POST /admin/pharma/import
 *
 * Two calling conventions:
 *   1. Legacy  — { csv: string }              → parse & process all rows server-side (no progress)
 *   2. Chunked — { rows: [...] }              → process the provided pre-parsed rows only
 *                { rows: [...], row_index, total_rows } → optionally carry progress metadata
 *
 * Convention 2 is used by the admin UI for per-row progress feedback.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as {
    csv?: string
    rows?: Record<string, string>[]
    row_index?: number
    total_rows?: number
  }

  // Resolve rows — either from pre-parsed array or raw CSV string
  let rows: Record<string, string>[]
  if (Array.isArray(body.rows) && body.rows.length > 0) {
    rows = body.rows
  } else if (body.csv) {
    rows = parseCSV(body.csv)
  } else {
    return res.status(400).json({ message: "Provide either 'csv' (string) or 'rows' (array) field" })
  }

  if (!rows.length) {
    return res.status(400).json({ message: "No data rows found" })
  }

  const container = req.scope
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const pharmaService = container.resolve(PHARMA_MODULE) as any
  const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
  const fulfillmentService = container.resolve(ModuleRegistrationName.FULFILLMENT) as any
  const salesChannelService = container.resolve(ModuleRegistrationName.SALES_CHANNEL) as any

  // Prerequisites
  const [defaultSalesChannel] = await salesChannelService.listSalesChannels({ name: "Default Sales Channel" })
  const [shippingProfile] = await fulfillmentService.listShippingProfiles({ type: "default" })
  const { data: stockLocations } = await query.graph({ entity: "stock_location", fields: ["id"] })
  const stockLocation = (stockLocations as any[])?.[0]

  if (!defaultSalesChannel?.id || !shippingProfile?.id || !stockLocation?.id) {
    return res.status(400).json({
      message: "Missing prerequisites (sales channel, shipping profile, or stock location). Run db:setup first.",
    })
  }

  // Existing products (to detect duplicates)
  const { data: existingProducts } = await query.graph({ entity: "product", fields: ["id", "handle"] })
  const existingByHandle = new Map<string, string>(
    (existingProducts as any[]).map((p) => [p.handle, p.id])
  )

  // Existing drug_product records (to detect which products need pharma metadata)
  const existingDrugProducts = new Set<string>()
  try {
    const allDrugs = await pharmaService.listDrugProducts({}, { take: 10000 })
    for (const dp of (Array.isArray(allDrugs) ? allDrugs : (allDrugs?.[0] ?? [])) as any[]) {
      if (dp?.product_id) existingDrugProducts.add(dp.product_id)
    }
  } catch { /* pharma module may not be ready */ }

  // Existing categories
  const { data: cats } = await query.graph({ entity: "product_category", fields: ["id", "handle"] })
  const categoryByHandle = new Map<string, any>(
    (cats as any[]).map((c) => [c.handle, c])
  )

  // Existing collections
  const { data: collections } = await query.graph({ entity: "product_collection", fields: ["id", "handle"] })
  const collectionByHandle = new Map<string, any>(
    (collections as any[]).map((c) => [c.handle, c])
  )

  // Existing tags
  const { data: tags } = await query.graph({ entity: "product_tag", fields: ["id", "value"] })
  const tagByValue = new Map<string, any>((tags as any[]).map((t) => [t.value, t]))

  const results: { brand_name: string; status: string; message?: string }[] = []

  for (const row of rows) {
    const handle = slugify(row.brand_name)
    const sku = makeSku(handle)

    try {
      const sellingPrice = Number(row.selling_price_inr) || 1
      const mrpPrice = Number(row.mrp_inr) || sellingPrice

      let productId: string
      let isNew = false

      if (existingByHandle.has(handle)) {
        // Product exists — use its ID but still backfill pharma metadata if missing
        productId = existingByHandle.get(handle)!
      } else {
        // Create new product
        isNew = true
        const category = row.category
          ? categoryByHandle.get(slugify(row.category)) || categoryByHandle.get(row.category)
          : null
        const tagValues = row.tags ? row.tags.split(";").map((t: string) => t.trim()).filter(Boolean) : []
        const tagIds = tagValues.map((tv: string) => tagByValue.get(tv)?.id).filter(Boolean)
        const description = row.description || `${row.brand_name} — ${row.composition || row.generic_name}`

        const { result: createdProducts } = await createProductsWorkflow(container).run({
          input: {
            products: [{
              title: row.brand_name,
              handle,
              description,
              status: "published",
              sales_channels: [{ id: defaultSalesChannel.id }],
              tag_ids: tagIds,
              options: [{ title: "Pack", values: ["default"] }],
              variants: [{
                title: row.brand_name,
                sku,
                options: { Pack: "default" },
                prices: [{ currency_code: "inr", amount: sellingPrice }],
                manage_inventory: false,
                allow_backorder: true,
              }],
              shipping_profile_id: shippingProfile.id,
              metadata: { source: "admin-csv-import", pharma: true, manufacturer: row.manufacturer || null },
            }],
          },
        })

        const product = (createdProducts as any[])[0]
        if (!product?.id) throw new Error("Product creation returned no ID")
        productId = product.id
        existingByHandle.set(handle, productId)

        // Category link (new products only)
        if (category?.id) {
          await batchLinkProductsToCategoryWorkflow(container).run({
            input: { id: category.id, add: [productId], remove: [] },
          })
        }

        // Collection link (new products only)
        const collectionHandle = row.collection ? slugify(row.collection) : null
        if (collectionHandle) {
          const collection = collectionByHandle.get(collectionHandle) || collectionByHandle.get(row.collection)
          if (collection?.id) {
            const productService = container.resolve(ModuleRegistrationName.PRODUCT) as any
            await productService.updateProducts({ id: productId, collection_id: collection.id })
          }
        }
      }

      // Get variant for this product
      const { data: variants } = await query.graph({
        entity: "variant",
        fields: ["id", "sku", "product_id"],
        filters: { product_id: [productId] },
      })
      const variant = (variants as any[])[0]

      // Inventory — create if not already linked to this variant
      if (variant?.id) {
        // Check if variant already has an inventory item
        const { data: existingInvLinks } = await query.graph({
          entity: "product_variant_inventory_item",
          fields: ["inventory_item_id"],
          filters: { variant_id: [variant.id] },
        }).catch(() => ({ data: [] }))

        if (!(existingInvLinks as any[])?.length) {
          try {
            const { result: invItems } = await createInventoryItemsWorkflow(container).run({
              input: { items: [{ sku }] as any },
            })
            const invItem = (invItems as any[])[0]
            if (invItem?.id) {
              await batchInventoryItemLevelsWorkflow(container).run({
                input: {
                  creates: [{
                    inventory_item_id: invItem.id,
                    location_id: stockLocation.id,
                    stocked_quantity: Number(row.stock_qty) || 0,
                  }],
                  updates: [],
                  deletes: [],
                } as any,
              })
              await link.create({
                [Modules.PRODUCT]: { variant_id: variant.id },
                [Modules.INVENTORY]: { inventory_item_id: invItem.id },
              })
            }
          } catch (invErr: any) {
            // SKU already exists — find and link the existing inventory item
            if (invErr.message?.includes("already exists")) {
              logger.info(`[csv-import]   ↳ Inventory item ${sku} already exists, skipping`)
            } else {
              throw invErr
            }
          }
        }
      }

      // Drug metadata — create if missing for this product
      if (!existingDrugProducts.has(productId)) {
        await pharmaService.createDrugProducts({
          product_id: productId,
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
          metadata: { source: "admin-csv-import", manufacturer: row.manufacturer || null },
        })
        existingDrugProducts.add(productId)
        logger.info(`[csv-import]   ↳ Drug metadata created for ${row.brand_name}`)
      }

      // Inventory batch if lot data provided
      if (row.batch_lot_number && row.batch_expiry_date && variant?.id) {
        const batchQty = Number(row.stock_qty) || 50
        const batchMrp = row.batch_mrp_inr ? Number(row.batch_mrp_inr) * 100 : mrpPrice * 100
        const batchPurchase = row.batch_purchase_price_inr
          ? Number(row.batch_purchase_price_inr) * 100
          : null

        try {
          await batchService.createBatches({
            product_variant_id: variant.id,
            product_id: productId,
            lot_number: row.batch_lot_number,
            manufactured_on: row.batch_manufactured_on || null,
            expiry_date: row.batch_expiry_date,
            received_quantity: batchQty,
            available_quantity: batchQty,
            reserved_quantity: 0,
            batch_mrp_paise: batchMrp,
            purchase_price_paise: batchPurchase,
            location_id: stockLocation.id,
            supplier_name: row.batch_supplier || row.manufacturer || null,
            grn_number: row.batch_grn_number || null,
            received_on: new Date().toISOString(),
            status: "active",
            metadata: { source: "admin-csv-import" },
          })
          logger.info(`[csv-import]   ↳ Batch ${row.batch_lot_number}`)
        } catch {
          // Batch may already exist for this lot — skip
        }
      }

      results.push({ brand_name: row.brand_name, status: isNew ? "created" : "updated" })
      logger.info(`[csv-import] ${isNew ? "Created" : "Updated"}: ${row.brand_name}`)
    } catch (err: any) {
      results.push({ brand_name: row.brand_name, status: "error", message: err?.message || String(err) })
      logger.error(`[csv-import] Error (${row.brand_name}): ${err?.message}`)
    }
  }

  const created = results.filter((r) => r.status === "created").length
  const updated = results.filter((r) => r.status === "updated").length
  const errored = results.filter((r) => r.status === "error").length

  return res.json({
    summary: { total: rows.length, created, updated, errors: errored },
    results,
    // Echo back progress metadata when provided (used by chunked UI)
    row_index: body.row_index,
    total_rows: body.total_rows,
  })
}
