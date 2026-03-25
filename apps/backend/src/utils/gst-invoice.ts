import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const LOG_PREFIX = "[invoice]"

// ── Interfaces ────────────────────────────────────────────────────────

export interface InvoiceLineItem {
  product_title: string
  generic_name: string
  hsn_code: string
  batch_number: string
  expiry_date: string
  quantity: number
  unit_mrp: number
  unit_selling_price: number
  discount_amount: number
  taxable_value: number
  gst_rate: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  line_total: number
}

export interface GstInvoice {
  invoice_number: string
  invoice_date: string
  // Seller
  seller_name: string
  seller_gstin: string
  seller_address: string
  seller_state: string
  seller_dl_number: string
  // Buyer
  buyer_name: string
  buyer_address: string
  buyer_state: string
  buyer_gstin?: string
  // Transaction
  is_intra_state: boolean
  place_of_supply: string
  // Items
  items: InvoiceLineItem[]
  // Totals
  subtotal: number
  total_discount: number
  total_taxable_value: number
  total_cgst: number
  total_sgst: number
  total_igst: number
  total_gst: number
  grand_total: number
  amount_in_words: string
  // Payment
  payment_mode: string
  // References
  prescription_ref?: string
  supply_memo_number?: string
}

// ── Number-to-Words (Indian system) ──────────────────────────────────

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
]

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
]

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n]
  const t = TENS[Math.floor(n / 10)]
  const o = ONES[n % 10]
  return o ? `${t}-${o}` : t
}

/**
 * Convert amount to Indian number words.
 * Handles up to ₹99,99,999 (Ninety-Nine Lakh Ninety-Nine Thousand ...).
 */
export function amountInWords(amount: number): string {
  if (amount <= 0) return "Zero Rupees Only"

  let n = Math.floor(amount)
  const parts: string[] = []

  if (n >= 10000000) {
    parts.push(twoDigitWords(Math.floor(n / 10000000)) + " Crore")
    n %= 10000000
  }

  if (n >= 100000) {
    parts.push(twoDigitWords(Math.floor(n / 100000)) + " Lakh")
    n %= 100000
  }

  if (n >= 1000) {
    parts.push(twoDigitWords(Math.floor(n / 1000)) + " Thousand")
    n %= 1000
  }

  if (n >= 100) {
    parts.push(ONES[Math.floor(n / 100)] + " Hundred")
    n %= 100
  }

  if (n > 0) {
    parts.push(twoDigitWords(n))
  }

  return parts.join(" ") + " Rupees Only"
}

// ── Helpers ───────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function formatAddress(addr: Record<string, any> | null | undefined): string {
  if (!addr) return ""
  return [
    addr.address_1,
    addr.address_2,
    addr.city,
    addr.province,
    addr.postal_code,
    addr.country_code?.toUpperCase(),
  ]
    .filter(Boolean)
    .join(", ")
}

// In-process counter to avoid collisions within the same millisecond
let _seqCounter = 0

/**
 * Generate sequential invoice number: INV-YYYY-XXXXXX.
 * Uses timestamp + in-process counter for practical uniqueness.
 */
export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear()
  _seqCounter++
  const base = (Date.now() % 900000) + 100000 + (_seqCounter % 1000)
  const seq = String(base).padStart(6, "0").slice(0, 6)
  return `INV-${year}-${seq}`
}

/**
 * Generate sequential supply memo number: EPHM-YYYY-XXXXXX.
 */
export function generateMemoNumber(): string {
  const year = new Date().getFullYear()
  _seqCounter++
  const base = (Date.now() % 900000) + 100000 + (_seqCounter % 1000)
  const seq = String(base).padStart(6, "0").slice(0, 6)
  return `EPHM-${year}-${seq}`
}

/**
 * Determine if the transaction is intra-state (same state → CGST+SGST).
 * Inter-state transactions attract IGST instead.
 */
export function isIntraState(
  sellerState: string,
  buyerState: string
): boolean {
  if (!sellerState || !buyerState) return true
  return sellerState.trim().toLowerCase() === buyerState.trim().toLowerCase()
}

/**
 * Calculate GST split for a line item.
 * Indian GST: intra-state = CGST + SGST (half each), inter-state = IGST (full rate).
 */
export function calculateLineGst(params: {
  quantity: number
  unit_selling_price: number
  gst_rate: number
  intra_state: boolean
}): {
  taxable_value: number
  cgst: number
  sgst: number
  igst: number
  line_total: number
} {
  const { quantity, unit_selling_price, gst_rate, intra_state } = params
  const taxable_value = round2(unit_selling_price * quantity)

  let cgst = 0
  let sgst = 0
  let igst = 0

  if (intra_state) {
    cgst = round2((taxable_value * gst_rate) / 200)
    sgst = round2((taxable_value * gst_rate) / 200)
  } else {
    igst = round2((taxable_value * gst_rate) / 100)
  }

  const line_total = round2(taxable_value + cgst + sgst + igst)

  return { taxable_value, cgst, sgst, igst, line_total }
}

// ── Build Invoice ────────────────────────────────────────────────────

