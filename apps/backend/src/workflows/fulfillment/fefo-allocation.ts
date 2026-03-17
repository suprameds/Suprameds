import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

export const FefoAllocationWorkflow = createWorkflow(
  "fefo-allocation-workflow",
  (input: any) => {
    // TODO: Implement workflow steps
    return new WorkflowResponse({ success: true, input })
  }
)
