import PharmaModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const PHARMA_MODULE = "pharma"

export default Module(PHARMA_MODULE, {
  service: PharmaModuleService,
})
