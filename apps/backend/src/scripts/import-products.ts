/**
 * Unified Pharma Product Importer
 *
 * Imports products from a single CSV that contains BOTH Medusa product fields
 * AND pharma drug metadata. No separate steps needed.
 *
 * What it creates per row:
 *   1. Medusa Product (title, handle, description, status)
 *   2. Medusa Variant (SKU, prices)
 *   3. Inventory Item + Stock Level at Main Warehouse
 *   4. Drug Product (pharma metadata — schedule, composition, etc.)
 *   5. Inventory Batch (lot number, expiry date, quantities — FEFO)
 *   6. Links: variant↔inventory, product↔category, product↔collection
 *
 * Usage:
 *   npx medusa exec ./src/scripts/import-products.ts
 *   npx medusa exec ./src/scripts/import-products.ts -- --file=./my-catalog.csv
 *   npx medusa exec ./src/scripts/import-products.ts -- --file=./catalog.csv --update
 *
 * Flags:
 *   --file=<path>   CSV file path (default: ./templates/pharma-product-import-template.csv)
 *   --update        Update existing products (matched by handle) instead of skipping
 */

import { MedusaContainer } from "@medusajs/framework"
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
import { PHARMA_MODULE } from "../modules/pharma"
import { INVENTORY_BATCH_MODULE } from "../modules/inventoryBatch"
import * as fs from "fs"
import * as path from "path"

// ── CSV Row Shape ────────────────────────────────────────────────────

interface PharmaRow {
  brand_name: string
  generic_name: string
  composition: string
  strength: string
  dosage_form: string
  pack_size: string
  unit_type: string
  schedule: string
  therapeutic_class: string
  category: string
  collection: string
  selling_price_inr: string
  mrp_inr: string
  gst_rate: string
  hsn_code: string
  stock_qty: string
  manufacturer: string
  manufacturer_license: string
  description: string
  indications: string
  contraindications: string
  side_effects: string
  storage_instructions: string
  dosage_instructions: string
  is_chronic: string
  habit_forming: string
  requires_refrigeration: string
  is_narcotic: string
  tags: string
  // Batch / lot tracking
  batch_lot_number: string
  batch_expiry_date: string
  batch_manufactured_on: string
  batch_mrp_inr: string
  batch_purchase_price_inr: string
  batch_supplier: string
  batch_grn_number: string
}

// ── Helpers ──────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function makeSku(handle: string): string {
  return `SUPRA-${handle.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`.slice(0, 48)
}

function toBool(val: string | undefined): boolean {
  if (!val) return false
  return val.trim().toLowerCase() === "true" || val.trim() === "1" || val.trim().toLowerCase() === "yes"
}

/**
 * Parses a CSV respecting quoted fields that contain commas.
 * Not a full RFC 4180 parser, but handles the common case of
 * commas inside double-quoted strings.
 */
function parseCSV(content: string): PharmaRow[] {
  const lines = content.trim().split("\n")
  if (lines.length < 2) return []

  const headers = parseLine(lines[0])
  const rows: PharmaRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || "").trim()
    })
    if (row.brand_name) {
      rows.push(row as unknown as PharmaRow)
    }
  }

  return rows
}

function parseLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// ── Main Import Function ─────────────────────────────────────────────

