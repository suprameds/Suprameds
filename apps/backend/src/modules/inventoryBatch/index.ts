import InventoryBatchModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const INVENTORY_BATCH_MODULE = "inventoryBatch"

export default Module(INVENTORY_BATCH_MODULE, {
  service: InventoryBatchModuleService,
})
