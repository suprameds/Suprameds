import CodModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const COD_MODULE = "pharmaCod"

export default Module(COD_MODULE, {
  service: CodModuleService,
})
