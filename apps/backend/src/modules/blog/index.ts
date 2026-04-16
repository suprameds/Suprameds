import { Module } from "@medusajs/framework/utils"
import BlogModuleService from "./service"

export const BLOG_MODULE = "pharmaBlog"

export default Module(BLOG_MODULE, {
  service: BlogModuleService,
})
