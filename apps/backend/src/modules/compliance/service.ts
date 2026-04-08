import { MedusaService } from "@medusajs/framework/utils"
import PhiAuditLog from "./models/phi-audit-log"
import OverrideRequest from "./models/override-request"
import PharmacyLicense from "./models/pharmacy-license"
import DpdpConsent from "./models/dpdp-consent"
import H1RegisterEntry from "./models/h1-register-entry"
import CustomerDocument from "./models/customer-document"

class ComplianceModuleService extends MedusaService({
  PhiAuditLog,
  OverrideRequest,
  PharmacyLicense,
  DpdpConsent,
  H1RegisterEntry,
  CustomerDocument,
}) {
  async runChecklist(data: {
    order_id: string
    checks: Array<{ rule: string; passed: boolean; details?: string }>
  }) {
    const allPassed = data.checks.every((c) => c.passed)
    const failures = data.checks.filter((c) => !c.passed)

    return {
      order_id: data.order_id,
      passed: allPassed,
      total_checks: data.checks.length,
      passed_checks: data.checks.length - failures.length,
      failed_checks: failures.length,
      failures: failures.map((f) => ({ rule: f.rule, details: f.details })),
      checked_at: new Date().toISOString(),
    }
  }

  async exportH1Register(dateRange: { from: Date; to: Date }) {
    const entries = await this.listH1RegisterEntries(
      {},
      { take: null }
    )

    const filtered = entries.filter((e: any) => {
      const d = new Date(e.entry_date)
      return d >= dateRange.from && d <= dateRange.to
    })

    return {
      period: {
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
      },
      total_entries: filtered.length,
      entries: filtered.map((e: any) => ({
        entry_date: e.entry_date,
        patient_name: e.patient_name,
        patient_address: e.patient_address,
        patient_age: e.patient_age,
        prescriber_name: e.prescriber_name,
        prescriber_reg_no: e.prescriber_reg_no,
        drug_name: e.drug_name,
        brand_name: e.brand_name,
        batch_number: e.batch_number,
        quantity_dispensed: e.quantity_dispensed,
        dispensing_pharmacist: e.dispensing_pharmacist,
        pharmacist_reg_no: e.pharmacist_reg_no,
      })),
      exported_at: new Date().toISOString(),
    }
  }

  async generateRecallReport(batchNumber: string) {
    const entries = await this.listH1RegisterEntries(
      { batch_number: batchNumber },
      { take: null }
    )

    return {
      batch_number: batchNumber,
      affected_dispenses: entries.length,
      patients_affected: new Set(entries.map((e: any) => e.patient_name)).size,
      entries: entries.map((e: any) => ({
        entry_date: e.entry_date,
        patient_name: e.patient_name,
        patient_address: e.patient_address,
        drug_name: e.drug_name,
        quantity_dispensed: e.quantity_dispensed,
        order_item_id: e.order_item_id,
      })),
      generated_at: new Date().toISOString(),
    }
  }

  async generateCdscoInspectionPack(dateRange: { from: Date; to: Date }) {
    const [h1Entries, licenses, phiLogs, overrides] = await Promise.all([
      this.exportH1Register(dateRange),
      this.listPharmacyLicenses({ is_active: true }, { take: null }),
      this.listPhiAuditLogs({}, { take: 100 }),
      this.listOverrideRequests({}, { take: null }),
    ])

    const recentOverrides = (overrides as any[]).filter((o) => {
      const d = new Date(o.created_at)
      return d >= dateRange.from && d <= dateRange.to
    })

    return {
      inspection_pack: {
        period: dateRange,
        h1_register: h1Entries,
        active_licenses: licenses.length,
        licenses: (licenses as any[]).map((l) => ({
          license_number: l.license_number,
          license_type: l.license_type,
          valid_from: l.valid_from,
          valid_until: l.valid_until,
          is_active: l.is_active,
        })),
        phi_access_log_sample: phiLogs.length,
        compliance_overrides: recentOverrides.length,
        overrides_summary: recentOverrides.map((o: any) => ({
          type: o.override_type,
          status: o.status,
          requested_by_role: o.requested_by_role,
          justification_length: o.justification?.length ?? 0,
        })),
      },
      generated_at: new Date().toISOString(),
    }
  }

  async exportGstr1(period: { month: number; year: number }) {
    // GSTR-1 is computed from order/invoice data — this returns the structure
    // Actual tax computation comes from the order/payment modules
    return {
      period: `${period.year}-${String(period.month).padStart(2, "0")}`,
      gstin: process.env.PHARMACY_GSTIN ?? "NOT_SET",
      status: "draft",
      sections: {
        b2b: { invoice_count: 0, taxable_value: 0, total_gst: 0 },
        b2c_large: { invoice_count: 0, taxable_value: 0, total_gst: 0 },
        b2c_small: { invoice_count: 0, taxable_value: 0, total_gst: 0 },
        credit_debit_notes: { count: 0, total: 0 },
        nil_rated_exempt: { value: 0 },
      },
      generated_at: new Date().toISOString(),
    }
  }

  async createOverrideRequest(data: {
    override_type: string
    target_entity_type: string
    target_entity_id: string
    requested_by: string
    requested_by_role: string
    justification: string
    patient_impact?: string
    risk_assessment: string
    supporting_doc_url?: string
    requires_dual_auth?: boolean
    valid_for_hours?: number
  }) {
    if (data.justification.length < 50) {
      throw new Error("Override justification must be at least 50 characters")
    }

    const validHours = data.valid_for_hours ?? 24
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + validHours)

    return await this.createOverrideRequests({
      override_type: data.override_type,
      target_entity_type: data.target_entity_type,
      target_entity_id: data.target_entity_id,
      requested_by: data.requested_by,
      requested_by_role: data.requested_by_role,
      justification: data.justification,
      patient_impact: data.patient_impact ?? null,
      risk_assessment: data.risk_assessment,
      supporting_doc_url: data.supporting_doc_url ?? null,
      requires_dual_auth: data.requires_dual_auth ?? false,
      status: "pending_primary",
      valid_for_hours: validHours,
      expires_at: expiresAt,
    })
  }

  async approveOverride(
    overrideId: string,
    approverId: string,
    isPrimary: boolean
  ) {
    const override = await this.retrieveOverrideRequest(overrideId)

    if (override.requested_by === approverId) {
      throw new Error("SSD violation: approver cannot be the same as requester")
    }

    if (new Date() > new Date(override.expires_at)) {
      await this.updateOverrideRequests({ id: overrideId, status: "expired" })
      throw new Error("Override request has expired")
    }

    if (isPrimary) {
      if (override.status !== "pending_primary") {
        throw new Error(`Cannot approve: status is ${override.status}, expected pending_primary`)
      }

      const nextStatus = override.requires_dual_auth ? "pending_secondary" : "approved"

      return await this.updateOverrideRequests({
        id: overrideId,
        primary_approver_id: approverId,
        primary_approved_at: new Date(),
        status: nextStatus,
      })
    } else {
      if (override.status !== "pending_secondary") {
        throw new Error(`Cannot approve: status is ${override.status}, expected pending_secondary`)
      }

      if (override.primary_approver_id === approverId) {
        throw new Error("SSD violation: secondary approver must differ from primary approver")
      }

      return await this.updateOverrideRequests({
        id: overrideId,
        secondary_approver_id: approverId,
        secondary_approved_at: new Date(),
        status: "approved",
      })
    }
  }
}

export default ComplianceModuleService
