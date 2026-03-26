import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../../modules/prescription"

type ReviewRxStepInput = {
  prescription_id: string
  pharmacist_id: string
  action: "approve" | "reject"
  rejection_reason?: string
  doctor_name?: string
  doctor_reg_no?: string
  patient_name?: string
  prescribed_on?: Date
  valid_until?: Date
  pharmacist_notes?: string
  lines?: {
    product_variant_id: string
    inventory_item_id?: string
    approved_quantity: number
    max_refills?: number
  }[]
}

export const reviewPrescriptionStep = createStep(
  "review-prescription-step",
  async (input: ReviewRxStepInput, { container }) => {
    const prescriptionModuleService = container.resolve(PRESCRIPTION_MODULE) as any
    const logger = container.resolve("logger") as any
    
    // Validate prescription exists
    const [existing] = await prescriptionModuleService.listPrescriptions({ id: input.prescription_id })
    if (!existing) {
      throw new Error(`Prescription ${input.prescription_id} not found`)
    }

    // Warn if pharmacist has no registered credential
    try {
      const rbacService = container.resolve("pharmaRbac") as any
      const cred = await rbacService.getPharmacistReg(input.pharmacist_id)
      if (!cred) {
        logger.warn(
          `[review-rx] Pharmacist ${input.pharmacist_id} has no pharmacist_registration credential on file. ` +
            `Add it via Roles & Access > Staff Credentials for compliance traceability.`
        )
      }
    } catch {
      // Non-blocking
    }

    if (input.action === "reject") {
      const updated = await prescriptionModuleService.updatePrescriptions({
        id: input.prescription_id,
        status: "rejected",
        rejection_reason: input.rejection_reason,
        reviewed_by: input.pharmacist_id,
        reviewed_at: new Date(),
        pharmacist_notes: input.pharmacist_notes
      })
      return new StepResponse({ action: "reject", prescription: updated }, null)
    }

    // Otherwise approve
    const updated = await prescriptionModuleService.updatePrescriptions({
      id: input.prescription_id,
      status: "approved",
      doctor_name: input.doctor_name,
      doctor_reg_no: input.doctor_reg_no,
      patient_name: input.patient_name,
      prescribed_on: input.prescribed_on,
      valid_until: input.valid_until,
      pharmacist_notes: input.pharmacist_notes,
      reviewed_by: input.pharmacist_id,
      reviewed_at: new Date(),
    })

    // Create prescription lines
    if (input.lines && input.lines.length > 0) {
      const linesToCreate = input.lines.map((line: any) => ({
        prescription_id: input.prescription_id,
        ...line
      }))
      await prescriptionModuleService.createPrescriptionLines(linesToCreate)
    }

    return new StepResponse({ action: "approve", prescription: updated }, null)
  }
)

export const emitReviewEventStep = createStep(
  "emit-review-event-step",
  async (data: { action: "approve" | "reject", prescription: any }, { container }) => {
    const eventBus = container.resolve(Modules.EVENT_BUS) as any
    const eventName = data.action === "approve" ? "prescription.fully-approved" : "prescription.rejected"
    
    await eventBus.emit({
      name: eventName,
      data: { id: data.prescription.id },
    })
    return new StepResponse(null)
  }
)

export const ReviewRxWorkflow = createWorkflow(
  "review-rx-workflow",
  (input: ReviewRxStepInput) => {
    const reviewResult = reviewPrescriptionStep(input) as any
    emitReviewEventStep(reviewResult)
    return new WorkflowResponse(reviewResult)
  }
)
