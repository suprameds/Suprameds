import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import ConditionalShippingService from "./service"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [ConditionalShippingService],
})
