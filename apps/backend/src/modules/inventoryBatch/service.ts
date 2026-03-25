import { MedusaService } from "@medusajs/framework/utils"
import Batch from "./models/batch"
import BatchAuditLog from "./models/batch-audit-log"
import BatchDeduction from "./models/batch-deduction"
import PurchaseOrder from "./models/purchase-order"
import PurchaseOrderLine from "./models/purchase-order-line"

class InventoryBatchModuleService extends MedusaService({
  Batch,
  BatchAuditLog,
  BatchDeduction,
  PurchaseOrder,
  PurchaseOrderLine,
}) {}

export default InventoryBatchModuleService
