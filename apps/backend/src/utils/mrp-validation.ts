import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const LOG_PREFIX = "[mrp-sync]"

// ── Types ──────────────────────────────────────────────────────────────

export type MrpConflict = {
  product_id: string
  variant_id: string
  product_title: string
  current_selling_price_paise: number
  batch_mrp_paise: number
  action_required: "lower_selling_price" | "review"
  message: string
}

type MrpCheckItem = {
  product_id: string
  variant_id: string
  batch_mrp_paise: number | null
}

// ── checkMrpConflicts ──────────────────────────────────────────────────

/**
 * Check if newly received batch MRPs conflict with current selling prices.
 *
 * Indian pharma law (DPCO) prohibits selling above MRP. When a new batch
 * arrives with a lower MRP than the current storefront price, the selling
 * price MUST be reduced before the batch enters saleable inventory.
 *
 * Returns an array of conflicts where selling price > batch MRP.
 */
export async function checkMrpConflicts(
  container: any,
  items: MrpCheckItem[]
): Promise<MrpConflict[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
  const conflicts: MrpConflict[] = []

  for (const item of items) {
    if (item.batch_mrp_paise == null) {
      continue
    }

    try {
      // Fetch product with variant prices to determine current selling price
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["id", "title", "*variants", "*variants.prices"],
        filters: { id: item.product_id },
      })

      const product = (products as any[])?.[0]
      if (!product) {
        logger.warn(
          `${LOG_PREFIX} Product ${item.product_id} not found — skipping MRP check`
        )
        continue
      }

      // Find the matching variant and its INR price
      const variant = product.variants?.find(
        (v: any) => v.id === item.variant_id
      )
      if (!variant) {
        logger.warn(
          `${LOG_PREFIX} Variant ${item.variant_id} not found on product ${item.product_id}`
        )
        continue
      }

      const inrPrice = variant.prices?.find(
        (p: any) =>
          p.currency_code === "inr" ||
          p.currency_code === "INR"
      )
      if (!inrPrice) {
        continue
      }

      // Medusa stores money in whole units (₹10 = 10); convert to paise
      const sellingPricePaise = Number(inrPrice.amount) * 100

      if (sellingPricePaise > item.batch_mrp_paise) {
        const conflict: MrpConflict = {
          product_id: item.product_id,
          variant_id: item.variant_id,
          product_title: product.title ?? "Unknown",
          current_selling_price_paise: sellingPricePaise,
          batch_mrp_paise: item.batch_mrp_paise,
          action_required:
            sellingPricePaise > item.batch_mrp_paise * 1.1
              ? "lower_selling_price"
              : "review",
          message:
            `Selling price ₹${(sellingPricePaise / 100).toFixed(2)} exceeds ` +
            `batch MRP ₹${(item.batch_mrp_paise / 100).toFixed(2)} for ` +
            `"${product.title}" — price must be reduced before dispatch`,
        }
        conflicts.push(conflict)

        logger.warn(
          `${LOG_PREFIX} CONFLICT: ${conflict.message} ` +
            `(product=${item.product_id}, variant=${item.variant_id})`
        )
      }
    } catch (err: any) {
      logger.error(
        `${LOG_PREFIX} Error checking MRP for product ${item.product_id}: ${err?.message}`
      )
    }
  }

  return conflicts
}

// ── syncProductMrpFromBatches ──────────────────────────────────────────

/**
 * After receiving a PO, update drug_product.mrp_paise to reflect
 * the LOWEST active batch MRP for each product.
 *
 * This ensures the product-level MRP field is always the safe ceiling —
 * i.e. the minimum MRP across all batches currently available for sale.
 * Any storefront pricing must be at or below this value.
 */
export async function syncProductMrpFromBatches(
  container: any,
  productIds: string[]
): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
  const batchService = container.resolve("pharmaInventoryBatch") as any
  const pharmaService = container.resolve("pharmaCore") as any

  const uniqueIds = [...new Set(productIds)]

  for (const productId of uniqueIds) {
    try {
      // Get all active batches for this product, sorted by MRP ascending
      const batches = await batchService.listBatches(
        { product_id: productId, status: "active" },
        { order: { batch_mrp_paise: "ASC" } }
      )

      // Find the lowest non-null MRP across active batches
      const batchesWithMrp = (batches as any[])?.filter(
        (b: any) => b.batch_mrp_paise != null
      )

      if (!batchesWithMrp?.length) {
        logger.info(
          `${LOG_PREFIX} No active batches with MRP for product ${productId} — skipping`
        )
        continue
      }

      const lowestMrp = Number(batchesWithMrp[0].batch_mrp_paise)

      // Fetch the drug_product record to update
      const drugProducts = await pharmaService.listDrugProducts({
        product_id: productId,
      })
      const drug = (drugProducts as any[])?.[0]

      if (!drug) {
        logger.warn(
          `${LOG_PREFIX} No drug_product record found for product ${productId}`
        )
        continue
      }

      const currentMrp = drug.mrp_paise != null ? Number(drug.mrp_paise) : null

      if (currentMrp === lowestMrp) {
        logger.info(
          `${LOG_PREFIX} Product ${productId} MRP already at ₹${(lowestMrp / 100).toFixed(2)} — no update needed`
        )
        continue
      }

      await pharmaService.updateDrugProducts({
        id: drug.id,
        mrp_paise: lowestMrp,
      })

      logger.info(
        `${LOG_PREFIX} Updated product ${productId} MRP: ` +
          `₹${currentMrp != null ? (currentMrp / 100).toFixed(2) : "null"} → ` +
          `₹${(lowestMrp / 100).toFixed(2)} ` +
          `(lowest across ${batchesWithMrp.length} active batch(es))`
      )
    } catch (err: any) {
      logger.error(
        `${LOG_PREFIX} Failed to sync MRP for product ${productId}: ${err?.message}`
      )
    }
  }
}
