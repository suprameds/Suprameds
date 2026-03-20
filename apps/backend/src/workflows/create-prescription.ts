import {
  createStep,
  StepResponse,
  createWorkflow,
  WorkflowResponse,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { PRESCRIPTION_MODULE } from "../modules/prescription"

type CreatePrescriptionInput = {
  customer_id?: string
  guest_phone?: string
  file_key: string
  file_url?: string
  original_filename?: string
  mime_type?: string
  file_size_bytes?: number
}

const createPrescriptionStep = createStep(
  "create-prescription",
  async (input: CreatePrescriptionInput, { container }) => {
    const prescriptionService = container.resolve(PRESCRIPTION_MODULE) as any

    const prescription = await prescriptionService.createPrescriptions({
      customer_id: input.customer_id ?? null,
      guest_phone: input.guest_phone ?? null,
      file_key: input.file_key,
      file_url: input.file_url ?? null,
      original_filename: input.original_filename ?? null,
      mime_type: input.mime_type ?? null,
      file_size_bytes: input.file_size_bytes ?? null,
      status: "pending_review",
    })

    return new StepResponse(prescription, prescription.id)
  },
  async (prescriptionId: string, { container }) => {
    const prescriptionService = container.resolve(PRESCRIPTION_MODULE) as any
    await prescriptionService.deletePrescriptions(prescriptionId)
  }
)

export const createPrescriptionWorkflow = createWorkflow(
  "create-prescription",
  function (input: CreatePrescriptionInput) {
    const prescription = createPrescriptionStep(input)

    return new WorkflowResponse({ prescription })
  }
)
