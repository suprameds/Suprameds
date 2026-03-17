import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

export const ConfirmCodWorkflow = createWorkflow(
  "confirm-cod-workflow",
  (input: any) => {
    // TODO: Implement workflow steps
    return new WorkflowResponse({ success: true, input })
  }
)
