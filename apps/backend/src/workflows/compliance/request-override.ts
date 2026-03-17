import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

export const RequestOverrideWorkflow = createWorkflow(
  "request-override-workflow",
  (input: any) => {
    // TODO: Implement workflow steps
    return new WorkflowResponse({ success: true, input })
  }
)
