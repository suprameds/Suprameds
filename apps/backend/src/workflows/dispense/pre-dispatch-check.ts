import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DISPENSE_MODULE } from "../../modules/dispense"
import { PRESCRIPTION_MODULE } from "../../modules/prescription"
import { INVENTORY_BATCH_MODULE } from "../../modules/inventoryBatch"

type PreDispatchInput = {
  order_id: string
  pharmacist_id: string
}

type ChecklistResult = {
  rx_items_approved: boolean
  prescription_valid: boolean
  batch_allocated: boolean
  no_expired_batches: boolean
  stock_available: boolean
}

/**
 * Verify pharmacist has a clinical role. Soft check — warns on failure.
 */
export const verifyPharmacistStep = createStep(
  "pre-dispatch-verify-pharmacist-step",
  async (input: { pharmacist_id: string }, { container }) => {
    const logger = container.resolve("logger") as any

    try {
      const rbacService = container.resolve("pharmaRbac") as any
      const roles = await rbacService.listUserRoles({
        user_id: input.pharmacist_id,
        is_active: true,
      })

      const roleList = Array.isArray(roles?.[0]) ? roles[0] : Array.isArray(roles) ? roles : []
      if (roleList.length === 0) {
        logger.warn(
          `[pre-dispatch] No RBAC roles found for pharmacist ${input.pharmacist_id} — RBAC may not be seeded. Allowing.`
        )
        return new StepResponse({ verified: false, reason: "no_roles" })
      }

      return new StepResponse({ verified: true })
    } catch (err: any) {
      logger.warn(
        `[pre-dispatch] RBAC check failed: ${err.message}. Proceeding with warning.`
      )
      return new StepResponse({ verified: false, reason: "rbac_error" })
    }
  }
)

/**
 * Fetch the order and its line items via Medusa's query graph.
 */
export const fetchOrderStep = createStep(
  "pre-dispatch-fetch-order-step",
  async (input: { order_id: string }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as any

    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "metadata",
        "items.id",
        "items.variant_id",
        "items.product_id",
        "items.quantity",
        "items.metadata",
      ],
      filters: { id: input.order_id },
    })

    if (!orders || orders.length === 0) {
      throw new Error(`Order ${input.order_id} not found`)
    }

    return new StepResponse(orders[0])
  }
)

/**
 * Run the full pre-dispatch checklist:
 *  1. All Rx items have approved dispense decisions
 *  2. Prescription is valid and approved
 *  3. Batch deductions exist for the order
 *  4. No expired batches in the allocation
 *  5. Stock covers the deductions
 */
export const runChecklistStep = createStep(
  "pre-dispatch-run-checklist-step",
  async (
    input: { order: any; pharmacist_id: string },
    { container }
  ) => {
    const logger = container.resolve("logger") as any
    const dispenseService = container.resolve(DISPENSE_MODULE) as any
    const pharmaService = container.resolve("pharmaCore") as any
    const prescriptionService = container.resolve(PRESCRIPTION_MODULE) as any
    const batchService = container.resolve("pharmaInventoryBatch") as any

    const order = input.order
    const items = order.items || []
    const failures: string[] = []

    // ── 1. Check Rx compliance: each H/H1 item needs an approved decision ──
    // rx_line_map stores { order_item_id → prescription_drug_line_id } in order.metadata
    const rxLineMap: Record<string, string> = (order.metadata as any)?.rx_line_map || {}
    let rxItemsApproved = true
    for (const item of items) {
      if (!item.product_id) continue

      let drugProducts: any[] = []
      try {
        drugProducts = await pharmaService.listDrugProducts({ product_id: item.product_id })
      } catch {
        // Drug metadata might not exist (OTC without metadata)
        continue
      }

      const drug = Array.isArray(drugProducts) && drugProducts.length > 0
        ? (Array.isArray(drugProducts[0]) ? drugProducts[0][0] : drugProducts[0])
        : null

      if (!drug) continue
      if (drug.schedule !== "H" && drug.schedule !== "H1") continue

      // This is an Rx item — resolve prescription_drug_line_id from:
      // 1. rx_line_map on order metadata (set when pharmacist makes dispense decision)
      // 2. item.metadata.prescription_drug_line_id (legacy/direct)
      const prescriptionLineId =
        rxLineMap[item.id] || item.metadata?.prescription_drug_line_id || null

      if (!prescriptionLineId) {
        rxItemsApproved = false
        failures.push(`Item ${item.id}: no prescription_drug_line_id mapped for scheduled drug`)
        continue
      }

      const decisions = await dispenseService.listDispenseDecisions({
        prescription_drug_line_id: prescriptionLineId,
      })
      const decisionList = Array.isArray(decisions?.[0]) ? decisions[0] : Array.isArray(decisions) ? decisions : []

      const hasApproved = decisionList.some(
        (d: any) => d.decision === "approved" || d.decision === "substituted"
      )

      if (!hasApproved) {
        rxItemsApproved = false
        failures.push(`Item ${item.id}: no approved dispense decision for Rx drug (line ${prescriptionLineId})`)
      }
    }

    // ── 2. Check prescription status ──
    let prescriptionValid = true
    const prescriptionId =
      order.metadata?.prescription_id || null

    if (prescriptionId) {
      try {
        const [rx] = await prescriptionService.listPrescriptions({ id: prescriptionId })
        if (!rx) {
          prescriptionValid = false
          failures.push(`Prescription ${prescriptionId} not found`)
        } else if (rx.status !== "approved" && rx.status !== "used") {
          prescriptionValid = false
          failures.push(`Prescription ${prescriptionId} status is "${rx.status}", expected "approved"`)
        } else if (rx.valid_until && new Date(rx.valid_until) < new Date()) {
          prescriptionValid = false
          failures.push(`Prescription ${prescriptionId} has expired (valid_until: ${rx.valid_until})`)
        }
      } catch (err: any) {
        prescriptionValid = false
        failures.push(`Prescription check failed: ${err.message}`)
      }
    }

    // ── 3. Check batch allocation ──
    let batchAllocated = true
    let noExpiredBatches = true
    let stockAvailable = true

    try {
      const deductions = await batchService.listBatchDeductions({ order_id: order.id })
      const deductionList = Array.isArray(deductions?.[0]) ? deductions[0] : Array.isArray(deductions) ? deductions : []

      if (deductionList.length === 0) {
        batchAllocated = false
        failures.push("No batch deductions found for this order")
      } else {
        // Check each deduction's batch for expiry and available stock
        for (const ded of deductionList) {
          const batchId = ded.batch_id || ded.batch?.id
          if (!batchId) continue

          try {
            const batches = await batchService.listBatches({ id: batchId })

            const batchList = Array.isArray(batches?.[0]) ? batches[0] : Array.isArray(batches) ? batches : []
            const batch = batchList[0]

            if (batch) {
              if (new Date(batch.expiry_date) < new Date()) {
                noExpiredBatches = false
                failures.push(`Batch ${batch.lot_number} (${batchId}) is expired: ${batch.expiry_date}`)
              }
              if (batch.status === "expired" || batch.status === "recalled") {
                noExpiredBatches = false
                failures.push(`Batch ${batch.lot_number} (${batchId}) status is "${batch.status}"`)
              }
              if (batch.available_quantity < ded.quantity) {
                stockAvailable = false
                failures.push(
                  `Batch ${batch.lot_number}: available ${batch.available_quantity} < deducted ${ded.quantity}`
                )
              }
            }
          } catch (err: any) {
            logger.warn(`[pre-dispatch] Batch lookup failed for ${batchId}: ${err.message}`)
          }
        }
      }
    } catch (err: any) {
      batchAllocated = false
      failures.push(`Batch deduction check failed: ${err.message}`)
    }

    const checklist: ChecklistResult = {
      rx_items_approved: rxItemsApproved,
      prescription_valid: prescriptionValid,
      batch_allocated: batchAllocated,
      no_expired_batches: noExpiredBatches,
      stock_available: stockAvailable,
    }

    const allPassed = Object.values(checklist).every(Boolean)

    if (!allPassed) {
      logger.warn(
        `[pre-dispatch] Order ${order.id} failed pre-dispatch checks: ${failures.join("; ")}`
      )
    } else {
      logger.info(`[pre-dispatch] Order ${order.id} passed all pre-dispatch checks`)
    }

    return new StepResponse({ checklist, allPassed, failures })
  }
)

