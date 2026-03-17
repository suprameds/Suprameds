import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

export const CreateShipmentWorkflow = createWorkflow(
  "suprameds-create-shipment-workflow",
  (input: any) => {
    // TODO: Implement workflow steps
    return new WorkflowResponse({ success: true, input })
  }
)
