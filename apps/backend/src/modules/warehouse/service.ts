import { MedusaService } from "@medusajs/framework/utils"
import Warehouse from "./models/warehouse"
import WarehouseZone from "./models/warehouse-zone"
import WarehouseBin from "./models/warehouse-bin"
import WarehouseTask from "./models/warehouse-task"
import PickListLine from "./models/pick-list-line"
import GrnRecord from "./models/grn-record"
import Supplier from "./models/supplier"
import ReturnsInspection from "./models/returns-inspection"
import ServiceablePincode from "./models/serviceable-pincode"

/**
 * WarehouseModuleService — zones, bins, GRN, pick/pack/dispatch tasks,
 * returns inspection, pincode serviceability. Single ambient warehouse operations.
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
  ServiceablePincode,
}) {
  /**
   * Check if a pincode is serviceable for delivery.
   * Returns the pincode record if serviceable, null otherwise.
   */
  async checkPincode(pincode: string): Promise<{
    serviceable: boolean
    district?: string
    state?: string
    delivery_type?: string
    estimated_days?: string
  }> {
    const records = (await this.listServiceablePincodes(
      { pincode, is_serviceable: true, delivery: "Delivery" },
      { take: 1 }
    )) as any[]

    if (records.length === 0) {
      return { serviceable: false }
    }

    const rec = records[0]
    const warehouseState = (process.env.WAREHOUSE_STATE || "Telangana").toLowerCase()
    const isSameState = rec.statename?.toLowerCase() === warehouseState
    const estimatedDays = isSameState ? "1-2 days" : "5-7 days"

    return {
      serviceable: true,
      district: rec.district,
      state: rec.statename,
      delivery_type: rec.delivery,
      estimated_days: estimatedDays,
    }
  }

}

export default WarehouseModuleService
