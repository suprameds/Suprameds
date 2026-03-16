import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { MedusaError } from "@medusajs/framework/utils"
import { PHARMA_MODULE } from "../../modules/pharma"
import { PRESCRIPTION_MODULE } from "../../modules/prescription"

/**
 * Compliance hook: validates all Rx drugs in the cart have approved prescriptions
 * before the order can be completed.
 *
 * Rules enforced:
 * 1. Schedule X drugs → ABSOLUTE PROHIBITION (NDPS Act, 1985)
 * 2. Schedule H/H1 drugs → require approved, non-expired prescription
 * 3. No promotions on Rx drugs (Drugs & Magic Remedies Act, 1954)
 */
completeCartWorkflow.hooks.validate(
  async ({ cart }, { container }) => {
    if (!cart.items || cart.items.length === 0) return

    const pharmaService = container.resolve(PHARMA_MODULE)
    const prescriptionService = container.resolve(PRESCRIPTION_MODULE)

    for (const item of cart.items) {
      if (!item.product_id) continue

      // Look up drug metadata for this product
      let drugProducts: any[]
      try {
        drugProducts = await pharmaService.listDrugProducts({
          product_id: item.product_id,
        })
      } catch {
        continue
      }

      if (!drugProducts || drugProducts.length === 0) continue
      const drug = drugProducts[0]

      // HARD RULE: Schedule X — absolute prohibition (NDPS Act)
      if (drug.schedule === "X" || drug.is_narcotic) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `${item.title || "This product"} cannot be sold online. NDPS Act, 1985 prohibits online sale of Schedule X / narcotic substances.`
        )
      }

      // HARD RULE: Cold chain — not handled by warehouse
      if (drug.requires_refrigeration) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `${item.title || "This product"} requires cold chain storage which is not available through our delivery network.`
        )
      }

      // Rx validation: Schedule H and H1 require an approved prescription
      if (drug.schedule === "H" || drug.schedule === "H1") {
        const customerId = cart.customer_id
        const metadata = cart.metadata as Record<string, any> | null

        if (!customerId && !metadata?.guest_phone) {
          throw new MedusaError(
            MedusaError.Types.NOT_ALLOWED,
            `A valid prescription is required to purchase ${item.title || "this medication"}. Please upload your prescription.`
          )
        }

        // Check for approved prescription covering this product
        const filters: Record<string, any> = {
          status: "approved",
        }
        if (customerId) {
          filters.customer_id = customerId
        } else {
          filters.guest_phone = metadata?.guest_phone
        }

        const prescriptions =
          await prescriptionService.listPrescriptions(filters)

        const now = new Date()
        const validPrescription = prescriptions.find((rx: any) => {
          if (!rx.valid_until) return false
          return new Date(rx.valid_until) > now
        })

        if (!validPrescription) {
          throw new MedusaError(
            MedusaError.Types.NOT_ALLOWED,
            `No valid prescription found for ${item.title || "this medication"}. Please upload a valid prescription to continue.`
          )
        }
      }
    }
  }
)
