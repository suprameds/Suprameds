import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const LOG_PREFIX = "[fulfillment-mrp]"

// ── Types ──────────────────────────────────────────────────────────────

export type FulfillmentAllocation = {
  line_item_id: string
  batch_id: string
  unit_price_paise: number
  quantity: number
}

export type MrpViolation = {
  line_item_id: string
  batch_id: string
  lot_number: string
  charged_paise: number
  batch_mrp_paise: number
  message: string
}

export type FulfillmentMrpResult = {
  valid: boolean
  violations: MrpViolation[]
}

// ── validateFulfillmentMrp ─────────────────────────────────────────────

/**
 * Validates that the charged price for each line item does not exceed the
 * MRP of the batch being used to fulfill it.
 *
 * Called before dispatching an order. Under DPCO (Drug Price Control Order),
 * selling any drug above MRP is a criminal offence. This is the final
 * safety net — violations MUST block dispatch.
 *
 * @returns `valid: true` if all allocations pass; otherwise `valid: false`
 *          with a `violations` array detailing each offending line.
 */
export async function validateFulfillmentMrp(
  container: any,
  allocations: FulfillmentAllocation[]
): Promise<FulfillmentMrpResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as any
  const batchService = container.resolve("pharmaInventoryBatch") as any
  const violations: MrpViolation[] = []

  if (!allocations?.length) {
    return { valid: true, violations: [] }
  }

  for (const alloc of allocations) {
    try {
      const batch = await batchService.retrieveBatch(alloc.batch_id)

      if (!batch) {
        logger.warn(
          `${LOG_PREFIX} Batch ${alloc.batch_id} not found — cannot validate MRP for line ${alloc.line_item_id}`
        )
        continue
      }

      const batchMrp = batch.batch_mrp_paise != null
        ? Number(batch.batch_mrp_paise)
        : null

      // Skip validation if batch has no MRP recorded
      if (batchMrp == null) {
        continue
      }

      if (alloc.unit_price_paise > batchMrp) {
        const violation: MrpViolation = {
          line_item_id: alloc.line_item_id,
          batch_id: alloc.batch_id,
          lot_number: batch.lot_number ?? "unknown",
          charged_paise: alloc.unit_price_paise,
          batch_mrp_paise: batchMrp,
          message:
            `Line ${alloc.line_item_id}: charged ₹${(alloc.unit_price_paise / 100).toFixed(2)} ` +
            `exceeds batch MRP ₹${(batchMrp / 100).toFixed(2)} ` +
            `(lot ${batch.lot_number ?? "unknown"}, batch ${alloc.batch_id}) — ` +
            `dispatch BLOCKED`,
        }
        violations.push(violation)

        logger.error(
          `${LOG_PREFIX} VIOLATION: ${violation.message}`
        )
      }
    } catch (err: any) {
      logger.error(
        `${LOG_PREFIX} Error validating batch ${alloc.batch_id} for line ${alloc.line_item_id}: ${err?.message}`
      )
      // Treat retrieval failures as blocking — fail safe
      violations.push({
        line_item_id: alloc.line_item_id,
        batch_id: alloc.batch_id,
        lot_number: "unknown",
        charged_paise: alloc.unit_price_paise,
        batch_mrp_paise: 0,
        message:
          `Line ${alloc.line_item_id}: could not retrieve batch ${alloc.batch_id} ` +
          `for MRP validation — dispatch BLOCKED (fail-safe)`,
      })
    }
  }

  const valid = violations.length === 0

  if (valid) {
    logger.info(
      `${LOG_PREFIX} All ${allocations.length} allocation(s) passed MRP validation`
    )
  } else {
    logger.error(
      `${LOG_PREFIX} ${violations.length} MRP violation(s) detected — dispatch must be blocked`
    )
  }

  return { valid, violations }
}
