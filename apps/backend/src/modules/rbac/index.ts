import RbacModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const RBAC_MODULE = "rbac"

export default Module(RBAC_MODULE, {
  service: RbacModuleService,
})
