/**
 * Unit tests for LoyaltyModuleService custom business logic.
 * MedusaService is not imported — all CRUD operations are faked in-memory.
 */

// ---------- constants (mirrored from service) ----------

const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 500,
  gold: 2000,
  platinum: 5000,
}

const POINTS_PER_RUPEE = 1

// ---------- builder helpers ----------

let _idCounter = 0
function uid(prefix: string) {
  return `${prefix}_${++_idCounter}`
}

function buildAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("acc"),
    customer_id: uid("cust"),
    points_balance: 0,
    tier: "bronze" as "bronze" | "silver" | "gold" | "platinum",
    lifetime_points: 0,
    referral_code: null as string | null,
    ...overrides,
  }
}

function buildTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: uid("txn"),
    account_id: uid("acc"),
    type: "earn" as "earn" | "burn" | "expire" | "adjust",
    points: 100,
    reference_type: null as string | null,
    reference_id: null as string | null,
    reason: null as string | null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

// ---------- FakeLoyaltyService ----------

class FakeLoyaltyService {
  private accounts: ReturnType<typeof buildAccount>[] = []
  private transactions: ReturnType<typeof buildTransaction>[] = []

  _seedAccounts(data: ReturnType<typeof buildAccount>[]) {
    this.accounts = data
  }
  _seedTransactions(data: ReturnType<typeof buildTransaction>[]) {
    this.transactions = data
  }

  // Internal mocks
  private async listLoyaltyAccounts(
    filters: Record<string, unknown>,
    _opts?: { take: null }
  ) {
    return this.accounts.filter((a) =>
      Object.entries(filters).every(([k, v]) => a[k as keyof typeof a] === v)
    )
  }

  private async createLoyaltyAccounts(data: Record<string, unknown>) {
    const a = buildAccount(data)
    this.accounts.push(a)
    return a
  }

  private async updateLoyaltyAccounts(data: Record<string, unknown>) {
    const idx = this.accounts.findIndex((a) => a.id === data.id)
    if (idx === -1) throw new Error(`LoyaltyAccount ${data.id} not found`)
    this.accounts[idx] = { ...this.accounts[idx], ...data } as ReturnType<typeof buildAccount>
    return this.accounts[idx]
  }

  private async createLoyaltyTransactions(data: Record<string, unknown>) {
    const t = buildTransaction(data)
    this.transactions.push(t)
    return t
  }

  private async listLoyaltyTransactions(filters: Record<string, unknown>) {
    return this.transactions.filter((t) =>
      Object.entries(filters).every(([k, v]) => t[k as keyof typeof t] === v)
    )
  }

  // ---- computeTier helper (mirrors service.ts private method) ----
  private computeTier(lifetimePoints: number): "bronze" | "silver" | "gold" | "platinum" {
    if (lifetimePoints >= TIER_THRESHOLDS.platinum) return "platinum"
    if (lifetimePoints >= TIER_THRESHOLDS.gold) return "gold"
    if (lifetimePoints >= TIER_THRESHOLDS.silver) return "silver"
    return "bronze"
  }

  private makeReferralCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    let code = "SM-"
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  // ---- Public service methods (mirrors service.ts) ----

  async earnPoints(data: {
    customer_id: string
    order_id: string
    otc_amount: number
  }) {
    const points = Math.floor(data.otc_amount * POINTS_PER_RUPEE)
    if (points <= 0) return null

    let [account] = await this.listLoyaltyAccounts({ customer_id: data.customer_id })

    if (!account) {
      account = await this.createLoyaltyAccounts({
        customer_id: data.customer_id,
        points_balance: 0,
        tier: "bronze",
        lifetime_points: 0,
      })
    }

    const txn = await this.createLoyaltyTransactions({
      account_id: account.id,
      type: "earn",
      points,
      reference_type: "order",
      reference_id: data.order_id,
      reason: `Earned from OTC order ${data.order_id}`,
    })

    const newBalance = account.points_balance + points
    const newLifetime = account.lifetime_points + points
    const newTier = this.computeTier(newLifetime)

    await this.updateLoyaltyAccounts({
      id: account.id,
      points_balance: newBalance,
      lifetime_points: newLifetime,
      tier: newTier,
    })

    return { transaction: txn, new_balance: newBalance, tier: newTier }
  }

