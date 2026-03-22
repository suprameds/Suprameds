import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const DEFAULT_WAREHOUSE_STATE = "Telangana"
const FREE_DELIVERY_THRESHOLD = 300

interface DeliveryEstimate {
  min_days: number
  max_days: number
  display_text: string
  is_same_state: boolean
  free_delivery_above: number
}

/**
 * GET /store/delivery-estimate
 * Query params: state (buyer's state), city_type (metro | tier2 | tier3 | rural, default metro)
 *
 * Returns estimated delivery days based on the DeliveryDaysLookup table.
 * Falls back to a conservative default if no matching entry is found.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { state, city_type = "metro" } = req.query as {
    state: string
    city_type?: string
  }

  if (!state) {
    res.status(400).json({ message: "Query param 'state' is required" })
    return
  }

  const shipmentService = req.scope.resolve("pharmaShipment") as any
  const sellerState = process.env.WAREHOUSE_STATE || DEFAULT_WAREHOUSE_STATE
  const isSameState = sellerState.toLowerCase() === state.toLowerCase()

  try {
    const [lookup] = await shipmentService.listDeliveryDaysLookups(
      {
        origin_state: sellerState,
        dest_state: state,
        city_type,
      },
      { take: 1 }
    )

    if (lookup) {
      const estimate: DeliveryEstimate = {
        min_days: lookup.min_days,
        max_days: lookup.max_days,
        display_text: lookup.display_text,
        is_same_state: isSameState,
        free_delivery_above: FREE_DELIVERY_THRESHOLD,
      }
      res.json(estimate)
      return
    }

    // No matching entry — return conservative default
    const fallback: DeliveryEstimate = {
      min_days: 5,
      max_days: 7,
      display_text: "5-7 business days",
      is_same_state: isSameState,
      free_delivery_above: FREE_DELIVERY_THRESHOLD,
    }
    res.json(fallback)
  } catch (err) {
    const logger = req.scope.resolve("logger")
    logger.error(`[delivery-estimate] Failed to fetch estimate: ${err}`)
    res.status(500).json({ message: "Unable to compute delivery estimate" })
  }
}
