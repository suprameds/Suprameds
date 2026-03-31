/**
 * 005 — Seed products from data/products.csv.
 *
 * Single clean migration replacing 009/010. Reads the product catalog CSV,
 * creates Medusa products + variants, drug metadata, inventory batches,
 * and sets stock levels.
 *
 * Proven patterns:
 *   - createProductsWorkflow with manage_inventory: true (auto-creates inv items)
 *   - Find inventory items by SKU (NOT via variant link — returns pvitem_ IDs)
 *   - Set stock via inventoryService directly (NOT workflow — more reliable)
 *   - Throws on failure so Medusa retries next deploy
 *
 * Idempotent: skips products that already exist (by handle).
 */

import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
} from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  deleteProductsWorkflow,
  batchLinkProductsToCategoryWorkflow,
} from "@medusajs/medusa/core-flows"
import { PHARMA_MODULE } from "../modules/pharma"
import { INVENTORY_BATCH_MODULE } from "../modules/inventoryBatch"
import { createLogger } from "../lib/logger"
import * as fs from "fs"
import * as path from "path"

const logger = createLogger("migration:005-seed-products")

// ── CSV Row Shape ────────────────────────────────────────────────────

interface PharmaRow {
  brand_name: string; generic_name: string; composition: string
  strength: string; dosage_form: string; pack_size: string; unit_type: string
  schedule: string; therapeutic_class: string; category: string
  collection: string; selling_price_inr: string; mrp_inr: string
  gst_rate: string; hsn_code: string; stock_qty: string
  manufacturer: string; manufacturer_license: string; description: string
  indications: string; contraindications: string; side_effects: string
  storage_instructions: string; dosage_instructions: string
  is_chronic: string; habit_forming: string; requires_refrigeration: string
  is_narcotic: string; tags: string
  batch_lot_number: string; batch_expiry_date: string
  batch_manufactured_on: string; batch_mrp_inr: string
  batch_purchase_price_inr: string; batch_supplier: string
  batch_grn_number: string
}

// ── Helpers ──────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

function makeSku(handle: string): string {
  return `SUPRA-${handle.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`.slice(0, 48)
}

function toBool(val: string | undefined): boolean {
  if (!val) return false
  return ["true", "1", "yes"].includes(val.trim().toLowerCase())
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
    headers.forEach((h, idx) => { row[h.trim()] = (values[idx] || "").trim() })
    if (row.brand_name && row.brand_name !== "dummy") rows.push(row as unknown as PharmaRow)
  }
  return rows
}

function resolveCSVPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "data/products.csv"),
    path.resolve(__dirname, "../../data/products.csv"),
    path.resolve(__dirname, "../../../data/products.csv"),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

// ── Main ─────────────────────────────────────────────────────────────

