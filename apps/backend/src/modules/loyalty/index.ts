import LoyaltyModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const LOYALTY_MODULE = "pharmaLoyalty"

export default Module(LOYALTY_MODULE, {
  service: LoyaltyModuleService,
})
