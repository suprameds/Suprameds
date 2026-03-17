import OrdersModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const ORDERS_MODULE = "orders"

export default Module(ORDERS_MODULE, {
  service: OrdersModuleService,
})
