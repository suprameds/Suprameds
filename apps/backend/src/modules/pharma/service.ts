import { MedusaService } from "@medusajs/framework/utils"
import DrugProduct from "./models/drug-product"

class PharmaModuleService extends MedusaService({
  DrugProduct,
}) {}

export default PharmaModuleService
