import { MedusaService } from "@medusajs/framework/utils"
import Prescription from "./models/prescription"
import PrescriptionLine from "./models/prescription-line"

class PrescriptionModuleService extends MedusaService({
  Prescription,
  PrescriptionLine,
}) {}

export default PrescriptionModuleService
