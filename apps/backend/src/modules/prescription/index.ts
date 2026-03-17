import PrescriptionModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const PRESCRIPTION_MODULE = "pharmaPrescription"

export default Module(PRESCRIPTION_MODULE, {
  service: PrescriptionModuleService,
})
