import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

export const PharmacistDecisionWorkflow = createWorkflow(
  "pharmacist-decision-workflow",
  (input: any) => {
    // TODO: Implement workflow steps
    return new WorkflowResponse({ success: true, input })
  }
)