/**
 * Build a full GST invoice from an order.
 *
 * Resolves order items, drug metadata (pharmaCore), batch info
 * (pharmaInventoryBatch), and pharmacy license (pharmaCompliance).
 */
export async function buildGstInvoice(
  container: any,
  orderId: string
): Promise<GstInvoice> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
  const pharmaService = container.resolve("pharmaCore") as any
  const batchService = container.resolve("pharmaInventoryBatch") as any
  const complianceService = container.resolve("pharmaCompliance") as any

  // ── 1. Resolve order with items and shipping address ──────────────

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "status",
      "metadata",
      "items.*",
      "shipping_address.*",
    ],
    filters: { id: orderId },
  })

  const order = (orders as any[])?.[0]
  if (!order) {
    throw new Error(`Order ${orderId} not found`)
  }

  logger.info(
    `${LOG_PREFIX} Building invoice for order ${order.display_id ?? orderId}`
  )

  // ── 2. Determine seller/buyer states for GST split ────────────────

  const sellerState = process.env.WAREHOUSE_STATE || "Telangana"
  const buyerState =
    order.shipping_address?.province || order.shipping_address?.state || ""
  const intraState = isIntraState(sellerState, buyerState)

  // ── 3. Batch-lookup: collect all deductions for this order ────────

  const deductionsByItem = new Map<string, any>()
  const batchCache = new Map<string, any>()

  try {
    const allDeductions = await batchService.listBatchDeductions({
      order_id: orderId,
    })

    for (const d of allDeductions as any[]) {
      if (!deductionsByItem.has(d.order_line_item_id)) {
        deductionsByItem.set(d.order_line_item_id, d)
      }
    }

    const batchIds = new Set<string>()
    for (const d of deductionsByItem.values()) {
      const bid = d.batch_id ?? d.batch?.id
      if (bid) batchIds.add(bid)
    }

    for (const bid of batchIds) {
      try {
        const batch = await batchService.retrieveBatch(bid)
        batchCache.set(bid, batch)
      } catch {
        logger.warn(`${LOG_PREFIX} Could not retrieve batch ${bid}`)
      }
    }
  } catch (err: any) {
    logger.warn(
      `${LOG_PREFIX} Could not load batch deductions: ${err?.message}`
    )
  }

  // ── 4. Build line items ───────────────────────────────────────────

  // Default GST rate for medicines (5% per Indian pharma GST schedule)
  const DEFAULT_MEDICINE_GST_RATE = 5

  const items: InvoiceLineItem[] = []

  for (const item of order.items || []) {
    // Drug metadata
    let drugProduct: any = null
    if (item.product_id) {
      try {
        const drugProducts = await pharmaService.listDrugProducts({
          product_id: item.product_id,
        })
        drugProduct = (drugProducts as any[])?.[0]
      } catch (err: any) {
        logger.warn(
          `${LOG_PREFIX} No drug metadata for product ${item.product_id}: ${err?.message}`
        )
      }
    }

    // Batch info: prefer deduction-linked batch, fall back to
    // direct variant lookup (for orders fulfilled before FEFO fix)
    const deduction = deductionsByItem.get(item.id)
    const batchId = deduction?.batch_id ?? deduction?.batch?.id
    let batch = batchId ? batchCache.get(batchId) : deduction?.batch ?? null

    if (!batch && item.variant_id) {
      try {
        const variantBatches = await batchService.listBatches(
          { product_variant_id: item.variant_id, status: "active" },
          { order: { expiry_date: "ASC" }, take: 1 }
        )
        if ((variantBatches as any[])?.length) {
          batch = (variantBatches as any[])[0]
          logger.info(
            `${LOG_PREFIX} No deduction for item ${item.id}, ` +
              `using earliest active batch ${batch.lot_number} for variant ${item.variant_id}`
          )
        }
      } catch {
        // Batch module may not have data for this variant
      }
    }

    const gstRate = drugProduct?.gst_rate ?? DEFAULT_MEDICINE_GST_RATE
    const hsnCode = drugProduct?.hsn_code ?? ""
    const genericName = drugProduct?.generic_name ?? item.variant_title ?? ""

    // MRP: prefer batch MRP (authoritative for the dispensed lot), fall back to drug product
    const mrpPaise =
      batch?.batch_mrp_paise ?? drugProduct?.mrp_paise ?? null
    const unitMrp =
      mrpPaise != null ? Number(mrpPaise) / 100 : Number(item.unit_price)

    // Selling price = what was charged (Medusa stores in ₹ whole units)
    const unitSellingPrice = Number(item.unit_price)
    const quantity = Number(item.quantity)

    const discountAmount = round2(
      Math.max(0, (unitMrp - unitSellingPrice) * quantity)
    )

    const gst = calculateLineGst({
      quantity,
      unit_selling_price: unitSellingPrice,
      gst_rate: gstRate,
      intra_state: intraState,
    })

    const expiryRaw = batch?.expiry_date
    const expiryStr = expiryRaw
      ? new Date(expiryRaw).toISOString().split("T")[0]
      : "N/A"

    items.push({
      product_title: item.title ?? "",
      generic_name: genericName,
      hsn_code: hsnCode,
      batch_number: batch?.lot_number ?? "N/A",
      expiry_date: expiryStr,
      quantity,
      unit_mrp: round2(unitMrp),
      unit_selling_price: round2(unitSellingPrice),
      discount_amount: discountAmount,
      taxable_value: gst.taxable_value,
      gst_rate: gstRate,
      cgst_amount: gst.cgst,
      sgst_amount: gst.sgst,
      igst_amount: gst.igst,
      line_total: gst.line_total,
    })
  }

  // ── 5. Sum totals ────────────────────────────────────────────────

  const subtotal = round2(items.reduce((s, i) => s + i.unit_mrp * i.quantity, 0))
  const totalDiscount = round2(items.reduce((s, i) => s + i.discount_amount, 0))
  const totalTaxableValue = round2(
    items.reduce((s, i) => s + i.taxable_value, 0)
  )
  const totalCgst = round2(items.reduce((s, i) => s + i.cgst_amount, 0))
  const totalSgst = round2(items.reduce((s, i) => s + i.sgst_amount, 0))
  const totalIgst = round2(items.reduce((s, i) => s + i.igst_amount, 0))
  const totalGst = round2(totalCgst + totalSgst + totalIgst)
  const grandTotal = round2(totalTaxableValue + totalGst)

  // ── 6. Pharmacy license ──────────────────────────────────────────

  let dlNumber = process.env.PHARMACY_DL_NUMBER || ""
  try {
    const licenses = await complianceService.listPharmacyLicenses({
      is_active: true,
    })
    const activeLicense = (licenses as any[])?.[0]
    if (activeLicense?.license_number) {
      dlNumber = dlNumber || activeLicense.license_number
    }
  } catch {
    logger.warn(`${LOG_PREFIX} Could not resolve pharmacy license from DB`)
  }

  // ── 7. Payment mode ──────────────────────────────────────────────

  let paymentMode = "online"
  if (order.metadata?.payment_mode) {
    paymentMode = order.metadata.payment_mode
  } else {
    // Try resolving from payment collections
    try {
      const { data: pcData } = await query.graph({
        entity: "order",
        fields: ["id", "payment_collections.payment_sessions.*"],
        filters: { id: orderId },
      })
      const sessions =
        (pcData as any[])?.[0]?.payment_collections?.[0]?.payment_sessions ?? []
      const providerId = sessions[0]?.provider_id ?? ""
      if (providerId.includes("razorpay")) {
        paymentMode = "razorpay"
      } else if (
        providerId.includes("manual") ||
        providerId.includes("cod") ||
        providerId.includes("system_default")
      ) {
        paymentMode = "cod"
      }
    } catch {
      // Fallback stays "online"
    }
  }

  // ── 8. Prescription reference ────────────────────────────────────

  let prescriptionRef: string | undefined
  try {
    const { data: orderRx } = await query.graph({
      entity: "order",
      fields: ["id", "prescriptions.id"],
      filters: { id: orderId },
    })
    const rxs = (orderRx as any[])?.[0]?.prescriptions as any[] | undefined
    if (rxs?.length) {
      prescriptionRef = rxs.map((rx) => rx.id).join(", ")
    }
  } catch {
    // No prescription link or not applicable
  }

  // ── 9. Resolve buyer GSTIN from pharmaOrder extension (B2B invoicing) ─

  let buyerGstin: string | undefined
  try {
    const pharmaOrderService = container.resolve("pharmaOrder") as any
    const [extension] = await pharmaOrderService.listOrderExtensions(
      { order_id: orderId },
      { take: 1 }
    )
    if (extension?.gstin) {
      buyerGstin = extension.gstin
    }
  } catch {
    logger.warn(`${LOG_PREFIX} Could not resolve buyer GSTIN from order extension`)
  }

  // ── 10. Assemble invoice ─────────────────────────────────────────

  const buyerName = [
    order.shipping_address?.first_name,
    order.shipping_address?.last_name,
  ]
    .filter(Boolean)
    .join(" ")

  return {
    invoice_number: generateInvoiceNumber(),
    invoice_date: new Date().toISOString().split("T")[0],

    seller_name: process.env.PHARMACY_NAME || "Suprameds Pharmacy",
    seller_gstin: process.env.PHARMACY_GSTIN || "",
    seller_address: process.env.PHARMACY_ADDRESS || "",
    seller_state: sellerState,
    seller_dl_number: dlNumber,

    buyer_name: buyerName,
    buyer_address: formatAddress(order.shipping_address),
    buyer_state: buyerState,
    buyer_gstin: buyerGstin,

    is_intra_state: intraState,
    place_of_supply: buyerState,

    items,

    subtotal,
    total_discount: totalDiscount,
    total_taxable_value: totalTaxableValue,
    total_cgst: totalCgst,
    total_sgst: totalSgst,
    total_igst: totalIgst,
    total_gst: totalGst,
    grand_total: grandTotal,
    amount_in_words: amountInWords(Math.round(grandTotal)),

    payment_mode: paymentMode,
    prescription_ref: prescriptionRef,
  }
}
