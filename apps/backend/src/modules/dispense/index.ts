import DispenseModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const DISPENSE_MODULE = "pharmaDispense"

export default Module(DISPENSE_MODULE, {
  service: DispenseModuleService,
})
