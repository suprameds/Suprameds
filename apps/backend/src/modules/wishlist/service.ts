import { MedusaService } from "@medusajs/framework/utils"
import WishlistItem from "./models/wishlist-item"

class WishlistModuleService extends MedusaService({ WishlistItem }) {
  async getWishlistForCustomer(customerId: string) {
    return this.listWishlistItems({ customer_id: customerId })
  }

  async isProductWishlisted(
    customerId: string,
    productId: string
  ): Promise<boolean> {
    const items = await this.listWishlistItems({
      customer_id: customerId,
      product_id: productId,
    })
    return items.length > 0
  }

  async getPopularWishlistedProducts(
    limit = 10
  ): Promise<{ product_id: string; count: number }[]> {
    const all = await this.listWishlistItems({})
    const counts: Record<string, number> = {}
    for (const item of all) {
      counts[item.product_id] = (counts[item.product_id] || 0) + 1
    }
    return Object.entries(counts)
      .map(([product_id, count]) => ({ product_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }
}

export default WishlistModuleService
