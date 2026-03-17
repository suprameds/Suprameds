import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

export const PreDispatchCheckWorkflow = createWorkflow(
  "pre-dispatch-check-workflow",
  (input: any) => {
    // TODO: Implement workflow steps
    return new WorkflowResponse({ success: true, input })
  }
)
