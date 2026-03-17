import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

export const InspectReturnWorkflow = createWorkflow(
  "inspect-return-workflow",
  (input: any) => {
    // TODO: Implement workflow steps
    return new WorkflowResponse({ success: true, input })
  }
)
