import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../../modules/prescription"

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
    const prescriptionModuleService: any = container.resolve(PRESCRIPTION_MODULE)
    const prescription = await prescriptionModuleService.createPrescriptions(input)
    return new StepResponse(prescription, prescription.id)
  },
  async (prescriptionId: string, { container }) => {
    const prescriptionModuleService: any = container.resolve(PRESCRIPTION_MODULE)
    await prescriptionModuleService.deletePrescriptions([prescriptionId])
  }
)

export const emitPrescriptionUploadedEventStep = createStep(
  "emit-prescription-uploaded-event",
  async (prescriptionId: string, { container }) => {
    const eventBus = container.resolve(Modules.EVENT_BUS)
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
