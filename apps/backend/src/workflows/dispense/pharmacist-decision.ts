import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { DISPENSE_MODULE } from "../../modules/dispense"
import { COMPLIANCE_MODULE } from "../../modules/compliance"
import { PHARMA_MODULE } from "../../modules/pharma"
import { PRESCRIPTION_MODULE } from "../../modules/prescription"

type PharmacistDecisionInput = {
  prescription_drug_line_id: string
  pharmacist_id: string
  decision: "approved" | "rejected" | "substituted" | "quantity_modified"
  approved_variant_id?: string
  approved_quantity?: number
  dispensing_notes?: string
  rejection_reason?: string
  is_override?: boolean
  override_reason?: string
  patient_name?: string
  patient_address?: string
  patient_age?: number
  prescriber_name?: string
  prescriber_reg_no?: string
}

/**
 * Validates the pharmacist has a clinical role via RBAC.
 * Soft check — warns but does not block if RBAC is not seeded yet.
 */
export const validatePharmacistRoleStep = createStep(
  "validate-pharmacist-role-step",
  async (input: { pharmacist_id: string }, { container }) => {
    const logger = container.resolve("logger") as any

    try {
      const rbacService = container.resolve("pharmaRbac") as any
      let roles: any[] = []
      try {
        roles = await rbacService.listUserRoles(
          { user_id: input.pharmacist_id },
          { relations: ["role"] }
        )
      } catch {
        roles = []
      }

      if (!roles || roles.length === 0) {
        logger.warn(
          `[dispense] No RBAC roles found for pharmacist ${input.pharmacist_id} — RBAC may not be seeded yet. Allowing operation.`
        )
        return new StepResponse({ validated: false, reason: "no_roles_found" })
      }

      const hasClinical = roles.some(
        (ur: any) => ur.role?.is_clinical || ur.role?.code === "pharmacist" || ur.role?.code === "admin"
      )

      if (!hasClinical) {
        logger.warn(
          `[dispense] Pharmacist ${input.pharmacist_id} has roles but none are clinical. Allowing operation with warning.`
        )
      }

      return new StepResponse({ validated: hasClinical, reason: hasClinical ? "ok" : "no_clinical_role" })
    } catch (err: any) {
      logger.warn(
        `[dispense] RBAC check failed for pharmacist ${input.pharmacist_id}: ${err.message}. Allowing operation.`
      )
      return new StepResponse({ validated: false, reason: "rbac_error" })
    }
  }
)

/**
 * Resolves the prescription line and determines if the drug is Schedule H1.
 */
export const resolvePrescriptionLineStep = createStep(
  "resolve-prescription-line-step",
  async (input: { prescription_drug_line_id: string }, { container }) => {
    const prescriptionService = container.resolve(PRESCRIPTION_MODULE) as any
    const pharmaService = container.resolve(PHARMA_MODULE) as any

    const [line] = await prescriptionService.listPrescriptionLines({
      id: input.prescription_drug_line_id,
    })
    if (!line) {
      throw new Error(`Prescription line ${input.prescription_drug_line_id} not found`)
    }

    // Look up the drug schedule via pharmaCore
    let schedule: string | null = null
    let drugProduct: any = null
    if (line.product_id) {
      const [drug] = await pharmaService.listDrugProducts({ product_id: line.product_id })
      if (drug) {
        schedule = drug.schedule
        drugProduct = drug
      }
    }

    return new StepResponse({
      line,
      schedule,
      drugProduct,
      is_h1: schedule === "H1",
    })
  }
)

/**
 * Creates an H1RegisterEntry for Schedule H1 drugs when approved/substituted.
 */
export const createH1EntryStep = createStep(
  "create-h1-entry-step",
  async (
    input: {
      should_create: boolean
      pharmacist_id: string
      line: any
      drugProduct: any
      decision: string
      approved_quantity?: number
      patient_name?: string
      patient_address?: string
      patient_age?: number
      prescriber_name?: string
      prescriber_reg_no?: string
    },
    { container }
  ) => {
    if (!input.should_create) {
      return new StepResponse({ h1_entry: null })
    }

    const complianceService = container.resolve(COMPLIANCE_MODULE) as any

    const entry = await complianceService.createH1RegisterEntries({
      entry_date: new Date(),
      patient_name: input.patient_name || "Unknown",
      patient_address: input.patient_address || "Unknown",
      patient_age: input.patient_age || 0,
      prescriber_name: input.prescriber_name || "Unknown",
      prescriber_reg_no: input.prescriber_reg_no || "Unknown",
      drug_name: input.drugProduct?.generic_name || "Unknown",
      brand_name: input.drugProduct?.composition || "Unknown",
      batch_number: "PENDING",
      quantity_dispensed: input.approved_quantity || input.line?.approved_quantity || 1,
      dispensing_pharmacist: input.pharmacist_id,
      pharmacist_reg_no: "PENDING",
      order_item_id: input.line?.id || "PENDING",
      dispense_decision_id: "PENDING",
    })

    return new StepResponse({ h1_entry: entry })
  }
)

