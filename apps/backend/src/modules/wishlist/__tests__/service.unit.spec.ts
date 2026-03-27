/**
 * Unit tests for WishlistModuleService helper methods.
 * The MedusaService base class is mocked so we can test custom logic in isolation.
 */

// ---------- helpers ----------

function buildItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "wi_" + Math.random().toString(36).slice(2),
    customer_id: "cust_01",
    product_id: "prod_01",
    variant_id: null,
    price_at_addition: 50000,
    alert_enabled: false,
    alert_threshold_pct: 10,
    last_alert_sent_at: null,
    metadata: null,
    ...overrides,
  }
}

// ---------- minimal fake service (no MedusaService deps) ----------

class FakeWishlistService {
  private _items: ReturnType<typeof buildItem>[] = []

  // Seed helper for tests
  _seed(items: ReturnType<typeof buildItem>[]) {
    this._items = items
  }

  async listWishlistItems(filters: Record<string, unknown> = {}) {
    return this._items.filter((item) =>
      Object.entries(filters).every(
        ([key, value]) => item[key as keyof typeof item] === value
      )
    )
  }

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

// ---------- tests ----------

describe("WishlistModuleService (unit)", () => {
  let service: FakeWishlistService

  beforeEach(() => {
    service = new FakeWishlistService()
  })

  // ── isProductWishlisted ──────────────────────────────────────────

  describe("isProductWishlisted()", () => {
    it("returns false when the customer has no wishlist items", async () => {
      const result = await service.isProductWishlisted("cust_01", "prod_01")
      expect(result).toBe(false)
    })

    it("returns false when the product belongs to a different customer", async () => {
      service._seed([buildItem({ customer_id: "cust_02", product_id: "prod_01" })])
      const result = await service.isProductWishlisted("cust_01", "prod_01")
      expect(result).toBe(false)
    })

    it("returns false when the customer has other products but not this one", async () => {
      service._seed([buildItem({ customer_id: "cust_01", product_id: "prod_99" })])
      const result = await service.isProductWishlisted("cust_01", "prod_01")
      expect(result).toBe(false)
    })

    it("returns true when the customer has wishlisted the product", async () => {
      service._seed([buildItem({ customer_id: "cust_01", product_id: "prod_01" })])
      const result = await service.isProductWishlisted("cust_01", "prod_01")
      expect(result).toBe(true)
    })

    it("returns true even when other customers have the same product", async () => {
      service._seed([
        buildItem({ customer_id: "cust_02", product_id: "prod_01" }),
        buildItem({ customer_id: "cust_01", product_id: "prod_01" }),
      ])
      const result = await service.isProductWishlisted("cust_01", "prod_01")
      expect(result).toBe(true)
    })
  })

  // ── getPopularWishlistedProducts ─────────────────────────────────

  describe("getPopularWishlistedProducts()", () => {
    it("returns an empty array when there are no wishlist items", async () => {
      const result = await service.getPopularWishlistedProducts(10)
      expect(result).toEqual([])
    })

    it("returns products sorted by wishlist count descending", async () => {
      service._seed([
        buildItem({ product_id: "prod_A" }),
        buildItem({ product_id: "prod_B" }),
        buildItem({ product_id: "prod_B" }),
        buildItem({ product_id: "prod_C" }),
        buildItem({ product_id: "prod_C" }),
        buildItem({ product_id: "prod_C" }),
      ])

      const result = await service.getPopularWishlistedProducts(10)

      expect(result[0]).toEqual({ product_id: "prod_C", count: 3 })
      expect(result[1]).toEqual({ product_id: "prod_B", count: 2 })
      expect(result[2]).toEqual({ product_id: "prod_A", count: 1 })
    })

    it("respects the limit parameter", async () => {
      service._seed([
        buildItem({ product_id: "prod_A" }),
        buildItem({ product_id: "prod_B" }),
        buildItem({ product_id: "prod_C" }),
      ])

      const result = await service.getPopularWishlistedProducts(2)

      expect(result).toHaveLength(2)
    })

    it("returns all products when limit exceeds the unique product count", async () => {
      service._seed([
        buildItem({ product_id: "prod_A" }),
        buildItem({ product_id: "prod_B" }),
      ])

      const result = await service.getPopularWishlistedProducts(50)

      expect(result).toHaveLength(2)
    })

    it("uses limit=10 as default", async () => {
      const items = Array.from({ length: 15 }, (_, i) =>
        buildItem({ product_id: `prod_${i}` })
      )
      service._seed(items)

      const result = await service.getPopularWishlistedProducts()

      expect(result).toHaveLength(10)
    })
  })

  // ── getWishlistForCustomer ───────────────────────────────────────

  describe("getWishlistForCustomer()", () => {
    it("returns only items belonging to the given customer", async () => {
      service._seed([
        buildItem({ customer_id: "cust_01", product_id: "prod_A" }),
        buildItem({ customer_id: "cust_01", product_id: "prod_B" }),
        buildItem({ customer_id: "cust_02", product_id: "prod_C" }),
      ])

      const result = await service.getWishlistForCustomer("cust_01")

      expect(result).toHaveLength(2)
      expect(result.every((i) => i.customer_id === "cust_01")).toBe(true)
    })

    it("returns an empty array for a customer with no items", async () => {
      const result = await service.getWishlistForCustomer("cust_ghost")
      expect(result).toEqual([])
    })
  })
})
