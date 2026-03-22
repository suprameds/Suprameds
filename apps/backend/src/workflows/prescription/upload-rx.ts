import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../../modules/prescription"
import { encryptPhi, isPhiEncryptionEnabled } from "../../lib/phi-crypto"

type UploadRxStepInput = {
  customer_id?: string
  guest_phone?: string
  file_key: string
  file_url?: string
  original_filename?: string
  mime_type?: string
  file_size_bytes?: number
}

export const createPrescriptionStep = createStep(
  "create-prescription-step",
  async (input: UploadRxStepInput, { container }) => {
    const data = { ...input }

    // Encrypt PHI fields before persisting
    if (isPhiEncryptionEnabled() && data.guest_phone) {
      data.guest_phone = encryptPhi(data.guest_phone) as string
    }

    const prescriptionModuleService = container.resolve(PRESCRIPTION_MODULE) as any
    const prescription = await prescriptionModuleService.createPrescriptions(data)
    return new StepResponse(prescription, prescription.id)
  },
  async (prescriptionId: string, { container }) => {
    const prescriptionModuleService = container.resolve(PRESCRIPTION_MODULE) as any
    await prescriptionModuleService.deletePrescriptions([prescriptionId])
  }
)

export const emitPrescriptionUploadedEventStep = createStep(
  "emit-prescription-uploaded-event",
  async (prescriptionId: string, { container }) => {
    const eventBus = container.resolve(Modules.EVENT_BUS) as any
    await eventBus.emit({
      name: "prescription.uploaded",
      data: { id: prescriptionId },
    })
    return new StepResponse(null)
  }
)

export const UploadRxWorkflow = createWorkflow(
  "upload-rx-workflow",
  (input: UploadRxStepInput) => {
    const prescription = createPrescriptionStep(input)
    emitPrescriptionUploadedEventStep(prescription.id)
    return new WorkflowResponse(prescription)
  }
)
