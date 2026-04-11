import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { INVENTORY_BATCH_MODULE } from "../../../../../modules/inventoryBatch"

/**
 * POST /admin/pharma/batches/import
 *
 * Bulk import batches from CSV/JSON data.
 *
 * Body: { batches: Array<{ product_name, batch_no, expiry_date, quantity, mrp?, purchase_price?, supplier? }> }
 *
 * Matches product_name to existing products, creates Batch records,
 * and returns a detailed report of matched/created/skipped/errors.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const batchService = req.scope.resolve(INVENTORY_BATCH_MODULE) as any
  const actorId = (req as any).auth_context?.actor_id || "import"

  const { batches: inputBatches } = req.body as {
    batches: Array<{
      product_name: string
      batch_no: string
      expiry_date: string
      quantity: number
      mrp?: number
      purchase_price?: number
      supplier?: string
      grn_number?: string
    }>
  }

  if (!inputBatches || !Array.isArray(inputBatches) || inputBatches.length === 0) {
    return res.status(400).json({ message: "Body must contain a non-empty 'batches' array" })
  }

  logger.info(`[batch-import] Starting import of ${inputBatches.length} batch records`)

  // ── 1. Load all published products with their variants and drug metadata ──

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "variants.id"],
    filters: { status: "published" },
  }) as any

  // Build lookup maps for name matching
  const productMap = new Map<string, { id: string; title: string; variantId: string }>()

  for (const p of products || []) {
    const variantId = p.variants?.[0]?.id
    if (!variantId) continue

    const entry = { id: p.id, title: p.title, variantId }

    // Multiple normalization keys for matching
    const keys = [
      normalize(p.title),
      normalize(p.handle?.replace(/-/g, " ") || ""),
      // Original uppercase version (for Vyapar names)
      p.title.toUpperCase().replace(/\s+/g, " ").trim(),
    ]

    for (const key of keys) {
      if (key && !productMap.has(key)) {
        productMap.set(key, entry)
      }
    }
  }

  // Load drug_product for MRP lookup
  const drugProductMap = new Map<string, number>() // productId → mrp_paise
  try {
    const pharmaService = req.scope.resolve("pharmaCore") as any
    const drugProducts = await pharmaService.listDrugProducts({})
    for (const dp of drugProducts || []) {
      if (dp.product_id && dp.mrp_paise) {
        drugProductMap.set(dp.product_id, Number(dp.mrp_paise))
      }
    }
  } catch {
    logger.warn("[batch-import] Could not load drug_product data for MRP lookup")
  }

  // Load existing batches for deduplication
  const existingBatches = new Set<string>()
  try {
    const allBatches = await batchService.listBatches({}, { take: null })
    for (const b of allBatches || []) {
      existingBatches.add(`${b.product_variant_id}|${b.lot_number}`)
    }
  } catch {
    logger.warn("[batch-import] Could not load existing batches for dedup check")
  }

  // ── 2. Process each input batch record ──

  const results = {
    total: inputBatches.length,
    created: 0,
    skipped: 0,
    not_matched: 0,
    errors: 0,
    details: [] as Array<{
      product_name: string
      batch_no: string
      status: "created" | "skipped" | "not_matched" | "error"
      message: string
      product_id?: string
    }>,
  }

  const today = new Date()
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

  for (const input of inputBatches) {
    const { product_name, batch_no, expiry_date, quantity } = input

    if (!product_name || !batch_no || !expiry_date || quantity == null) {
      results.errors++
      results.details.push({
        product_name: product_name || "?",
        batch_no: batch_no || "?",
        status: "error",
        message: "Missing required fields: product_name, batch_no, expiry_date, quantity",
      })
      continue
    }

    // ── Match product ──
    const normalizedName = normalize(product_name)
    let product = productMap.get(normalizedName)

    // Fallback: try without hyphens/spaces
    if (!product) {
      const flat = normalizedName.replace(/[\s\-]+/g, "")
      for (const [key, val] of productMap) {
        if (key.replace(/[\s\-]+/g, "") === flat) {
          product = val
          break
        }
      }
    }

    if (!product) {
      results.not_matched++
      results.details.push({
        product_name,
        batch_no,
        status: "not_matched",
        message: `No matching product found for "${product_name}"`,
      })
      continue
    }

    // ── Check for duplicates ──
    const dedupKey = `${product.variantId}|${batch_no}`
    if (existingBatches.has(dedupKey)) {
      results.skipped++
      results.details.push({
        product_name,
        batch_no,
        status: "skipped",
        message: `Batch "${batch_no}" already exists for ${product.title}`,
        product_id: product.id,
      })
      continue
    }

    // ── Parse expiry date ──
    const expiryDate = parseDate(expiry_date)
    if (!expiryDate) {
      results.errors++
      results.details.push({
        product_name,
        batch_no,
        status: "error",
        message: `Invalid expiry date format: "${expiry_date}"`,
      })
      continue
    }

    // ── Determine batch status ──
    let batchStatus: "active" | "quarantine" | "expired" = "active"
    if (expiryDate <= today) {
      batchStatus = "expired"
    } else if (expiryDate <= thirtyDaysFromNow) {
      batchStatus = "quarantine"
    }

    // ── Get MRP from drug_product ──
    const mrpPaise = input.mrp
      ? Math.round(input.mrp * 100)
      : drugProductMap.get(product.id) || null

    // ── Create batch ──
    try {
      const qty = Math.max(0, Number(quantity)) // No negative quantities
      const batch = await batchService.createBatches({
        product_variant_id: product.variantId,
        product_id: product.id,
        lot_number: batch_no,
        expiry_date: expiryDate.toISOString(),
        received_quantity: qty,
        available_quantity: qty,
        reserved_quantity: 0,
        batch_mrp_paise: mrpPaise,
        purchase_price_paise: input.purchase_price ? Math.round(input.purchase_price * 100) : null,
        supplier_name: input.supplier || null,
        grn_number: input.grn_number || null,
        received_on: new Date().toISOString(),
        status: batchStatus,
      })

      // Audit log
      try {
        await batchService.createBatchAuditLogs({
          batch_id: batch.id,
          action: "created",
          field_name: null,
          old_value: null,
          new_value: `lot=${batch_no} qty=${qty} exp=${expiry_date} status=${batchStatus}`,
          actor_id: actorId,
          actor_type: "admin",
          reason: "CSV/Vyapar batch import",
        })
      } catch {
        // Non-fatal: audit log failure shouldn't block import
      }

      existingBatches.add(dedupKey) // Prevent duplicates within same import
      results.created++
      results.details.push({
        product_name,
        batch_no,
        status: "created",
        message: `Created: ${product.title} | ${batch_no} | ${batchStatus} | qty=${qty}`,
        product_id: product.id,
      })
    } catch (err: any) {
      results.errors++
      results.details.push({
        product_name,
        batch_no,
        status: "error",
        message: `Failed to create batch: ${err?.message || "Unknown error"}`,
        product_id: product.id,
      })
    }
  }

  logger.info(
    `[batch-import] Complete: ${results.created} created, ${results.skipped} skipped, ` +
    `${results.not_matched} not matched, ${results.errors} errors`
  )

  return res.json(results)
}

// ── Helpers ──

function normalize(name: string): string {
  return name
    .toUpperCase()
    .replace(/\s*-\s*/g, "-")
    .replace(/-(\d)/g, " $1") // hyphen before number → space
    .replace(/\s+/g, " ")
    .trim()
}

function parseDate(dateStr: string): Date | null {
  // Try DD/MM/YYYY
  const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy
    const d = new Date(Number(year), Number(month) - 1, Number(day))
    return isNaN(d.getTime()) ? null : d
  }

  // Try YYYY-MM-DD
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? null : d
  }

  // Try MM/YYYY (use last day of month)
  const mmyyyy = dateStr.match(/^(\d{1,2})\/(\d{4})$/)
  if (mmyyyy) {
    const [, month, year] = mmyyyy
    const d = new Date(Number(year), Number(month), 0) // Last day of month
    return isNaN(d.getTime()) ? null : d
  }

  // Fallback: let JS parse it
  const fallback = new Date(dateStr)
  return isNaN(fallback.getTime()) ? null : fallback
}
