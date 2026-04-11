/**
 * Import Vyapar Batch Report into the batch system.
 *
 * Parses the extracted text from Vyapar's "Item Batch Report" PDF and
 * calls the batch import API endpoint.
 *
 * Usage: npx medusa exec ./src/scripts/import-vyapar-batches.ts
 *
 * Or run directly with the parsed data already in a JSON file.
 */

// ── Vyapar Batch Report Parser ──

const VYAPAR_RAW_TEXT = `ACEBROCYN 100 GC5834C 30/11/2026 108
ACEBROCYN 200 CCT25106 31/12/2026 80
ACEDAX 1000 MT-252104 30/11/2027 34
ACEDAX 500 MT-241974 31/07/2026 26
ACEDAX 500 MT-251660 31/08/2027 12
ACEPRA TG25-2131E 31/10/2027 7
ACEPRA-S BMT-084A 30/09/2026 7
ALKAMOF-B6 SL-241264 31/01/2027 8
ALREX-D ARL-032517E 28/02/2027 9
ALREX-LS (SF) SYP ARL-072531B 30/06/2027 10
ALREX-LS (SF) SYP ARL-042505 31/03/2027 2
AMICYN-5 BMT-139 30/11/2026 22`
// NOTE: Full data would be pasted here from the PDF extraction.
// For now, this is a sample. The actual import uses the API endpoint
// with the full parsed JSON.

interface VyaparBatchRecord {
  product_name: string
  batch_no: string
  expiry_date: string
  quantity: number
}

/**
 * Parse Vyapar batch report text into structured records.
 *
 * Format: "ITEM NAME BATCH_NO DD/MM/YYYY QUANTITY"
 * Challenge: item names can contain spaces and numbers,
 * so we parse from the RIGHT (quantity, date, batch_no are predictable).
 */
export function parseVyaparBatchReport(text: string): VyaparBatchRecord[] {
  const records: VyaparBatchRecord[] = []
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l)

  // Skip header lines
  const headerPatterns = ["Item Name", "Batch No", "Exp. Date", "Current Quantity"]

  for (const line of lines) {
    // Skip headers
    if (headerPatterns.some((h) => line.includes(h))) continue
    // Skip empty/short lines
    if (line.length < 10) continue

    // Parse from right: quantity (number), date (DD/MM/YYYY), batch_no, then item name
    // Example: "ACEBROCYN 100 GC5834C 30/11/2026 108"

    const match = line.match(
      /^(.+?)\s+(\S+)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(-?\d+\.?\d*)$/
    )

    if (match) {
      const [, productName, batchNo, expiryDate, qty] = match
      records.push({
        product_name: productName.trim(),
        batch_no: batchNo.trim(),
        expiry_date: expiryDate.trim(),
        quantity: parseFloat(qty),
      })
    }
  }

  return records
}

// ── Main execution ──

export default async function importVyaparBatches({ container }: { container: any }) {
  const logger = container.resolve("logger") as any

  logger.info("[vyapar-import] Parsing Vyapar batch report...")

  const records = parseVyaparBatchReport(VYAPAR_RAW_TEXT)
  logger.info(`[vyapar-import] Parsed ${records.length} batch records`)

  if (records.length === 0) {
    logger.warn("[vyapar-import] No records parsed. Check the raw text data.")
    return
  }

  // Call the batch import endpoint logic directly
  const batchService = container.resolve("pharmaInventoryBatch") as any
  const query = container.resolve("query")

  // Load products
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "variants.id"],
    filters: { status: "published" },
  })

  logger.info(`[vyapar-import] Loaded ${products?.length || 0} products for matching`)

  // Build lookup
  const productMap = new Map<string, { id: string; variantId: string; title: string }>()
  for (const p of products || []) {
    const variantId = p.variants?.[0]?.id
    if (!variantId) continue
    const entry = { id: p.id, variantId, title: p.title }

    // Multiple normalization keys
    const norm = p.title.toUpperCase().replace(/-(\d)/g, " $1").replace(/\s+/g, " ").trim()
    productMap.set(norm, entry)
    productMap.set(p.title.toUpperCase().replace(/\s+/g, " ").trim(), entry)

    // Flat version
    const flat = norm.replace(/[\s\-]+/g, "")
    productMap.set(flat, entry)
  }

  // Load MRP data
  const pharmaService = container.resolve("pharmaCore") as any
  const drugProducts = await pharmaService.listDrugProducts({})
  const mrpMap = new Map<string, number>()
  for (const dp of drugProducts || []) {
    if (dp.product_id && dp.mrp_paise) mrpMap.set(dp.product_id, Number(dp.mrp_paise))
  }

  // Load existing for dedup
  const existingBatches = new Set<string>()
  const allBatches = await batchService.listBatches({}, { take: null })
  for (const b of allBatches || []) {
    existingBatches.add(`${b.product_variant_id}|${b.lot_number}`)
  }

  // Process records
  let created = 0
  let skipped = 0
  let notMatched = 0
  let errors = 0
  const today = new Date()
  const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

  for (const rec of records) {
    const norm = rec.product_name.toUpperCase().replace(/-(\d)/g, " $1").replace(/\s+/g, " ").trim()
    let product = productMap.get(norm)

    if (!product) {
      const flat = norm.replace(/[\s\-]+/g, "")
      for (const [key, val] of productMap) {
        if (key.replace(/[\s\-]+/g, "") === flat) {
          product = val
          break
        }
      }
    }

    if (!product) {
      notMatched++
      continue
    }

    // Dedup check
    if (existingBatches.has(`${product.variantId}|${rec.batch_no}`)) {
      skipped++
      continue
    }

    // Parse date
    const [day, month, year] = rec.expiry_date.split("/").map(Number)
    const expiryDate = new Date(year, month - 1, day)
    if (isNaN(expiryDate.getTime())) {
      errors++
      continue
    }

    // Status
    let status: "active" | "quarantine" | "expired" = "active"
    if (expiryDate <= today) status = "expired"
    else if (expiryDate <= thirtyDays) status = "quarantine"

    const qty = Math.max(0, rec.quantity)

    try {
      const batch = await batchService.createBatches({
        product_variant_id: product.variantId,
        product_id: product.id,
        lot_number: rec.batch_no,
        expiry_date: expiryDate.toISOString(),
        received_quantity: qty,
        available_quantity: qty,
        reserved_quantity: 0,
        batch_mrp_paise: mrpMap.get(product.id) || null,
        status,
        received_on: new Date().toISOString(),
      })

      await batchService.createBatchAuditLogs({
        batch_id: batch.id,
        action: "created",
        new_value: `lot=${rec.batch_no} qty=${qty} exp=${rec.expiry_date} status=${status}`,
        actor_id: "vyapar-import",
        actor_type: "system",
        reason: "Vyapar batch report import",
      })

      existingBatches.add(`${product.variantId}|${rec.batch_no}`)
      created++
    } catch (err: any) {
      errors++
      logger.error(`[vyapar-import] Failed: ${rec.product_name} ${rec.batch_no}: ${err?.message}`)
    }
  }

  logger.info(
    `[vyapar-import] Complete: ${created} created, ${skipped} skipped, ` +
    `${notMatched} not matched, ${errors} errors`
  )
}
