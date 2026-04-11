import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import BulkSmsNotificationProviderService from "./service"

export default ModuleProvider(Modules.NOTIFICATION, {
  services: [BulkSmsNotificationProviderService],
})
