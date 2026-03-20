import {
  createStep,
  StepResponse,
  createWorkflow,
  WorkflowResponse,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { PRESCRIPTION_MODULE } from "../modules/prescription"
import { MedusaError } from "@medusajs/framework/utils"

type ApprovePrescriptionInput = {
  prescription_id: string
  pharmacist_id: string
  doctor_name?: string
  doctor_reg_no?: string
  patient_name?: string
  prescribed_on?: string
  valid_until?: string
  pharmacist_notes?: string
  lines: Array<{
    product_variant_id: string
    product_id: string
    approved_quantity: number
    max_refills?: number
  }>
}

type RejectPrescriptionInput = {
  prescription_id: string
  pharmacist_id: string
  rejection_reason: string
}

const approvePrescriptionStep = createStep(
  "approve-prescription",
  async (input: ApprovePrescriptionInput, { container }) => {
    const prescriptionService: any = container.resolve(PRESCRIPTION_MODULE)

    const existing = await prescriptionService.retrievePrescription(
      input.prescription_id
    )

    if (existing.status !== "pending_review") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Prescription ${input.prescription_id} is not in pending_review status`
      )
    }

    const now = new Date()

    const updated = await prescriptionService.updatePrescriptions({
      id: input.prescription_id,
      status: "approved",
      reviewed_by: input.pharmacist_id,
      reviewed_at: now,
      doctor_name: input.doctor_name ?? null,
      doctor_reg_no: input.doctor_reg_no ?? null,
      patient_name: input.patient_name ?? null,
      prescribed_on: input.prescribed_on ? new Date(input.prescribed_on) : null,
      valid_until: input.valid_until ? new Date(input.valid_until) : null,
      pharmacist_notes: input.pharmacist_notes ?? null,
    })

    // Create prescription lines
    const lineData = input.lines.map((line) => ({
      prescription_id: input.prescription_id,
      product_variant_id: line.product_variant_id,
      product_id: line.product_id,
      approved_quantity: line.approved_quantity,
      max_refills: line.max_refills ?? null,
    }))

    await prescriptionService.createPrescriptionLines(lineData)

    return new StepResponse({ prescription: updated }, input.prescription_id)
  },
  async (prescriptionId: string, { container }) => {
    const prescriptionService: any = container.resolve(PRESCRIPTION_MODULE)
    // Revert to pending_review on rollback
    await prescriptionService.updatePrescriptions({
      id: prescriptionId,
      status: "pending_review",
      reviewed_by: null,
      reviewed_at: null,
    })
  }
)

const rejectPrescriptionStep = createStep(
  "reject-prescription",
  async (input: RejectPrescriptionInput, { container }) => {
    const prescriptionService: any = container.resolve(PRESCRIPTION_MODULE)

    const existing = await prescriptionService.retrievePrescription(
      input.prescription_id
    )

    if (existing.status !== "pending_review") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Prescription ${input.prescription_id} is not in pending_review status`
      )
    }

    const now = new Date()

    const updated = await prescriptionService.updatePrescriptions({
      id: input.prescription_id,
      status: "rejected",
      reviewed_by: input.pharmacist_id,
      reviewed_at: now,
      rejection_reason: input.rejection_reason,
    })

    return new StepResponse({ prescription: updated }, input.prescription_id)
  },
  async (prescriptionId: string, { container }) => {
    const prescriptionService: any = container.resolve(PRESCRIPTION_MODULE)
    await prescriptionService.updatePrescriptions({
      id: prescriptionId,
      status: "pending_review",
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
    })
  }
)

export const approvePrescriptionWorkflow = createWorkflow(
  "approve-prescription",
  function (input: ApprovePrescriptionInput) {
    const result = approvePrescriptionStep(input)
    return new WorkflowResponse(result)
  }
)

export const rejectPrescriptionWorkflow = createWorkflow(
  "reject-prescription",
  function (input: RejectPrescriptionInput) {
    const result = rejectPrescriptionStep(input)
    return new WorkflowResponse(result)
  }
)