  async burnPoints(data: {
    customer_id: string
    order_id: string
    points: number
  }) {
    const [account] = await this.listLoyaltyAccounts({ customer_id: data.customer_id })

    if (!account) {
      throw new Error(`No loyalty account found for customer ${data.customer_id}`)
    }

    if (data.points > account.points_balance) {
      throw new Error(
        `Insufficient points: requested ${data.points}, available ${account.points_balance}`
      )
    }

    const txn = await this.createLoyaltyTransactions({
      account_id: account.id,
      type: "burn",
      points: -data.points,
      reference_type: "order",
      reference_id: data.order_id,
      reason: `Redeemed on order ${data.order_id}`,
    })

    const newBalance = account.points_balance - data.points
    await this.updateLoyaltyAccounts({ id: account.id, points_balance: newBalance })

    return { transaction: txn, new_balance: newBalance }
  }

  async expirePoints(daysOld: number = 365) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - daysOld)

    const accounts = await this.listLoyaltyAccounts({}, { take: null })

    let expiredCount = 0
    let totalExpired = 0

    for (const account of accounts) {
      if (account.points_balance <= 0) continue

      const oldTxns = await this.listLoyaltyTransactions({
        account_id: account.id,
        type: "earn",
      })

      const expirablePoints = oldTxns
        .filter((t) => new Date(t.created_at) < cutoff)
        .reduce((sum, t) => sum + t.points, 0)

      if (expirablePoints <= 0) continue

      const pointsToExpire = Math.min(expirablePoints, account.points_balance)

      await this.createLoyaltyTransactions({
        account_id: account.id,
        type: "expire",
        points: -pointsToExpire,
        reason: `Points expired (older than ${daysOld} days)`,
      })

      await this.updateLoyaltyAccounts({
        id: account.id,
        points_balance: account.points_balance - pointsToExpire,
      })

      expiredCount++
      totalExpired += pointsToExpire
    }

    return { accounts_affected: expiredCount, points_expired: totalExpired }
  }

  async calculateTier(customerId: string) {
    const [account] = await this.listLoyaltyAccounts({ customer_id: customerId })
    if (!account) return "bronze"

    const tier = this.computeTier(account.lifetime_points)

    if (tier !== account.tier) {
      await this.updateLoyaltyAccounts({ id: account.id, tier })
    }

    return tier
  }

  async generateReferralCode(customerId: string) {
    const [account] = await this.listLoyaltyAccounts({ customer_id: customerId })

    if (!account) {
      const newAccount = await this.createLoyaltyAccounts({
        customer_id: customerId,
        points_balance: 0,
        tier: "bronze",
        lifetime_points: 0,
        referral_code: this.makeReferralCode(),
      })
      return newAccount.referral_code
    }

    if (account.referral_code) return account.referral_code

    const code = this.makeReferralCode()
    await this.updateLoyaltyAccounts({ id: account.id, referral_code: code })
    return code
  }

  // Expose internals
  _getAccounts() { return this.accounts }
  _getTransactions() { return this.transactions }
}

// ---------- tests ----------

