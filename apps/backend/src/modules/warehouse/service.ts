import { MedusaService } from "@medusajs/framework/utils"
import Warehouse from "./models/warehouse"
import WarehouseZone from "./models/warehouse-zone"
import WarehouseBin from "./models/warehouse-bin"
import WarehouseTask from "./models/warehouse-task"
import PickListLine from "./models/pick-list-line"
import GrnRecord from "./models/grn-record"
import Supplier from "./models/supplier"
import ReturnsInspection from "./models/returns-inspection"

/**
 * WarehouseModuleService — zones, bins, GRN, pick/pack/dispatch tasks,
 * returns inspection. Single ambient warehouse operations.
 */
class WarehouseModuleService extends MedusaService({
  Warehouse,
  WarehouseZone,
  WarehouseBin,
  WarehouseTask,
  PickListLine,
  GrnRecord,
  Supplier,
  ReturnsInspection,
}) {
  // TODO: receiveGrn(), qcApprove(), putAway(),
  //       generatePickList(), confirmPick(), packOrder(),
  //       dispatch(), inspectReturn()
}

export default WarehouseModuleService