export default async function importProducts({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const pharmaService = container.resolve(PHARMA_MODULE) as any
  const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any

  const fulfillmentService = container.resolve(ModuleRegistrationName.FULFILLMENT) as any
  const salesChannelService = container.resolve(ModuleRegistrationName.SALES_CHANNEL) as any

  // Parse CLI args
  const args = process.argv
  let csvPath = "./templates/pharma-product-import-template.csv"
  const fileArg = args.find((a) => a.startsWith("--file="))
  if (fileArg) csvPath = fileArg.split("=")[1]
  const shouldUpdate = args.includes("--update")

  const resolvedPath = path.resolve(csvPath)
  if (!fs.existsSync(resolvedPath)) {
    logger.error(`[import] CSV not found: ${resolvedPath}`)
    return
  }

  logger.info("╔══════════════════════════════════════════════════╗")
  logger.info("║      SUPRAMEDS — Pharma Product Importer        ║")
  logger.info("╚══════════════════════════════════════════════════╝")
  logger.info(`[import] Reading: ${resolvedPath}`)
  logger.info(`[import] Mode: ${shouldUpdate ? "CREATE + UPDATE" : "CREATE only (skip existing)"}`)

  const content = fs.readFileSync(resolvedPath, "utf-8")
  const rows = parseCSV(content)
  if (!rows.length) {
    logger.warn("[import] No data rows in CSV.")
    return
  }
  logger.info(`[import] Found ${rows.length} products to process.`)

  // ── Resolve prerequisites ──────────────────────────────────────

  const [defaultSalesChannel] = await salesChannelService.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (!defaultSalesChannel?.id) {
    logger.error("[import] Default Sales Channel not found. Run db:setup first.")
    return
  }

  const [shippingProfile] = await fulfillmentService.listShippingProfiles({ type: "default" })
  if (!shippingProfile?.id) {
    logger.error("[import] Default shipping profile not found. Run db:setup first.")
    return
  }

  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const stockLocation = (stockLocations as any[])?.[0]
  if (!stockLocation?.id) {
    logger.error("[import] No stock location found. Run db:setup first.")
    return
  }

  // Existing products lookup
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
  })
  const existingByHandle = new Map<string, string>(
    (existingProducts as any[]).map((p) => [p.handle, p.id])
  )

  // Existing categories lookup
  const { data: existingCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
  })
  const categoryByHandle = new Map<string, any>(
    (existingCategories as any[]).map((c) => [c.handle, c])
  )

  // Existing collections lookup
  const { data: existingCollections } = await query.graph({
    entity: "product_collection",
    fields: ["id", "title", "handle"],
  })
  const collectionByTitle = new Map<string, any>(
    (existingCollections as any[]).map((c) => [c.title, c])
  )
  const collectionByHandle = new Map<string, any>(
    (existingCollections as any[]).map((c) => [c.handle, c])
  )

  // Existing tags lookup
  const { data: existingTags } = await query.graph({
    entity: "product_tag",
    fields: ["id", "value"],
  })
  const tagByValue = new Map<string, any>(
    (existingTags as any[]).map((t) => [t.value, t])
  )

  // Existing drug_products lookup
  const existingDrugs = await pharmaService.listDrugProducts({})
  const drugByProductId = new Map<string, any>(
    existingDrugs.map((d: any) => [d.product_id, d])
  )

  // ── Process rows ───────────────────────────────────────────────

  let created = 0
  let updated = 0
  let skipped = 0
  let errors = 0

  for (const row of rows) {
    const handle = slugify(row.brand_name)
    const sku = makeSku(handle)

    try {
      // Skip if exists and not in update mode
      if (existingByHandle.has(handle) && !shouldUpdate) {
        logger.info(`[import] SKIP (exists): ${row.brand_name}`)
        skipped++
        continue
      }

      const sellingPrice = Number(row.selling_price_inr) || 1
      const mrpPrice = Number(row.mrp_inr) || sellingPrice

      // Resolve category
      const categoryHandle = row.category ? slugify(row.category) : null
      const category = categoryHandle
        ? categoryByHandle.get(categoryHandle) || categoryByHandle.get(row.category)
        : null

      // Resolve collection
      const collection = row.collection
        ? collectionByTitle.get(row.collection) || collectionByHandle.get(slugify(row.collection))
        : null

      // Resolve tags
      const tagValues = row.tags
        ? row.tags.split(";").map((t) => t.trim()).filter(Boolean)
        : []
      const tagIds = tagValues
        .map((tv) => tagByValue.get(tv)?.id)
        .filter(Boolean) as string[]

      // Build description from pharma fields if not explicitly provided
      const description = row.description ||
        `${row.brand_name} — ${row.composition}. ${row.pack_size || ""} ${row.dosage_form || ""}. ${row.therapeutic_class || ""}`.trim()

      if (existingByHandle.has(handle)) {
        // ── UPDATE existing product ────────────────────────────
        const productId = existingByHandle.get(handle)!

        // Update drug metadata
        const existingDrug = drugByProductId.get(productId)
        if (existingDrug) {
          await pharmaService.updateDrugProducts({
            id: existingDrug.id,
            generic_name: row.generic_name,
            composition: row.composition || null,
            strength: row.strength || null,
            dosage_form: row.dosage_form || "tablet",
            pack_size: row.pack_size || null,
            unit_type: row.unit_type || "strip",
            schedule: row.schedule || "OTC",
            therapeutic_class: row.therapeutic_class || null,
            gst_rate: Number(row.gst_rate) || 12,
            hsn_code: row.hsn_code || null,
            manufacturer_license: row.manufacturer_license || null,
            indications: row.indications || null,
            contraindications: row.contraindications || null,
            side_effects: row.side_effects || null,
            storage_instructions: row.storage_instructions || null,
            dosage_instructions: row.dosage_instructions || null,
            is_chronic: toBool(row.is_chronic),
            habit_forming: toBool(row.habit_forming),
            requires_refrigeration: toBool(row.requires_refrigeration),
            is_narcotic: toBool(row.is_narcotic),
            mrp_paise: mrpPrice * 100,
          })
        }

        // ── Also create batch in update mode if lot number is new ────
        if (row.batch_lot_number && row.batch_expiry_date) {
          try {
            const existingBatches = await batchService.listBatches({
              lot_number: row.batch_lot_number,
            })

            if (!existingBatches.length) {
              // Two-step query: link model can't traverse to location_levels
              const { data: variantData } = await query.graph({
                entity: "variant",
                fields: ["id", "inventory_items.id"],
                filters: { product_id: [productId] },
              })
              const variant = (variantData as any[])[0]
              const invItemId = variant?.inventory_items?.[0]?.id

              // Get location levels from inventory item directly
              let invItem: any = { id: invItemId, location_levels: [] }
              if (invItemId) {
                try {
                  const { data: invItems } = await query.graph({
                    entity: "inventory_item",
                    fields: ["id", "location_levels.stocked_quantity", "location_levels.location_id"],
                    filters: { id: [invItemId] },
                  })
                  invItem = (invItems as any[])[0] ?? invItem
                } catch { /* no levels yet */ }
              }

              if (variant?.id) {
                const batchQty = Number(row.stock_qty) || 0
                const batchMrp = row.batch_mrp_inr
                  ? Number(row.batch_mrp_inr) * 100
                  : mrpPrice * 100
                const batchPurchase = row.batch_purchase_price_inr
                  ? Number(row.batch_purchase_price_inr) * 100
                  : null

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
                  metadata: { source: "csv-import" },
                })

                // Adjust Medusa inventory level to reflect new batch stock
                if (batchQty > 0 && invItem?.id) {
                  const currentLevel = invItem.location_levels?.find(
                    (l: any) => l.location_id === stockLocation.id
                  )
                  const currentQty = currentLevel?.stocked_quantity || 0

                  await batchInventoryItemLevelsWorkflow(container).run({
                    input: {
                      creates: [],
                      updates: [
                        {
                          inventory_item_id: invItem.id,
                          location_id: stockLocation.id,
                          stocked_quantity: currentQty + batchQty,
                        },
                      ],
                      deletes: [],
                    } as any,
                  })
                }

                logger.info(
                  `[import]   ↳ Batch ${row.batch_lot_number} added (qty: ${batchQty}, exp: ${row.batch_expiry_date})`
                )
              }
            } else {
              logger.info(
                `[import]   ↳ Batch ${row.batch_lot_number} already exists — skipping`
              )
            }
          } catch (batchErr: any) {
            logger.warn(`[import]   ↳ Batch creation failed: ${batchErr.message}`)
          }
        }

        logger.info(`[import] UPDATED: ${row.brand_name}`)
        updated++
      } else {
        // ── CREATE new product ─────────────────────────────────
        const prices: any[] = [{ currency_code: "inr", amount: sellingPrice }]

        const { result: createdProducts } = await createProductsWorkflow(container).run({
          input: {
            products: [
              {
                title: row.brand_name,
                handle,
                description,
                status: "published",
                sales_channels: [{ id: defaultSalesChannel.id }],
                collection_id: collection?.id,
                tag_ids: tagIds,
                options: [{ title: "Pack", values: ["default"] }],
                variants: [
                  {
                    title: row.brand_name,
                    sku,
                    options: { Pack: "default" },
                    prices,
                    manage_inventory: true,
                    allow_backorder: false,
                  },
                ],
                shipping_profile_id: shippingProfile.id,
                metadata: {
                  source: "csv-import",
                  pharma: true,
                  manufacturer: row.manufacturer || null,
                },
              },
            ],
          },
        })

        const product = (createdProducts as any[])[0]
        if (!product?.id) {
          logger.error(`[import] Failed to create product: ${row.brand_name}`)
          errors++
          continue
        }

        existingByHandle.set(handle, product.id)

        // Get the variant
        const { data: variants } = await query.graph({
          entity: "variant",
          fields: ["id", "sku", "product_id"],
          filters: { product_id: [product.id] },
        })
        const variant = (variants as any[])[0]

        // Create inventory item + stock level
        if (variant?.id) {
          const stockQty = Number(row.stock_qty) || 50

          const { result: invItems } = await createInventoryItemsWorkflow(container).run({
            input: { items: [{ sku }] as any },
          })
          const invItem = (invItems as any[])[0]

          if (invItem?.id) {
            await batchInventoryItemLevelsWorkflow(container).run({
              input: {
                creates: [
                  {
                    inventory_item_id: invItem.id,
                    location_id: stockLocation.id,
                    stocked_quantity: stockQty,
                  },
                ],
                updates: [],
                deletes: [],
              } as any,
            })

            // Link variant to inventory item
            await link.create({
              [Modules.PRODUCT]: { variant_id: variant.id },
              [Modules.INVENTORY]: { inventory_item_id: invItem.id },
            })
          }
        }

        // Link product to category
        if (category?.id) {
          await batchLinkProductsToCategoryWorkflow(container).run({
            input: { id: category.id, add: [product.id], remove: [] },
          })
        }

        // Create drug metadata
        await pharmaService.createDrugProducts({
          product_id: product.id,
          schedule: row.schedule || "OTC",
          generic_name: row.generic_name,
          therapeutic_class: row.therapeutic_class || null,
          dosage_form: row.dosage_form || "tablet",
          strength: row.strength || null,
          composition: row.composition || null,
          pack_size: row.pack_size || null,
          unit_type: row.unit_type || "strip",
          mrp_paise: mrpPrice * 100,
          gst_rate: Number(row.gst_rate) || 12,
          hsn_code: row.hsn_code || null,
          manufacturer_license: row.manufacturer_license || null,
          indications: row.indications || null,
          contraindications: row.contraindications || null,
          side_effects: row.side_effects || null,
          storage_instructions: row.storage_instructions || null,
          dosage_instructions: row.dosage_instructions || null,
          requires_refrigeration: toBool(row.requires_refrigeration),
          is_narcotic: toBool(row.is_narcotic),
          habit_forming: toBool(row.habit_forming),
          is_chronic: toBool(row.is_chronic),
          metadata: { source: "csv-import", manufacturer: row.manufacturer || null },
        })

        drugByProductId.set(product.id, true)

        // Create inventory batch if lot number and expiry provided
        if (row.batch_lot_number && row.batch_expiry_date && variant?.id) {
          const batchQty = Number(row.stock_qty) || 50
          const batchMrp = row.batch_mrp_inr ? Number(row.batch_mrp_inr) * 100 : mrpPrice * 100
          const batchPurchase = row.batch_purchase_price_inr ? Number(row.batch_purchase_price_inr) * 100 : null

          await batchService.createBatches({
            product_variant_id: variant.id,
            product_id: product.id,
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
            metadata: { source: "csv-import" },
          })
          logger.info(`[import]   ↳ Batch ${row.batch_lot_number} (exp: ${row.batch_expiry_date})`)
        }

        logger.info(`[import] CREATED: ${row.brand_name} → ${handle}`)
        created++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(`[import] ERROR (${row.brand_name}): ${msg}`)
      errors++
    }
  }

  // ── Summary ────────────────────────────────────────────────────
  logger.info("")
  logger.info("──────────────────────────────────────────────────")
  logger.info(`[import] Results: ${created} created, ${updated} updated, ${skipped} skipped, ${errors} errors`)
  logger.info(`[import] Total rows processed: ${rows.length}`)

  if (errors > 0) {
    logger.warn("[import] Some rows failed. Check logs above.")
  } else {
    logger.info("[import] All products imported successfully!")
  }
}
