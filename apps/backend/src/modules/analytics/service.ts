import { MedusaService } from "@medusajs/framework/utils"

/**
 * AnalyticsModuleService — KPI computation, funnels, materialized views.
 * No custom models — queries existing tables via raw SQL / materialized views.
 */
class AnalyticsModuleService extends MedusaService({}) {
  // TODO: kpiDashboard(), funnelAnalysis(), inventoryAnalytics(),
  //       cohortAnalysis(), codAnalytics(), gstReport()
}

export default AnalyticsModuleService
