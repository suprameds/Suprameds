/**
 * Suprameds — Fresh Data Import Script
 *
 * Reads all 4 CSV files from apps/backend/data/ and imports them using the
 * same service calls and workflows as the admin API routes.
 *
 * What it imports:
 *   1. Products  — products.csv  (Medusa products + pharma drug metadata + inventory + batches)
 *   2. Customers — customers.csv (customer accounts + addresses)
 *   3. Pincodes  — pincodes.csv  (serviceable pincode database)
 *   4. Inventory — inventory.csv (additional stock levels / batch data for existing SKUs)
 *
 * Usage:
 *   npx medusa exec ./src/scripts/import-fresh-data.ts
 *   npx medusa exec ./src/scripts/import-fresh-data.ts -- --skip-products
 *   npx medusa exec ./src/scripts/import-fresh-data.ts -- --skip-customers --skip-pincodes
 *   npx medusa exec ./src/scripts/import-fresh-data.ts -- --only-products
 *   npx medusa exec ./src/scripts/import-fresh-data.ts -- --only-customers
 *
 * Flags:
 *   --skip-products    Skip product import
 *   --skip-customers   Skip customer import
 *   --skip-pincodes    Skip pincode import
 *   --skip-inventory   Skip inventory top-up
 *   --only-products    Import only products
 *   --only-customers   Import only customers
 *   --only-pincodes    Import only pincodes
 *   --only-inventory   Import only inventory
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
  createCustomersWorkflow,
  createCustomerAddressesWorkflow,
} from "@medusajs/medusa/core-flows"
import { PHARMA_MODULE } from "../modules/pharma"
import { INVENTORY_BATCH_MODULE } from "../modules/inventoryBatch"
import { WAREHOUSE_MODULE } from "../modules/warehouse"
import * as fs from "fs"
import * as path from "path"

// ── CSV Parsing ──────────────────────────────────────────────────────

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
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || "").trim()
    })
    rows.push(row)
  }
  return rows
}

// ── Helpers ──────────────────────────────────────────────────────────

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

function makeSku(handle: string): string {
  return `SUPRA-${handle.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`.slice(0, 48)
}

function toBool(val: string | undefined): boolean {
  if (!val) return false
  return val.trim().toLowerCase() === "true" || val.trim() === "1" || val.trim().toLowerCase() === "yes"
}

function readCSV(filePath: string): Record<string, string>[] | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8")
    return parseCSV(content)
  } catch {
    return null
  }
}

// ── 1. Product Import ────────────────────────────────────────────────

async function importProducts(
  container: MedusaContainer,
  rows: Record<string, string>[],
  logger: any
) {
  logger.info(`\n${"=".repeat(56)}`)
  logger.info("  STEP 1: PRODUCTS")
  logger.info(`${"=".repeat(56)}`)
  logger.info(`  Rows to process: ${rows.length}`)

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const pharmaService = container.resolve(PHARMA_MODULE) as any
  const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
  const fulfillmentService = container.resolve(ModuleRegistrationName.FULFILLMENT) as any
  const salesChannelService = container.resolve(ModuleRegistrationName.SALES_CHANNEL) as any

  // Prerequisites
  const [defaultSalesChannel] = await salesChannelService.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (!defaultSalesChannel?.id) {
    logger.error("  [products] Default Sales Channel not found. Run db:setup first.")
    return { created: 0, skipped: 0, errors: rows.length }
  }

  const [shippingProfile] = await fulfillmentService.listShippingProfiles({ type: "default" })
  if (!shippingProfile?.id) {
    logger.error("  [products] Default shipping profile not found. Run db:setup first.")
    return { created: 0, skipped: 0, errors: rows.length }
  }

  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const stockLocation = (stockLocations as any[])?.[0]
  if (!stockLocation?.id) {
    logger.error("  [products] No stock location found. Run db:setup first.")
    return { created: 0, skipped: 0, errors: rows.length }
  }

  // Existing lookups
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
  })
  const existingByHandle = new Map<string, string>(
    (existingProducts as any[]).map((p) => [p.handle, p.id])
  )

  const { data: cats } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
  })
  const categoryByHandle = new Map<string, any>(
    (cats as any[]).map((c) => [c.handle, c])
  )

  const { data: collections } = await query.graph({
    entity: "product_collection",
    fields: ["id", "title", "handle"],
  })
  const collectionByTitle = new Map<string, any>(
    (collections as any[]).map((c) => [c.title, c])
  )
  const collectionByHandle = new Map<string, any>(
    (collections as any[]).map((c) => [c.handle, c])
  )

  const { data: tags } = await query.graph({
    entity: "product_tag",
    fields: ["id", "value"],
  })
  const tagByValue = new Map<string, any>((tags as any[]).map((t) => [t.value, t]))

  let created = 0
  let skipped = 0
  let errors = 0

  for (const row of rows) {
    if (!row.brand_name) {
      skipped++
      continue
    }

    const handle = slugify(row.brand_name)
    const sku = makeSku(handle)

    try {
      if (existingByHandle.has(handle)) {
        logger.info(`  [products] SKIP (exists): ${row.brand_name}`)
        skipped++
        continue
      }

      const sellingPrice = Number(row.selling_price_inr) || 1
      const mrpPrice = Number(row.mrp_inr) || sellingPrice

      // Resolve category
      const category = row.category
        ? categoryByHandle.get(slugify(row.category)) || categoryByHandle.get(row.category)
        : null

      // Resolve collection
      const collection = row.collection
        ? collectionByTitle.get(row.collection) || collectionByHandle.get(slugify(row.collection))
        : null

      // Resolve tags
      const tagValues = row.tags ? row.tags.split(";").map((t: string) => t.trim()).filter(Boolean) : []
      const tagIds = tagValues.map((tv: string) => tagByValue.get(tv)?.id).filter(Boolean)

      const description = row.description ||
        `${row.brand_name} — ${row.composition || row.generic_name}. ${row.pack_size || ""} ${row.dosage_form || ""}`.trim()

      // Create product
      const { result: createdProducts } = await createProductsWorkflow(container).run({
        input: {
          products: [{
            title: row.brand_name,
            handle,
            description,
            status: "published",
            sales_channels: [{ id: defaultSalesChannel.id }],
            collection_id: collection?.id,
            tag_ids: tagIds,
            options: [{ title: "Pack", values: ["default"] }],
            variants: [{
              title: row.brand_name,
              sku,
              options: { Pack: "default" },
              prices: [{ currency_code: "inr", amount: sellingPrice }],
              manage_inventory: true,
              allow_backorder: false,
            }],
            shipping_profile_id: shippingProfile.id,
            metadata: { source: "fresh-data-import", pharma: true, manufacturer: row.manufacturer || null },
          }],
        },
      })

      const product = (createdProducts as any[])[0]
      if (!product?.id) {
        logger.error(`  [products] Failed to create: ${row.brand_name}`)
        errors++
        continue
      }

      existingByHandle.set(handle, product.id)

      // Get variant
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
              creates: [{
                inventory_item_id: invItem.id,
                location_id: stockLocation.id,
                stocked_quantity: stockQty,
              }],
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
        metadata: { source: "fresh-data-import", manufacturer: row.manufacturer || null },
      })

      // Create inventory batch if lot data provided
      if (row.batch_lot_number && row.batch_expiry_date && variant?.id) {
        const batchQty = Number(row.stock_qty) || 50
        const batchMrp = row.batch_mrp_inr ? Number(row.batch_mrp_inr) * 100 : mrpPrice * 100
        const batchPurchase = row.batch_purchase_price_inr
          ? Number(row.batch_purchase_price_inr) * 100
          : null

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
          metadata: { source: "fresh-data-import" },
        })
        logger.info(`  [products]   -> Batch ${row.batch_lot_number} (exp: ${row.batch_expiry_date})`)
      }

      logger.info(`  [products] CREATED: ${row.brand_name}`)
      created++
    } catch (err: any) {
      logger.error(`  [products] ERROR (${row.brand_name}): ${err?.message || String(err)}`)
      errors++
    }
  }

  return { created, skipped, errors }
}

// ── 2. Customer Import ───────────────────────────────────────────────

async function importCustomers(
  container: MedusaContainer,
  rows: Record<string, string>[],
  logger: any
) {
  logger.info(`\n${"=".repeat(56)}`)
  logger.info("  STEP 2: CUSTOMERS")
  logger.info(`${"=".repeat(56)}`)
  logger.info(`  Rows to process: ${rows.length}`)

  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // Fetch existing customers to detect duplicates
  const { data: existingCustomers } = await query.graph({
    entity: "customer",
    fields: ["id", "email"],
  })
  const existingEmails = new Set(
    (existingCustomers as any[]).map((c) => c.email?.toLowerCase())
  )

  let created = 0
  let skipped = 0
  let errors = 0

  for (const raw of rows) {
    // Normalize — support both header formats (Title Case and snake_case)
    const email = (raw["Email"] || raw["email"] || "").trim().toLowerCase()
    const firstName = (raw["First Name"] || raw["first_name"] || "").trim()
    const lastName = (raw["Last Name"] || raw["last_name"] || "").trim()
    const phone = (raw["Phone"] || raw["phone"] || "").trim() || undefined
    const hasAccount = (raw["Has Account"] || raw["has_account"] || "").trim()

    if (!email || !firstName || !lastName) {
      logger.warn(`  [customers] SKIP (missing required fields): ${email || "(no email)"}`)
      errors++
      continue
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      logger.warn(`  [customers] SKIP (invalid email): ${email}`)
      errors++
      continue
    }

    if (existingEmails.has(email)) {
      logger.info(`  [customers] SKIP (exists): ${email}`)
      skipped++
      continue
    }

    try {
      const { result: customers } = await createCustomersWorkflow(container).run({
        input: {
          customersData: [{
            email,
            first_name: firstName,
            last_name: lastName,
            phone,
            has_account: hasAccount === "true" || hasAccount === "1",
          }],
        },
      })

      const customer = customers[0]

      // Create address if provided
      const addr1 = (raw["Address 1"] || raw["address_1"] || "").trim()
      const countryCode = (raw["Address Country Code"] || raw["address_country_code"] || "").trim()

      if (addr1 && countryCode && customer?.id) {
        try {
          await createCustomerAddressesWorkflow(container).run({
            input: {
              addresses: [{
                customer_id: customer.id,
                first_name: (raw["Address First Name"] || raw["address_first_name"] || "").trim() || firstName,
                last_name: (raw["Address Last Name"] || raw["address_last_name"] || "").trim() || lastName,
                company: (raw["Address Company"] || raw["address_company"] || "").trim() || undefined,
                address_1: addr1,
                address_2: (raw["Address 2"] || raw["address_2"] || "").trim() || undefined,
                city: (raw["Address City"] || raw["address_city"] || "").trim() || undefined,
                province: (raw["Address Province"] || raw["address_province"] || "").trim() || undefined,
                country_code: countryCode,
                postal_code: (raw["Address Postal Code"] || raw["address_postal_code"] || "").trim() || undefined,
                phone: (raw["Address Phone"] || raw["address_phone"] || "").trim() || phone,
              }],
            },
          })
        } catch (addrErr: any) {
          logger.warn(`  [customers] Address failed for ${email}: ${addrErr?.message}`)
        }
      }

      existingEmails.add(email)
      created++
      logger.info(`  [customers] CREATED: ${email}`)
    } catch (err: any) {
      logger.error(`  [customers] ERROR (${email}): ${err?.message || String(err)}`)
      errors++
    }
  }

  return { created, skipped, errors }
}

// ── 3. Pincode Import ────────────────────────────────────────────────

async function importPincodes(
  container: MedusaContainer,
  rows: Record<string, string>[],
  logger: any
) {
  logger.info(`\n${"=".repeat(56)}`)
  logger.info("  STEP 3: PINCODES")
  logger.info(`${"=".repeat(56)}`)
  logger.info(`  Rows to process: ${rows.length}`)

  const warehouseService = container.resolve(WAREHOUSE_MODULE) as any

  // Clear existing pincodes for fresh import
  try {
    const existing = (await warehouseService.listServiceablePincodes(
      {},
      { take: null, select: ["id"] }
    )) as any[]

    if (existing.length > 0) {
      const ids = existing.map((r: any) => r.id)
      for (let i = 0; i < ids.length; i += 50) {
        await warehouseService.deleteServiceablePincodes(ids.slice(i, i + 50))
        if (i + 50 < ids.length) await new Promise((r) => setTimeout(r, 500))
      }
      logger.info(`  [pincodes] Cleared ${existing.length} existing records`)
    }
  } catch (err: any) {
    logger.warn(`  [pincodes] Could not clear existing records: ${err?.message}`)
  }

  let imported = 0
  let skipped = 0

  const toCreate: any[] = []

  for (const row of rows) {
    const pincode = String(row.pincode ?? "").trim()
    if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
      skipped++
      continue
    }
    toCreate.push({
      pincode,
      officename: String(row.officename ?? "").trim() || "Unknown",
      officetype: row.officetype?.trim() || null,
      delivery: String(row.delivery ?? "").trim() || "Non Delivery",
      district: String(row.district ?? "").trim() || "Unknown",
      statename: String(row.statename ?? "").trim() || "Unknown",
      divisionname: row.divisionname?.trim() || null,
      regionname: row.regionname?.trim() || null,
      circlename: row.circlename?.trim() || null,
      latitude: (row.latitude?.trim() === "NA" || !row.latitude?.trim()) ? null : row.latitude.trim(),
      longitude: (row.longitude?.trim() === "NA" || !row.longitude?.trim()) ? null : row.longitude.trim(),
      is_serviceable: String(row.delivery ?? "").trim().toLowerCase() === "delivery",
    })
  }

  // Insert in small sub-batches with generous delays for managed Redis
  if (toCreate.length > 0) {
    const SUB_BATCH = 25
    for (let i = 0; i < toCreate.length; i += SUB_BATCH) {
      try {
        await warehouseService.createServiceablePincodes(toCreate.slice(i, i + SUB_BATCH))
        if (i + SUB_BATCH < toCreate.length) {
          await new Promise((r) => setTimeout(r, 500))
        }
      } catch (err: any) {
        // Retry once after longer pause (Lua limit recovery)
        try {
          await new Promise((r) => setTimeout(r, 2000))
          await warehouseService.createServiceablePincodes(toCreate.slice(i, i + SUB_BATCH))
        } catch {
          logger.error(`  [pincodes] Batch insert failed at offset ${i}: ${err?.message}`)
          skipped += Math.min(SUB_BATCH, toCreate.length - i)
          continue
        }
      }
    }
    imported = toCreate.length
  }

  logger.info(`  [pincodes] Imported: ${imported}, Skipped: ${skipped}`)
  return { created: imported, skipped, errors: 0 }
}

// ── 4. Inventory Top-up ──────────────────────────────────────────────

async function importInventory(
  container: MedusaContainer,
  rows: Record<string, string>[],
  logger: any
) {
  logger.info(`\n${"=".repeat(56)}`)
  logger.info("  STEP 4: INVENTORY TOP-UP")
  logger.info(`${"=".repeat(56)}`)
  logger.info(`  Rows to process: ${rows.length}`)

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any

  // Build SKU -> variant lookup
  const { data: allVariants } = await query.graph({
    entity: "variant",
    fields: ["id", "sku", "product_id"],
  })
  const variantBySku = new Map<string, any>(
    (allVariants as any[]).filter((v) => v.sku).map((v) => [v.sku, v])
  )

  // Stock location
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id"],
  })
  const stockLocation = (stockLocations as any[])?.[0]

  if (!stockLocation?.id) {
    logger.error("  [inventory] No stock location found. Run db:setup first.")
    return { created: 0, skipped: rows.length, errors: 0 }
  }

  let created = 0
  let skipped = 0
  let errors = 0

  for (const row of rows) {
    const sku = (row.sku || "").trim()
    if (!sku) {
      skipped++
      continue
    }

    const variant = variantBySku.get(sku)
    if (!variant) {
      logger.warn(`  [inventory] SKIP (no matching variant): ${sku}`)
      skipped++
      continue
    }

    const lotNumber = (row.lot_number || row.batch_number || "").trim()
    const expiryDate = (row.expiry_date || "").trim()

    if (!lotNumber || !expiryDate) {
      logger.warn(`  [inventory] SKIP (missing lot/expiry): ${sku}`)
      skipped++
      continue
    }

    try {
      const qty = Number(row.stocked_quantity) || 50
      const mrpPaise = row.mrp ? Number(row.mrp) * 100 : null
      const costPaise = row.cost_price ? Number(row.cost_price) * 100 : null

      await batchService.createBatches({
        product_variant_id: variant.id,
        product_id: variant.product_id,
        lot_number: lotNumber,
        manufactured_on: (row.manufactured_date || "").trim() || null,
        expiry_date: expiryDate,
        received_quantity: qty,
        available_quantity: qty,
        reserved_quantity: 0,
        batch_mrp_paise: mrpPaise,
        purchase_price_paise: costPaise,
        location_id: stockLocation.id,
        supplier_name: null,
        grn_number: null,
        received_on: new Date().toISOString(),
        status: "active",
        metadata: { source: "fresh-data-import" },
      })

      logger.info(`  [inventory] CREATED batch: ${sku} / ${lotNumber}`)
      created++
    } catch (err: any) {
      logger.error(`  [inventory] ERROR (${sku}): ${err?.message || String(err)}`)
      errors++
    }
  }

  return { created, skipped, errors }
}

// ── Main ─────────────────────────────────────────────────────────────

export default async function importFreshData({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const args = process.argv

  // Determine which steps to run
  const hasOnly = args.some((a) => a.startsWith("--only-"))
  const shouldRun = (step: string) => {
    if (hasOnly) return args.includes(`--only-${step}`)
    return !args.includes(`--skip-${step}`)
  }

  const dataDir = path.resolve(__dirname, "../../data")

  logger.info("")
  logger.info("  ========================================================")
  logger.info("       SUPRAMEDS  --  Fresh Data Import")
  logger.info("  ========================================================")
  logger.info(`  Data directory: ${dataDir}`)
  logger.info("")

  // Check which files exist
  const files = {
    products: path.join(dataDir, "products.csv"),
    customers: path.join(dataDir, "customers.csv"),
    pincodes: path.join(dataDir, "pincodes.csv"),
    inventory: path.join(dataDir, "inventory.csv"),
  }

  for (const [name, filePath] of Object.entries(files)) {
    const exists = fs.existsSync(filePath)
    const skip = !shouldRun(name)
    logger.info(`  ${exists ? "[OK]" : "[--]"} ${name}.csv ${skip ? "(skipped by flag)" : exists ? "" : "(not found)"}`)
  }

  const summary: Record<string, { created: number; skipped: number; errors: number }> = {}

  // Step 1: Products
  if (shouldRun("products")) {
    const rows = readCSV(files.products)
    if (rows && rows.length > 0) {
      summary.products = await importProducts(container, rows, logger)
    } else {
      logger.warn("  [products] No data found or file missing — skipping")
    }
  }

  // Step 2: Customers
  if (shouldRun("customers")) {
    const rows = readCSV(files.customers)
    if (rows && rows.length > 0) {
      summary.customers = await importCustomers(container, rows, logger)
    } else {
      logger.warn("  [customers] No data found or file missing — skipping")
    }
  }

  // Step 3: Pincodes
  if (shouldRun("pincodes")) {
    const rows = readCSV(files.pincodes)
    if (rows && rows.length > 0) {
      summary.pincodes = await importPincodes(container, rows, logger)
    } else {
      logger.warn("  [pincodes] No data found or file missing — skipping")
    }
  }

  // Step 4: Inventory top-up
  if (shouldRun("inventory")) {
    const rows = readCSV(files.inventory)
    if (rows && rows.length > 0) {
      summary.inventory = await importInventory(container, rows, logger)
    } else {
      logger.warn("  [inventory] No data found or file missing — skipping")
    }
  }

  // Final summary
  logger.info("")
  logger.info("  ========================================================")
  logger.info("       IMPORT COMPLETE")
  logger.info("  ========================================================")

  let totalCreated = 0
  let totalSkipped = 0
  let totalErrors = 0

  for (const [step, stats] of Object.entries(summary)) {
    logger.info(`  ${step.padEnd(12)} | created: ${stats.created}, skipped: ${stats.skipped}, errors: ${stats.errors}`)
    totalCreated += stats.created
    totalSkipped += stats.skipped
    totalErrors += stats.errors
  }

  logger.info("  " + "-".repeat(54))
  logger.info(`  ${"TOTAL".padEnd(12)} | created: ${totalCreated}, skipped: ${totalSkipped}, errors: ${totalErrors}`)
  logger.info("")

  if (totalErrors > 0) {
    logger.warn("  Some rows failed. Check logs above for details.")
  } else {
    logger.info("  All data imported successfully!")
  }
}
