import RbacModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const RBAC_MODULE = "pharmaRbac"

export default Module(RBAC_MODULE, {
  service: RbacModuleService,
})
