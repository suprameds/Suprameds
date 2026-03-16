import { MedusaService } from "@medusajs/framework/utils"
import Batch from "./models/batch"
import BatchDeduction from "./models/batch-deduction"

class InventoryBatchModuleService extends MedusaService({
  Batch,
  BatchDeduction,
}) {}

export default InventoryBatchModuleService
