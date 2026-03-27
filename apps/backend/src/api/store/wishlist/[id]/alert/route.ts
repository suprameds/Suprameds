import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { WISHLIST_MODULE } from "../../../../../modules/wishlist"

/**
 * POST /store/wishlist/:id/alert
 *
 * Toggles the price-drop alert for a wishlist item.
 * Body: { enabled: boolean, threshold_pct?: number }
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const customerId = (req as any).auth_context?.actor_id
  if (!customerId) {
    return res.status(401).json({ error: "Authentication required" })
  }

  const { id } = req.params
  const { enabled, threshold_pct } = req.body as {
    enabled?: boolean
    threshold_pct?: number
  }

  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "enabled (boolean) is required" })
  }

  const wishlistService = req.scope.resolve(WISHLIST_MODULE) as any

  // Verify ownership
  const [item] = await wishlistService.listWishlistItems({
    id,
    customer_id: customerId,
  })

  if (!item) {
    return res.status(404).json({ error: "Wishlist item not found" })
  }

  const updatePayload: Record<string, unknown> = {
    alert_enabled: enabled,
  }

  if (typeof threshold_pct === "number") {
    if (threshold_pct < 1 || threshold_pct > 100) {
      return res
        .status(400)
        .json({ error: "threshold_pct must be between 1 and 100" })
    }
    updatePayload.alert_threshold_pct = threshold_pct
  }

  const updated = await wishlistService.updateWishlistItems(id, updatePayload)

  return res.json({ wishlist_item: updated })
}