/**
 * Create the PreDispatchSignOff record.
 */
export const createSignOffStep = createStep(
  "pre-dispatch-create-sign-off-step",
  async (
    input: {
      order_id: string
      pharmacist_id: string
      checklist: ChecklistResult
      allPassed: boolean
      failures: string[]
    },
    { container }
  ) => {
    const dispenseService = container.resolve(DISPENSE_MODULE) as any

    const signOff = await dispenseService.createPreDispatchSignOffs({
      order_id: input.order_id,
      pharmacist_id: input.pharmacist_id,
      checks_performed: input.checklist,
      approved: input.allPassed,
      rejection_reason: input.allPassed ? null : input.failures.join("; "),
      signed_off_at: new Date(),
    })

    return new StepResponse(signOff, signOff.id)
  },
  async (signOffId, { container }) => {
    if (!signOffId) return
    const dispenseService = container.resolve(DISPENSE_MODULE) as any
    try {
      await dispenseService.deletePreDispatchSignOffs(signOffId)
    } catch {
      // Best-effort compensation
    }
  }
)

/**
 * Emit pre-dispatch result event for downstream subscribers.
 */
export const emitPreDispatchEventStep = createStep(
  "emit-pre-dispatch-event-step",
  async (input: { signOff: any; allPassed: boolean }, { container }) => {
    const eventBus = container.resolve(Modules.EVENT_BUS) as any
    const eventName = input.allPassed
      ? "dispense.pre_dispatch_approved"
      : "dispense.pre_dispatch_rejected"

    await eventBus.emit({
      name: eventName,
      data: {
        id: input.signOff.id,
        order_id: input.signOff.order_id,
        approved: input.allPassed,
      },
    })

    return new StepResponse(null)
  }
)

/**
 * PreDispatchCheckWorkflow — pharmacist verifies an order is ready
 * for dispatch. Runs batch, prescription, and dispense decision checks.
 */
export const PreDispatchCheckWorkflow = createWorkflow(
  "pre-dispatch-check-workflow",
  (input: PreDispatchInput) => {
    // Step 1: Verify pharmacist role
    verifyPharmacistStep({ pharmacist_id: input.pharmacist_id })

    // Step 2: Fetch order details
    const order = fetchOrderStep({ order_id: input.order_id }) as any

    // Step 3: Run the checklist
    const checkResult = runChecklistStep({
      order,
      pharmacist_id: input.pharmacist_id,
    }) as any

    // Step 4: Create sign-off record
    const signOff = createSignOffStep({
      order_id: input.order_id,
      pharmacist_id: input.pharmacist_id,
      checklist: checkResult.checklist,
      allPassed: checkResult.allPassed,
      failures: checkResult.failures,
    }) as any

    // Step 5: Emit event
    emitPreDispatchEventStep({
      signOff,
      allPassed: checkResult.allPassed,
    })

    return new WorkflowResponse({
      sign_off: signOff,
      checklist: checkResult.checklist,
      approved: checkResult.allPassed,
      failures: checkResult.failures,
    })
  }
)
