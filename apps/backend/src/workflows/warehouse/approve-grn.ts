import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

export const ApproveGrnWorkflow = createWorkflow(
  "approve-grn-workflow",
  (input: any) => {
    // TODO: Implement workflow steps
    return new WorkflowResponse({ success: true, input })
  }
)