describe("LoyaltyModuleService (unit)", () => {
  let service: FakeLoyaltyService

  beforeEach(() => {
    service = new FakeLoyaltyService()
    _idCounter = 0
  })

  // ── earnPoints ───────────────────────────────────────────────────

  describe("earnPoints()", () => {
    it("creates a new account when none exists and credits the correct points", async () => {
      const result = await service.earnPoints({
        customer_id: "cust_01",
        order_id: "ord_01",
        otc_amount: 250,
      })

      expect(result).not.toBeNull()
      expect(result!.new_balance).toBe(250)
      expect(service._getAccounts()).toHaveLength(1)
      expect(service._getTransactions()).toHaveLength(1)
    })

    it("adds points to an existing account", async () => {
      service._seedAccounts([
        buildAccount({ customer_id: "cust_01", points_balance: 100, lifetime_points: 100 }),
      ])

      const result = await service.earnPoints({
        customer_id: "cust_01",
        order_id: "ord_02",
        otc_amount: 150,
      })

      expect(result!.new_balance).toBe(250)
    })

    it("returns null for a zero-amount OTC order (no points to earn)", async () => {
      const result = await service.earnPoints({
        customer_id: "cust_01",
        order_id: "ord_03",
        otc_amount: 0,
      })

      expect(result).toBeNull()
    })

    it("floors fractional amounts to whole points (1 point per rupee)", async () => {
      const result = await service.earnPoints({
        customer_id: "cust_01",
        order_id: "ord_04",
        otc_amount: 199.99,
      })

      expect(result!.new_balance).toBe(199)
    })

    it("upgrades tier from bronze to silver at 500 lifetime points", async () => {
      service._seedAccounts([
        buildAccount({ customer_id: "cust_01", points_balance: 400, lifetime_points: 400, tier: "bronze" }),
      ])

      const result = await service.earnPoints({
        customer_id: "cust_01",
        order_id: "ord_05",
        otc_amount: 100,
      })

      expect(result!.tier).toBe("silver")
    })

    it("does NOT earn points from Rx-only orders (0 OTC amount)", async () => {
      const result = await service.earnPoints({
        customer_id: "cust_rx",
        order_id: "ord_rx",
        otc_amount: 0,
      })

      expect(result).toBeNull()
    })
  })

  // ── burnPoints ───────────────────────────────────────────────────

  describe("burnPoints()", () => {
    it("deducts points and creates a burn transaction", async () => {
      service._seedAccounts([
        buildAccount({ customer_id: "cust_01", points_balance: 500 }),
      ])

      const result = await service.burnPoints({
        customer_id: "cust_01",
        order_id: "ord_01",
        points: 200,
      })

      expect(result.new_balance).toBe(300)
      expect(result.transaction.type).toBe("burn")
      expect(result.transaction.points).toBe(-200)
    })

    it("throws when customer has no loyalty account", async () => {
      await expect(
        service.burnPoints({ customer_id: "cust_ghost", order_id: "ord_01", points: 100 })
      ).rejects.toThrow("No loyalty account found for customer cust_ghost")
    })

    it("throws on insufficient balance", async () => {
      service._seedAccounts([
        buildAccount({ customer_id: "cust_01", points_balance: 100 }),
      ])

      await expect(
        service.burnPoints({ customer_id: "cust_01", order_id: "ord_01", points: 101 })
      ).rejects.toThrow("Insufficient points: requested 101, available 100")
    })

    it("allows burning exactly the full balance", async () => {
      service._seedAccounts([
        buildAccount({ customer_id: "cust_01", points_balance: 300 }),
      ])

      const result = await service.burnPoints({
        customer_id: "cust_01",
        order_id: "ord_01",
        points: 300,
      })

      expect(result.new_balance).toBe(0)
    })

    it("throws when trying to burn 0 points (boundary: balance=0, request=1)", async () => {
      service._seedAccounts([
        buildAccount({ customer_id: "cust_01", points_balance: 0 }),
      ])

      await expect(
        service.burnPoints({ customer_id: "cust_01", order_id: "ord_01", points: 1 })
      ).rejects.toThrow("Insufficient points")
    })
  })

  // ── calculateTier ────────────────────────────────────────────────

  describe("calculateTier()", () => {
    it("returns bronze for a customer with no account", async () => {
      const tier = await service.calculateTier("cust_ghost")
      expect(tier).toBe("bronze")
    })

    it("returns bronze for lifetime_points < 500", async () => {
      service._seedAccounts([
        buildAccount({ customer_id: "cust_01", lifetime_points: 499, tier: "bronze" }),
      ])

      const tier = await service.calculateTier("cust_01")
      expect(tier).toBe("bronze")
    })

    it("returns silver for lifetime_points exactly 500", async () => {
      service._seedAccounts([
        buildAccount({ customer_id: "cust_01", lifetime_points: 500, tier: "bronze" }),
      ])

      const tier = await service.calculateTier("cust_01")
      expect(tier).toBe("silver")
    })

    it("returns gold for lifetime_points exactly 2000", async () => {
      service._seedAccounts([
        buildAccount({ customer_id: "cust_01", lifetime_points: 2000, tier: "silver" }),
      ])

      const tier = await service.calculateTier("cust_01")
      expect(tier).toBe("gold")
    })

    it("returns platinum for lifetime_points exactly 5000", async () => {
      service._seedAccounts([
        buildAccount({ customer_id: "cust_01", lifetime_points: 5000, tier: "gold" }),
      ])

      const tier = await service.calculateTier("cust_01")
      expect(tier).toBe("platinum")
    })

    it("returns platinum for lifetime_points > 5000", async () => {
      service._seedAccounts([
        buildAccount({ customer_id: "cust_01", lifetime_points: 9999, tier: "gold" }),
      ])

      const tier = await service.calculateTier("cust_01")
      expect(tier).toBe("platinum")
    })

    it("updates the account tier when it has drifted", async () => {
      service._seedAccounts([
        buildAccount({ customer_id: "cust_01", lifetime_points: 2000, tier: "bronze" }),
      ])

      await service.calculateTier("cust_01")

      const account = service._getAccounts()[0]
      expect(account.tier).toBe("gold")
    })
  })

  // ── expirePoints ─────────────────────────────────────────────────

  describe("expirePoints()", () => {
    it("returns zero affected accounts when no old transactions exist", async () => {
      service._seedAccounts([
        buildAccount({ id: "acc_01", customer_id: "cust_01", points_balance: 200 }),
      ])

      // All transactions are recent (within 365 days)
      service._seedTransactions([
        buildTransaction({ account_id: "acc_01", type: "earn", points: 200, created_at: new Date().toISOString() }),
      ])

      const result = await service.expirePoints(365)

      expect(result.accounts_affected).toBe(0)
      expect(result.points_expired).toBe(0)
    })

    it("expires points from accounts with old earn transactions", async () => {
      service._seedAccounts([
        buildAccount({ id: "acc_01", customer_id: "cust_01", points_balance: 300 }),
      ])

      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 400)

      service._seedTransactions([
        buildTransaction({ account_id: "acc_01", type: "earn", points: 300, created_at: oldDate.toISOString() }),
      ])

      const result = await service.expirePoints(365)

      expect(result.accounts_affected).toBe(1)
      expect(result.points_expired).toBe(300)

      const account = service._getAccounts()[0]
      expect(account.points_balance).toBe(0)
    })

    it("skips accounts with zero balance even if they have old transactions", async () => {
      service._seedAccounts([
        buildAccount({ id: "acc_01", customer_id: "cust_01", points_balance: 0 }),
      ])

      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 400)

      service._seedTransactions([
        buildTransaction({ account_id: "acc_01", type: "earn", points: 0, created_at: oldDate.toISOString() }),
      ])

      const result = await service.expirePoints(365)
      expect(result.accounts_affected).toBe(0)
    })
  })

  // ── generateReferralCode ─────────────────────────────────────────

  describe("generateReferralCode()", () => {
    it("creates an account with referral code when none exists", async () => {
      const code = await service.generateReferralCode("cust_new")

      expect(code).toBeTruthy()
      expect(typeof code).toBe("string")
      expect(code as string).toMatch(/^SM-[A-Z2-9]{6}$/)
      expect(service._getAccounts()).toHaveLength(1)
    })

    it("returns the existing referral code without re-generating", async () => {
      service._seedAccounts([
        buildAccount({ customer_id: "cust_01", referral_code: "SM-ABCDEF" }),
      ])

      const code = await service.generateReferralCode("cust_01")
      expect(code).toBe("SM-ABCDEF")
    })

    it("generates and saves a new code if account exists but has no code", async () => {
      service._seedAccounts([
        buildAccount({ id: "acc_01", customer_id: "cust_01", referral_code: null }),
      ])

      const code = await service.generateReferralCode("cust_01")

      expect(code).toBeTruthy()
      expect(code as string).toMatch(/^SM-/)

      const account = service._getAccounts()[0]
      expect(account.referral_code).toBe(code)
    })
  })
})
