import { model } from "@medusajs/framework/utils"

/**
 * WishlistItem — a customer's saved product with optional price-drop alert.
 * price_at_addition is stored in paise (₹ × 100).
 */
const WishlistItem = model.define("wishlist_item", {
  id: model.id().primaryKey(),
  customer_id: model.text(),
  product_id: model.text(),
  variant_id: model.text().nullable(),
  price_at_addition: model.number().default(0),
  alert_enabled: model.boolean().default(false),
  alert_threshold_pct: model.number().default(10),
  last_alert_sent_at: model.dateTime().nullable(),
  metadata: model.json().nullable(),
})

export default WishlistItem
