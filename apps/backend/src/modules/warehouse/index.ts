import WarehouseModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const WAREHOUSE_MODULE = "warehouse"

export default Module(WAREHOUSE_MODULE, {
  service: WarehouseModuleService,
})
