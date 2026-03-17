import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

export const MergeGuestCartWorkflow = createWorkflow(
  "merge-guest-cart-workflow",
  (input: any) => {
    // TODO: Implement workflow steps
    return new WorkflowResponse({ success: true, input })
  }
)
