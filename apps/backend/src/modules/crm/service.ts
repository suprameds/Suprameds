import { MedusaService } from "@medusajs/framework/utils"
import ChronicReorderPattern from "./models/chronic-reorder-pattern"

/**
 * CrmModuleService — Customer 360, lifecycle stages, churn scoring,
 * abandoned cart (OTC only), reorder pattern detection.
 */
class CrmModuleService extends MedusaService({
  ChronicReorderPattern,
}) {
  // TODO: customer360(), lifecycleStage(), churnScore(),
  //       abandonedCartReminder(), winback()
}

export default CrmModuleService