/**
 * Creates the DispenseDecision record.
 */
export const createDispenseDecisionStep = createStep(
  "create-dispense-decision-step",
  async (
    input: {
      prescription_drug_line_id: string
      pharmacist_id: string
      decision: string
      approved_variant_id?: string
      approved_quantity?: number
      dispensing_notes?: string
      rejection_reason?: string
      is_override?: boolean
      override_reason?: string
      h1_register_entry_id?: string | null
    },
    { container }
  ) => {
    const dispenseService = container.resolve(DISPENSE_MODULE) as any

    const record = await dispenseService.createDispenseDecisions({
      prescription_drug_line_id: input.prescription_drug_line_id,
      pharmacist_id: input.pharmacist_id,
      decision: input.decision,
      approved_variant_id: input.approved_variant_id || null,
      approved_quantity: input.approved_quantity || 0,
      dispensing_notes: input.dispensing_notes || null,
      rejection_reason: input.rejection_reason || null,
      h1_register_entry_id: input.h1_register_entry_id || null,
      decided_at: new Date(),
      is_override: input.is_override || false,
      override_reason: input.override_reason || null,
    })

    return new StepResponse(record, record.id)
  },
  // Compensation: delete the decision if workflow rolls back
  async (decisionId, { container }) => {
    if (!decisionId) return
    const dispenseService = container.resolve(DISPENSE_MODULE) as any
    try {
      await dispenseService.deleteDispenseDecisions(decisionId)
    } catch {
      // Best-effort compensation
    }
  }
)

/**
 * Update H1 entry with the actual dispense_decision_id once created.
 */
export const linkH1EntryStep = createStep(
  "link-h1-entry-step",
  async (
    input: { h1_entry_id: string | null; dispense_decision_id: string },
    { container }
  ) => {
    if (!input.h1_entry_id) {
      return new StepResponse(null)
    }

    const complianceService = container.resolve(COMPLIANCE_MODULE) as any
    await complianceService.updateH1RegisterEntries({
      id: input.h1_entry_id,
      dispense_decision_id: input.dispense_decision_id,
    })

    return new StepResponse({ linked: true })
  }
)

/**
 * Emits the dispense.decision_made event for downstream subscribers.
 */
export const emitDecisionEventStep = createStep(
  "emit-decision-event-step",
  async (data: { decision: any }, { container }) => {
    const eventBus = container.resolve(Modules.EVENT_BUS) as any
    await eventBus.emit({
      name: "dispense.decision_made",
      data: {
        id: data.decision.id,
        prescription_drug_line_id: data.decision.prescription_drug_line_id,
        decision: data.decision.decision,
        pharmacist_id: data.decision.pharmacist_id,
      },
    })
    return new StepResponse(null)
  }
)

/**
 * PharmacistDecisionWorkflow — pharmacist makes a clinical decision
 * on a prescription drug line item. Handles H1 register compliance.
 */
export const PharmacistDecisionWorkflow = createWorkflow(
  "pharmacist-decision-workflow",
  (input: PharmacistDecisionInput) => {
    // Step 1: Validate pharmacist role (soft check)
    validatePharmacistRoleStep({ pharmacist_id: input.pharmacist_id })

    // Step 2: Resolve the prescription line and drug schedule
    const lineResult = resolvePrescriptionLineStep({
      prescription_drug_line_id: input.prescription_drug_line_id,
    }) as any

    // Step 3: Create H1 entry if needed (H1 + approved/substituted)
    const h1Result = createH1EntryStep({
      should_create:
        lineResult.is_h1 &&
        (input.decision === "approved" || input.decision === "substituted"),
      pharmacist_id: input.pharmacist_id,
      line: lineResult.line,
      drugProduct: lineResult.drugProduct,
      decision: input.decision,
      approved_quantity: input.approved_quantity,
      patient_name: input.patient_name,
      patient_address: input.patient_address,
      patient_age: input.patient_age,
      prescriber_name: input.prescriber_name,
      prescriber_reg_no: input.prescriber_reg_no,
    }) as any

    // Step 4: Create DispenseDecision
    const decision = createDispenseDecisionStep({
      prescription_drug_line_id: input.prescription_drug_line_id,
      pharmacist_id: input.pharmacist_id,
      decision: input.decision,
      approved_variant_id: input.approved_variant_id,
      approved_quantity: input.approved_quantity,
      dispensing_notes: input.dispensing_notes,
      rejection_reason: input.rejection_reason,
      is_override: input.is_override,
      override_reason: input.override_reason,
      h1_register_entry_id: h1Result.h1_entry?.id || null,
    }) as any

    // Step 5: Back-link the H1 entry with the decision ID
    linkH1EntryStep({
      h1_entry_id: h1Result.h1_entry?.id || null,
      dispense_decision_id: decision.id,
    })

    // Step 6: Emit event
    emitDecisionEventStep({ decision })

    return new WorkflowResponse(decision)
  }
)
