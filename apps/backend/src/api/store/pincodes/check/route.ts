import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { WAREHOUSE_MODULE } from "../../../../modules/warehouse"

/**
 * GET /store/pincodes/check?pincode=500001
 *
 * Customer-facing pincode serviceability check.
 * Returns whether delivery is available and estimated delivery time.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { pincode } = req.query as { pincode?: string }

  if (!pincode || !/^\d{6}$/.test(pincode)) {
    return res.status(400).json({
      serviceable: false,
      message: "Please enter a valid 6-digit pincode",
    })
  }

  try {
    const warehouseService = req.scope.resolve(WAREHOUSE_MODULE) as any
    const result = await warehouseService.checkPincode(pincode)

    if (!result.serviceable) {
      return res.json({
        serviceable: false,
        message: `Sorry, we don't deliver to pincode ${pincode} yet`,
      })
    }

    return res.json({
      serviceable: true,
      pincode,
      district: result.district,
      state: result.state,
      estimated_delivery: result.estimated_days,
      free_delivery_above: 300,
      message: `Delivery available! Estimated ${result.estimated_days}`,
    })
  } catch (error: any) {
    return res.status(500).json({
      serviceable: false,
      message: "Unable to check serviceability right now",
    })
  }
}
