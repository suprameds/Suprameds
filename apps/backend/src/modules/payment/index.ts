import PaymentModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const PAYMENT_MODULE = "payment"

export default Module(PAYMENT_MODULE, {
  service: PaymentModuleService,
})
