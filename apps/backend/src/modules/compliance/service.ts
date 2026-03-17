import { MedusaService } from "@medusajs/framework/utils"
import PhiAuditLog from "./models/phi-audit-log"
import OverrideRequest from "./models/override-request"
import PharmacyLicense from "./models/pharmacy-license"
import DpdpConsent from "./models/dpdp-consent"
import H1RegisterEntry from "./models/h1-register-entry"

/**
 * ComplianceModuleService — Audit exports, H1 register, recall reports,
 * override engine, license registry, DPDP consent management.
 */
class ComplianceModuleService extends MedusaService({
  PhiAuditLog,
  OverrideRequest,
  PharmacyLicense,
  DpdpConsent,
  H1RegisterEntry,
}) {
  // TODO: runChecklist(), exportH1Register(), generateRecallReport(),
  //       generateCdscoInspectionPack(), exportGstr1(),
  //       createOverrideRequest(), approveOverride()
}

export default ComplianceModuleService