export default async function seedProducts({
  container,
}: {
  container: MedusaContainer
}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const inventoryService = container.resolve(Modules.INVENTORY) as any
  const pharmaService = container.resolve(PHARMA_MODULE) as any
  const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
  const fulfillmentService = container.resolve(ModuleRegistrationName.FULFILLMENT) as any
  const salesChannelService = container.resolve(ModuleRegistrationName.SALES_CHANNEL) as any

  // ── 0. Locate CSV ─────────────────────────────────────────────────

  const csvPath = resolveCSVPath()
  if (!csvPath) {
    logger.warn("005: data/products.csv not found — skipping product seed. Run import-products.ts manually.")
    return
  }

  const content = fs.readFileSync(csvPath, "utf-8")
  const rows = parseCSV(content)
  if (!rows.length) {
    logger.warn("005: CSV has no data rows — skipping.")
    return
  }

  logger.info(`005: Found ${rows.length} products in ${csvPath}`)

  // ── 1. Prerequisites ──────────────────────────────────────────────

  const [salesChannel] = await salesChannelService.listSalesChannels({ name: "Default Sales Channel" })
  if (!salesChannel?.id) throw new Error("005: Default Sales Channel missing — run 001 first")

  const [shippingProfile] = await fulfillmentService.listShippingProfiles({ type: "default" })
  if (!shippingProfile?.id) throw new Error("005: Default shipping profile missing — run 001 first")

  const { data: locations } = await query.graph({ entity: "stock_location", fields: ["id", "name"] })
  const locationId = (locations as any[])?.[0]?.id
  if (!locationId) throw new Error("005: No stock location found — run 001 first")

  const { data: categories } = await query.graph({ entity: "product_category", fields: ["id", "handle"] })
  const catMap = new Map((categories as any[]).map((c) => [c.handle, c.id]))

  const { data: collections } = await query.graph({ entity: "product_collection", fields: ["id", "title", "handle"] })
  const colByTitle = new Map((collections as any[]).map((c) => [c.title, c.id]))
  const colByHandle = new Map((collections as any[]).map((c) => [c.handle, c.id]))

  // Existing products — for idempotency
  const { data: existingProducts } = await query.graph({ entity: "product", fields: ["id", "handle"] })
  const existingByHandle = new Map((existingProducts as any[]).map((p: any) => [p.handle, p.id]))

  logger.info(`005: location=${locationId}, ${catMap.size} categories, ${colByTitle.size} collections, ${existingByHandle.size} existing products`)

  // ── 2. Clean up old 009 test products (if any remain) ─────────────

  try {
    const OLD_HANDLES = [
      "dolo-650", "glycomet-sr-500", "telma-40", "pan-40", "azithral-500",
      "amlong-5", "ecosprin-75", "shelcal-500", "omez-20", "crocin-advance",
    ]
    const { data: oldProducts } = await query.graph({
      entity: "product",
      fields: ["id", "handle"],
      filters: { handle: OLD_HANDLES },
    })
    if ((oldProducts as any[]).length > 0) {
      const oldIds = (oldProducts as any[]).map((p: any) => p.id)
      logger.info(`005: cleaning up ${oldIds.length} old test products from 009...`)
      for (const pid of oldIds) {
        try { const d = await pharmaService.listDrugProducts({ product_id: pid }); if (d.length) await pharmaService.deleteDrugProducts(d.map((x: any) => x.id)) } catch {}
        try { const b = await batchService.listBatches({ product_id: pid }); if (b.length) await batchService.deleteBatches(b.map((x: any) => x.id)) } catch {}
      }
      await deleteProductsWorkflow(container).run({ input: { ids: oldIds } })
      logger.info(`005: deleted ${oldIds.length} old 009 products`)
      await new Promise((r) => setTimeout(r, 1000))
    }
  } catch (cleanupErr: any) {
    logger.warn(`005: cleanup of old products failed (non-fatal): ${cleanupErr.message}`)
  }

  // ── 3. Create products from CSV ───────────────────────────────────

  let created = 0
  let skipped = 0

  for (const row of rows) {
    const handle = slugify(row.brand_name)
    const sku = makeSku(handle)

    // Skip if already exists
    if (existingByHandle.has(handle)) {
      skipped++
      continue
    }

    try {
      const sellPrice = Number(row.selling_price_inr) || 1
      const mrpPrice = Number(row.mrp_inr) || sellPrice
      const stockQty = Number(row.stock_qty) || 50

      // Resolve category & collection
      const catHandle = row.category ? slugify(row.category) : null
      const catId = catHandle ? catMap.get(catHandle) : null
      const colId = row.collection
        ? colByTitle.get(row.collection) || colByHandle.get(slugify(row.collection))
        : null

      const description = row.description ||
        `${row.brand_name} — ${row.composition}. ${row.pack_size || ""} ${row.dosage_form || ""}`.trim()

      // ── 3a. Create product + variant (auto-creates inventory item) ──

      const { result: createdProducts } = await createProductsWorkflow(container).run({
        input: {
          products: [{
            title: row.brand_name,
            handle,
            description,
            status: "published",
            sales_channels: [{ id: salesChannel.id }],
            collection_id: colId ?? undefined,
            options: [{ title: "Pack", values: ["default"] }],
            variants: [{
              title: row.brand_name,
              sku,
              options: { Pack: "default" },
              prices: [{ currency_code: "inr", amount: sellPrice }],
              manage_inventory: true,
              allow_backorder: false,
            }],
            shipping_profile_id: shippingProfile.id,
            metadata: { source: "seed:005", pharma: true, manufacturer: row.manufacturer || null },
          }],
        },
      })

      const product = (createdProducts as any[])[0]
      if (!product?.id) throw new Error("product creation returned no ID")

      // ── 3b. Find variant + inventory item ──

      const { data: variants } = await query.graph({
        entity: "variant",
        fields: ["id"],
        filters: { product_id: [product.id] },
      })
      const variantId = (variants as any[])[0]?.id

      // Find auto-created inventory item by SKU (NOT via link — pvitem_ bug)
      const [invItems] = await inventoryService.listInventoryItems({ sku })
      const invItemId = invItems?.[0]?.id

      // ── 3c. Set stock level ──

      if (invItemId) {
        const [existingLevels] = await inventoryService.listInventoryLevels({
          inventory_item_id: invItemId,
          location_id: locationId,
        })
        if (existingLevels?.length > 0) {
          await inventoryService.updateInventoryLevels({
            id: existingLevels[0].id,
            stocked_quantity: stockQty,
          })
        } else {
          await inventoryService.createInventoryLevels({
            inventory_item_id: invItemId,
            location_id: locationId,
            stocked_quantity: stockQty,
          })
        }
      }

      // ── 3d. Link to category ──

      if (catId) {
        try {
          await batchLinkProductsToCategoryWorkflow(container).run({
            input: { id: catId, add: [product.id], remove: [] },
          })
        } catch {}
      }

      // ── 3e. Create drug metadata ──

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
        gst_rate: Number(row.gst_rate) || 5,
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
        metadata: { source: "seed:005", manufacturer: row.manufacturer || null },
      })

      // ── 3f. Create inventory batch (FEFO) ──

      if (variantId && row.batch_lot_number && row.batch_expiry_date) {
        const batchMrp = row.batch_mrp_inr ? Number(row.batch_mrp_inr) * 100 : mrpPrice * 100
        const batchCost = row.batch_purchase_price_inr ? Number(row.batch_purchase_price_inr) * 100 : null

        await batchService.createBatches({
          product_variant_id: variantId,
          product_id: product.id,
          lot_number: row.batch_lot_number,
          manufactured_on: row.batch_manufactured_on || null,
          expiry_date: row.batch_expiry_date,
          received_quantity: stockQty,
          available_quantity: stockQty,
          reserved_quantity: 0,
          batch_mrp_paise: batchMrp,
          purchase_price_paise: batchCost,
          location_id: locationId,
          supplier_name: row.batch_supplier || row.manufacturer || null,
          grn_number: row.batch_grn_number || null,
          received_on: new Date().toISOString(),
          status: "active",
          metadata: { source: "seed:005" },
        })
      }

      existingByHandle.set(handle, product.id)
      created++

      if (created % 10 === 0) {
        logger.info(`005: progress — ${created} created, ${skipped} skipped`)
      }
    } catch (err: any) {
      logger.error(`005: FAILED "${row.brand_name}": ${err.message}`)
      throw err // Let Medusa retry next deploy
    }
  }

  logger.info(`005: done. Created ${created} products, skipped ${skipped} existing.`)
}
