import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { WAREHOUSE_MODULE } from "../../modules/warehouse"
import { INVENTORY_BATCH_MODULE } from "../../modules/inventoryBatch"

type ApproveGrnInput = {
  grn_id: string
  approved_by: string
}

/**
 * Fetch GRN record and validate it's in a state that can be approved.
 */
const fetchAndValidateGrnStep = createStep(
  "approve-grn-fetch-validate",
  async (input: { grn_id: string }, { container }) => {
    const warehouseService = container.resolve(WAREHOUSE_MODULE) as any

    const [grn] = await warehouseService.listGrnRecords(
      { id: input.grn_id },
      { take: 1 }
    )

    if (!grn) {
      throw new Error(`GRN ${input.grn_id} not found`)
    }

    if (grn.status === "approved") {
      throw new Error(`GRN ${input.grn_id} is already approved`)
    }

    if (grn.status === "rejected") {
      throw new Error(`GRN ${input.grn_id} was rejected — create a new GRN`)
    }

    return new StepResponse(grn)
  }
)

/**
 * Create inventory batches from GRN line items.
 */
const createBatchesFromGrnStep = createStep(
  "approve-grn-create-batches",
  async (input: { grn: any }, { container }) => {
    const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
    const grn = input.grn
    const items = grn.items || grn.line_items || []
    const createdIds: string[] = []

    for (const item of items) {
      const batch = await batchService.createBatches({
        product_variant_id: item.product_variant_id,
        product_id: item.product_id,
        lot_number: item.lot_number,
        expiry_date: item.expiry_date,
        manufactured_on: item.manufactured_on || null,
        received_quantity: item.quantity,
        available_quantity: item.quantity,
        reserved_quantity: 0,
        batch_mrp_paise: item.batch_mrp_paise ?? null,
        purchase_price_paise: item.purchase_price_paise ?? null,
        grn_number: grn.grn_number,
        supplier_name: grn.supplier_name || grn.supplier_id,
        received_on: new Date().toISOString(),
        status: "active",
      })
      createdIds.push(batch.id)
    }

    return new StepResponse(
      { created: createdIds, count: createdIds.length },
      createdIds
    )
  },
  async (createdIds, { container }) => {
    if (!createdIds?.length) return
    const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any
    for (const id of createdIds) {
      try {
        await batchService.deleteBatches(id)
      } catch {
        // best-effort
      }
    }
  }
)

/**
 * Update GRN record status to approved.
 */
const updateGrnStatusStep = createStep(
  "approve-grn-update-status",
  async (input: { grn_id: string; approved_by: string }, { container }) => {
    const warehouseService = container.resolve(WAREHOUSE_MODULE) as any

    await warehouseService.updateGrnRecords(input.grn_id, {
      status: "approved",
      qc_approved_by: input.approved_by,
      qc_approved_at: new Date().toISOString(),
    })

    return new StepResponse({ updated: true })
  }
)

/**
 * Emit GRN approved event for downstream processing.
 */
const emitGrnApprovedStep = createStep(
  "approve-grn-emit-event",
  async (input: { grn: any; approved_by: string; batchCount: number }, { container }) => {
    const eventBus = container.resolve(Modules.EVENT_BUS) as any
    await eventBus.emit({
      name: "warehouse.grn_approved",
      data: {
        grn_id: input.grn.id,
        grn_number: input.grn.grn_number,
        supplier_id: input.grn.supplier_id || input.grn.supplier_name,
        approved_by: input.approved_by,
        items: input.grn.items || input.grn.line_items || [],
      },
    })
    return new StepResponse(null)
  }
)

/**
 * ApproveGrnWorkflow — QC approves a GRN, creates inventory batches,
 * and makes stock available for FEFO allocation.
 */
export const ApproveGrnWorkflow = createWorkflow(
  "approve-grn-workflow",
  (input: ApproveGrnInput) => {
    const grn = fetchAndValidateGrnStep({ grn_id: input.grn_id }) as any

    const batches = createBatchesFromGrnStep({ grn }) as any

    updateGrnStatusStep({
      grn_id: input.grn_id,
      approved_by: input.approved_by,
    })

    emitGrnApprovedStep({
      grn,
      approved_by: input.approved_by,
      batchCount: batches.count,
    })

    return new WorkflowResponse({
      grn_id: input.grn_id,
      batches_created: batches.count,
      approved: true,
    })
  }
)
