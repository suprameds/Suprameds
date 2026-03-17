import { MedusaService } from "@medusajs/framework/utils"
import CodOrder from "./models/cod-order"
import CodCustomerScore from "./models/cod-customer-score"

/**
 * CodModuleService — COD confirmation calls, customer scoring,
 * remittance tracking, RTO management.
 */
class CodModuleService extends MedusaService({
  CodOrder,
  CodCustomerScore,
}) {
  // TODO: confirmOrder(), autoCancel(), scoreCustomer(),
  //       handleRto(), reconcileRemittance()
}

export default CodModuleService
