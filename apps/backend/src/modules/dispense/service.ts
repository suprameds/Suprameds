import { MedusaService } from "@medusajs/framework/utils"
import DispenseDecision from "./models/dispense-decision"
import PharmacistAdjustmentLog from "./models/pharmacist-adjustment-log"
import PharmacistNote from "./models/pharmacist-note"
import PreDispatchSignOff from "./models/pre-dispatch-sign-off"

class DispenseModuleService extends MedusaService({
  DispenseDecision,
  PharmacistAdjustmentLog,
  PharmacistNote,
  PreDispatchSignOff,
}) {
  async makeDecision(data: {
    prescription_drug_line_id: string
    pharmacist_id: string
    decision: "approved" | "rejected" | "substituted" | "quantity_modified"
    approved_variant_id?: string
    approved_quantity: number
    dispensing_notes?: string
    rejection_reason?: string
    h1_register_entry_id?: string
    is_override?: boolean
    override_reason?: string
    order_item_id?: string
    previous_value?: string
  }) {
    const decision = await this.createDispenseDecisions({
      prescription_drug_line_id: data.prescription_drug_line_id,
      pharmacist_id: data.pharmacist_id,
      decision: data.decision,
      approved_variant_id: data.approved_variant_id ?? null,
      approved_quantity: data.approved_quantity,
      dispensing_notes: data.dispensing_notes ?? null,
      rejection_reason: data.decision === "rejected"
        ? (data.rejection_reason as any) ?? "other"
        : null,
      h1_register_entry_id: data.h1_register_entry_id ?? null,
      decided_at: new Date(),
      is_override: data.is_override ?? false,
      override_reason: data.override_reason ?? null,
    })

    if (data.decision !== "approved" && data.order_item_id) {
      const adjustmentType =
        data.decision === "substituted"
          ? "substitution"
          : data.decision === "quantity_modified"
            ? "quantity_change"
            : "rejection"

      await this.createPharmacistAdjustmentLogs({
        order_item_id: data.order_item_id,
        pharmacist_id: data.pharmacist_id,
        adjustment_type: adjustmentType as any,
        previous_value: data.previous_value ?? "original",
        new_value: JSON.stringify({
          decision: data.decision,
          variant_id: data.approved_variant_id,
          quantity: data.approved_quantity,
        }),
        reason: data.dispensing_notes ?? data.rejection_reason ?? "Pharmacist decision",
      })
    }

    return decision
  }

  async partialApproval(
    pharmacist_id: string,
    decisions: Array<{
      prescription_drug_line_id: string
      decision: "approved" | "rejected" | "substituted" | "quantity_modified"
      approved_variant_id?: string
      approved_quantity: number
      dispensing_notes?: string
      rejection_reason?: string
      h1_register_entry_id?: string
      order_item_id?: string
      previous_value?: string
    }>
  ) {
    const results = {
      approved: 0,
      rejected: 0,
      substituted: 0,
      quantity_modified: 0,
      decisions: [] as any[],
    }

    for (const d of decisions) {
      const decision = await this.makeDecision({ ...d, pharmacist_id })
      results[d.decision]++
      results.decisions.push(decision)
    }

    return results
  }

  async preDispatchCheck(data: {
    order_id: string
    pharmacist_id: string
    checks_performed: Array<{ check: string; passed: boolean; note?: string }>
  }) {
    const allPassed = data.checks_performed.every((c) => c.passed)

    return await this.createPreDispatchSignOffs({
      order_id: data.order_id,
      pharmacist_id: data.pharmacist_id,
      checks_performed: data.checks_performed as any,
      approved: allPassed,
      rejection_reason: allPassed
        ? null
        : data.checks_performed.filter((c) => !c.passed).map((c) => c.check).join("; "),
      signed_off_at: new Date(),
    })
  }

  async logAdjustment(data: {
    order_item_id: string
    pharmacist_id: string
    adjustment_type: string
    previous_value: string
    new_value: string
    reason: string
  }) {
    if (data.reason.length < 10) {
      throw new Error("Adjustment reason must be at least 10 characters")
    }

    return await this.createPharmacistAdjustmentLogs({
      order_item_id: data.order_item_id,
      pharmacist_id: data.pharmacist_id,
      adjustment_type: data.adjustment_type as any,
      previous_value: data.previous_value,
      new_value: data.new_value,
      reason: data.reason,
    })
  }
}

export default DispenseModuleService
