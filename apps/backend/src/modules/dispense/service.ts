import { MedusaService } from "@medusajs/framework/utils"
import DispenseDecision from "./models/dispense-decision"
import PharmacistAdjustmentLog from "./models/pharmacist-adjustment-log"
import PharmacistNote from "./models/pharmacist-note"
import PreDispatchSignOff from "./models/pre-dispatch-sign-off"

/**
 * DispenseModuleService — per-line pharmacist decisions, H1 register,
 * pre-dispatch sign-off. Core clinical module.
 */
class DispenseModuleService extends MedusaService({
  DispenseDecision,
  PharmacistAdjustmentLog,
  PharmacistNote,
  PreDispatchSignOff,
}) {
  // TODO: makeDecision(), partialApproval(), h1RegisterWrite(),
  //       preDispatchCheck(), logAdjustment()
}

export default DispenseModuleService
