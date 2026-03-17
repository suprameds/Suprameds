import OrdersModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const ORDERS_MODULE = "pharmaOrder"

export default Module(ORDERS_MODULE, {
  service: OrdersModuleService,
})
