import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

export const AwardPointsWorkflow = createWorkflow(
  "award-points-workflow",
  (input: any) => {
    // TODO: Implement workflow steps
    return new WorkflowResponse({ success: true, input })
  }
)
