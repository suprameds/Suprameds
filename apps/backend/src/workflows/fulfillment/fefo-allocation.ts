import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { INVENTORY_BATCH_MODULE } from "../../modules/inventoryBatch"
import { PHARMA_MODULE } from "../../modules/pharma"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type FefoAllocationInput = {
  order_id: string
  items: Array<{
    line_item_id: string
    product_id: string
    variant_id: string
    quantity: number
    unit_price_paise: number
  }>
}

type Allocation = {
  line_item_id: string
  batch_id: string
  lot_number: string
  quantity: number
  batch_mrp_paise: number | null
  expiry_date: string
}

type FefoAllocationResult = {
  success: boolean
  allocations: Allocation[]
  warnings: string[]
  errors: string[]
}

/**
 * Compensation data stored so we can roll back batch quantities and
 * delete deduction records if a later step in the parent workflow fails.
 */
type CompensationPayload = {
  deduction_ids: string[]
  quantity_restorations: Array<{
    batch_id: string
    quantity: number
    was_depleted: boolean
  }>
}

/* ------------------------------------------------------------------ */
/*  Step: allocate-fefo                                                */
/* ------------------------------------------------------------------ */

export const allocateFefoStep = createStep(
  "allocate-fefo-step",
  async (input: FefoAllocationInput, { container }) => {
    const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
    const pharmaService = container.resolve(PHARMA_MODULE) as any
    const logger = container.resolve("logger") as any

    const allocations: Allocation[] = []
    const warnings: string[] = []
    const errors: string[] = []

    // Compensation tracking — lets us undo every mutation on rollback
    const deductionIds: string[] = []
    const quantityRestorations: CompensationPayload["quantity_restorations"] = []

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const item of input.items) {
      logger.info(
        `[fefo] Allocating ${item.quantity} units for variant ${item.variant_id} ` +
          `(line ${item.line_item_id})`
      )

      /* 1. Fetch active batches in FEFO order */
      let batches: any[]
      try {
        batches = await batchService.listBatches(
          {
            product_variant_id: item.variant_id,
            status: "active",
          },
          {
            order: { expiry_date: "ASC" },
            take: null, // retrieve all matching rows
          }
        )
      } catch (err: any) {
        const msg = `Failed to list batches for variant ${item.variant_id}: ${err.message}`
        logger.error(`[fefo] ${msg}`)
        errors.push(msg)
        continue
      }

      if (!batches || batches.length === 0) {
        const msg = `No active batches found for variant ${item.variant_id}`
        logger.warn(`[fefo] ${msg}`)
        errors.push(msg)
        continue
      }

      /* 2. Filter out expired and zero-quantity batches */
      const eligible = batches.filter((b: any) => {
        const expiry = new Date(b.expiry_date)
        expiry.setHours(0, 0, 0, 0)
        return expiry >= today && Number(b.available_quantity) > 0
      })

      if (eligible.length === 0) {
        const msg = `All batches for variant ${item.variant_id} are expired or depleted`
        logger.warn(`[fefo] ${msg}`)
        errors.push(msg)
        continue
      }

      /* 3. Resolve drug product for MRP context */
      let drugProduct: any = null
      try {
        const drugs = await pharmaService.listDrugProducts({
          product_id: item.product_id,
        })
        if (drugs?.length) drugProduct = drugs[0]
      } catch {
        // Non-fatal — we can still allocate, just can't log drug info
        logger.warn(
          `[fefo] Could not fetch drug product for product ${item.product_id}`
        )
      }

      /* 4. Walk batches in FEFO order and allocate */
      let remaining = item.quantity

      for (const batch of eligible) {
        if (remaining <= 0) break

        const availableQty = Number(batch.available_quantity)
        const batchMrp = batch.batch_mrp_paise != null
          ? Number(batch.batch_mrp_paise)
          : null

        /* 4b. MRP ceiling check — illegal to sell above MRP in India */
        if (batchMrp !== null && item.unit_price_paise > batchMrp) {
          const warn =
            `Batch ${batch.lot_number} skipped: selling price ₹${(item.unit_price_paise / 100).toFixed(2)} ` +
            `> batch MRP ₹${(batchMrp / 100).toFixed(2)}`
          logger.warn(`[fefo] ${warn}`)
          warnings.push(warn)
          continue
        }

        const allocQty = Math.min(availableQty, remaining)
        const newAvailable = availableQty - allocQty
        const isDepleted = newAvailable === 0

        /* 4c. Create BatchDeduction record */
        const deduction = await batchService.createBatchDeductions({
          batch_id: batch.id,
          order_line_item_id: item.line_item_id,
          order_id: input.order_id,
          quantity: allocQty,
          deduction_type: "sale",
        })

        deductionIds.push(deduction.id)

        /* 4d. Decrement available_quantity and update status if depleted */
        const updatePayload: Record<string, any> = {
          id: batch.id,
          available_quantity: newAvailable,
        }
        if (isDepleted) {
          updatePayload.status = "depleted"
        }
        await batchService.updateBatches(updatePayload)

        quantityRestorations.push({
          batch_id: batch.id,
          quantity: allocQty,
          was_depleted: isDepleted,
        })

        allocations.push({
          line_item_id: item.line_item_id,
          batch_id: batch.id,
          lot_number: batch.lot_number,
          quantity: allocQty,
          batch_mrp_paise: batchMrp,
          expiry_date: new Date(batch.expiry_date).toISOString(),
        })

        remaining -= allocQty

        logger.info(
          `[fefo] Allocated ${allocQty} from batch ${batch.lot_number} ` +
            `(exp ${new Date(batch.expiry_date).toISOString().slice(0, 10)}) — ` +
            `${newAvailable} remaining in batch`
        )
      }

      /* 5. Insufficient stock check */
      if (remaining > 0) {
        const allocated = item.quantity - remaining
        const msg =
          `Insufficient stock for variant ${item.variant_id}: ` +
          `need ${item.quantity}, only ${allocated} available` +
          (drugProduct ? ` (${drugProduct.generic_name})` : "")
        logger.error(`[fefo] ${msg}`)
        errors.push(msg)
      }
    }

    const result: FefoAllocationResult = {
      success: errors.length === 0,
      allocations,
      warnings,
      errors,
    }

    const compensation: CompensationPayload = {
      deduction_ids: deductionIds,
      quantity_restorations: quantityRestorations,
    }

    logger.info(
      `[fefo] Allocation complete for order ${input.order_id}: ` +
        `${allocations.length} allocations, ${warnings.length} warnings, ${errors.length} errors`
    )

    return new StepResponse(result, compensation)
  },

  /* -------- Compensation: undo all mutations on rollback -------- */
  async (compensation: CompensationPayload, { container }) => {
    if (!compensation) return

    const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
    const logger = container.resolve("logger") as any

    logger.info(
      `[fefo] Rolling back ${compensation.deduction_ids.length} deductions ` +
        `and ${compensation.quantity_restorations.length} batch quantity changes`
    )

    // Restore batch quantities (reverse order to keep things consistent)
    for (const restore of [...compensation.quantity_restorations].reverse()) {
      try {
        const [batch] = await batchService.listBatches({ id: restore.batch_id })
        if (!batch) continue

        const restoredQty = Number(batch.available_quantity) + restore.quantity
        const updatePayload: Record<string, any> = {
          id: restore.batch_id,
          available_quantity: restoredQty,
        }
        if (restore.was_depleted) {
          updatePayload.status = "active"
        }
        await batchService.updateBatches(updatePayload)
      } catch (err: any) {
        logger.error(
          `[fefo] Compensation failed restoring batch ${restore.batch_id}: ${err.message}`
        )
      }
    }

    // Delete deduction records
    for (const id of compensation.deduction_ids) {
      try {
        await batchService.deleteBatchDeductions(id)
      } catch (err: any) {
        logger.error(
          `[fefo] Compensation failed deleting deduction ${id}: ${err.message}`
        )
      }
    }

    logger.info("[fefo] Compensation complete")
  }
)

/* ------------------------------------------------------------------ */
/*  Workflow                                                           */
/* ------------------------------------------------------------------ */

export const fefoAllocationWorkflow = createWorkflow(
  "fefo-allocation-workflow",
  (input: FefoAllocationInput) => {
    const result = allocateFefoStep(input)
    return new WorkflowResponse(result)
  }
)

export type { FefoAllocationInput, FefoAllocationResult, Allocation }
