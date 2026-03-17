import PaymentModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const PAYMENT_MODULE = "pharmaPayment"

export default Module(PAYMENT_MODULE, {
  service: PaymentModuleService,
})
