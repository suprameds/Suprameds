import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { COMPLIANCE_MODULE } from "../../modules/compliance"

type RequestOverrideInput = {
  override_type: string
  target_entity_type: string
  target_entity_id: string
  requested_by: string
  requested_by_role: string
  justification: string
  patient_impact?: string
  risk_assessment: string
  supporting_doc_url?: string
  valid_for_hours?: number
}

/**
 * Validate the override request and determine if dual auth is required.
 */
const validateOverrideStep = createStep(
  "request-override-validate",
  async (input: RequestOverrideInput, { container }) => {
    const logger = container.resolve("logger") as any

    if (!input.justification || input.justification.length < 10) {
      throw new Error("Override justification must be at least 10 characters")
    }

    if (!input.risk_assessment) {
      throw new Error("Risk assessment is required for all override requests")
    }

    // High-risk overrides require dual authorization
    const highRiskTypes = ["schedule_restriction", "expired_batch", "recall_override"]
    const requiresDualAuth = highRiskTypes.includes(input.override_type)

    logger.info(
      `[override] Request: ${input.override_type} on ${input.target_entity_type}/${input.target_entity_id} ` +
        `by ${input.requested_by} — dual_auth: ${requiresDualAuth}`
    )

    return new StepResponse({ requiresDualAuth })
  }
)

/**
 * Create the override request record.
 */
const createOverrideRecordStep = createStep(
  "request-override-create-record",
  async (
    input: RequestOverrideInput & { requiresDualAuth: boolean },
    { container }
  ) => {
    const complianceService = container.resolve(COMPLIANCE_MODULE) as any

    const validHours = input.valid_for_hours || 24
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + validHours)

    const overrideRequest = await complianceService.createOverrideRequests({
      override_type: input.override_type,
      target_entity_type: input.target_entity_type,
      target_entity_id: input.target_entity_id,
      requested_by: input.requested_by,
      requested_by_role: input.requested_by_role,
      justification: input.justification,
      patient_impact: input.patient_impact || null,
      risk_assessment: input.risk_assessment,
      supporting_doc_url: input.supporting_doc_url || null,
      requires_dual_auth: input.requiresDualAuth,
      status: input.requiresDualAuth ? "pending_primary" : "pending_primary",
      valid_for_hours: validHours,
      expires_at: expiresAt,
    })

    return new StepResponse(overrideRequest, overrideRequest.id)
  },
  async (overrideId, { container }) => {
    if (!overrideId) return
    const complianceService = container.resolve(COMPLIANCE_MODULE) as any
    try {
      await complianceService.deleteOverrideRequests(overrideId)
    } catch {
      // best-effort compensation
    }
  }
)

/**
 * Emit override.requested event for compliance officer notifications.
 */
const emitOverrideEventStep = createStep(
  "request-override-emit-event",
  async (input: { overrideRequest: any }, { container }) => {
    const eventBus = container.resolve(Modules.EVENT_BUS) as any
    await eventBus.emit({
      name: "compliance.override_requested",
      data: {
        id: input.overrideRequest.id,
        override_type: input.overrideRequest.override_type,
        target_entity_type: input.overrideRequest.target_entity_type,
        target_entity_id: input.overrideRequest.target_entity_id,
        requested_by: input.overrideRequest.requested_by,
        requires_dual_auth: input.overrideRequest.requires_dual_auth,
      },
    })
    return new StepResponse(null)
  }
)

/**
 * RequestOverrideWorkflow — creates a compliance override request
 * with proper validation, dual-auth determination, and audit trail.
 */
export const RequestOverrideWorkflow = createWorkflow(
  "request-override-workflow",
  (input: RequestOverrideInput) => {
    const validation = validateOverrideStep(input) as any

    const overrideRequest = createOverrideRecordStep({
      ...input,
      requiresDualAuth: validation.requiresDualAuth,
    }) as any

    emitOverrideEventStep({ overrideRequest })

    return new WorkflowResponse({
      override_request: overrideRequest,
      requires_dual_auth: validation.requiresDualAuth,
    })
  }
)
