import ComplianceModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const COMPLIANCE_MODULE = "compliance"

export default Module(COMPLIANCE_MODULE, {
  service: ComplianceModuleService,
})
