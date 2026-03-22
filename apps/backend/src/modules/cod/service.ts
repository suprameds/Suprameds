import { MedusaService } from "@medusajs/framework/utils"
import CodOrder from "./models/cod-order"
import CodCustomerScore from "./models/cod-customer-score"

// Auto-cancel threshold: 30 minutes without confirmation
const COD_TIMEOUT_MS = 30 * 60 * 1000

/**
 * CodModuleService — COD confirmation calls, customer scoring,
 * remittance tracking, RTO management.
 *
 * MedusaService auto-generates: createCodOrders, updateCodOrders,
 * listCodOrders, retrieveCodOrder, deleteCodOrders,
 * createCodCustomerScores, updateCodCustomerScores, etc.
 */
class CodModuleService extends MedusaService({
  CodOrder,
  CodCustomerScore,
}) {
  /**
   * Confirm a COD order — customer has acknowledged via IVR / SMS / CS call.
   * Transitions status from pending_confirmation → confirmed.
   */
  async confirmOrder(
    codOrderId: string,
    phoneVerified: boolean = false
  ): Promise<any> {
    const existing = await this.retrieveCodOrder(codOrderId)

    if (existing.status !== "pending_confirmation") {
      throw new Error(
        `COD order ${codOrderId} cannot be confirmed — current status: ${existing.status}`
      )
    }

    return this.updateCodOrders({
      id: codOrderId,
      status: "confirmed",
      confirmed_at: new Date(),
      phone_verified: phoneVerified,
    })
  }

  /**
   * Auto-cancel unconfirmed COD orders that have exceeded the timeout window.
   * Returns the list of cancelled COD order IDs.
   */
  async autoCancelExpired(): Promise<string[]> {
    const cutoff = new Date(Date.now() - COD_TIMEOUT_MS)
    const cancelledIds: string[] = []

    // Fetch all pending orders that require confirmation
    const pending = await this.listCodOrders(
      {
        status: "pending_confirmation",
        confirmation_required: true,
      },
      { take: null }
    )

    for (const codOrder of pending as any[]) {
      const createdAt = new Date(codOrder.created_at)
      if (createdAt < cutoff) {
        await this.updateCodOrders({ id: codOrder.id, status: "cancelled" })
        cancelledIds.push(codOrder.id)
      }
    }

    return cancelledIds
  }

  /**
   * Re-evaluate a customer's COD score after an order outcome (delivery/RTO).
   * Applies the scoring rules:
   *   - 1 RTO → limit reduced to ₹500
   *   - 2 consecutive RTOs → COD disabled
   *   - New customers → ₹1000 limit
   */
  async scoreCustomer(
    customerId: string,
    outcome: "delivered" | "rto"
  ): Promise<any> {
    let [score] = await this.listCodCustomerScores(
      { customer_id: customerId },
      { take: 1 }
    ) as any[]

    if (!score) {
      score = await this.createCodCustomerScores({
        customer_id: customerId,
        total_cod_orders: 0,
        cod_rto_count: 0,
        cod_rto_rate: 0,
        consecutive_rtos: 0,
        cod_eligible: true,
        cod_limit: 1000,
      })
    }

    const totalOrders = score.total_cod_orders + 1
    let rtoCount = score.cod_rto_count
    let consecutiveRtos = score.consecutive_rtos

    if (outcome === "rto") {
      rtoCount++
      consecutiveRtos++
    } else {
      consecutiveRtos = 0
    }

    const rtoRate = totalOrders > 0 ? rtoCount / totalOrders : 0

    // Scoring rules
    let codEligible = true
    let codLimit = 1000

    if (consecutiveRtos >= 2) {
      codEligible = false
      codLimit = 0
    } else if (rtoCount >= 1) {
      codLimit = 500
    }

    return this.updateCodCustomerScores({
      id: score.id,
      total_cod_orders: totalOrders,
      cod_rto_count: rtoCount,
      cod_rto_rate: rtoRate,
      consecutive_rtos: consecutiveRtos,
      cod_eligible: codEligible,
      cod_limit: codLimit,
      last_evaluated_at: new Date(),
    })
  }

  /**
   * Handle RTO event — update COD order status and re-score customer.
   */
  async handleRto(codOrderId: string, customerId: string): Promise<void> {
    await this.updateCodOrders({ id: codOrderId, status: "rto" })
    await this.scoreCustomer(customerId, "rto")
  }

  /**
   * Record a confirmation attempt (CS team called, no answer).
   */
  async recordAttempt(codOrderId: string): Promise<any> {
    const existing = await this.retrieveCodOrder(codOrderId)
    return this.updateCodOrders({
      id: codOrderId,
      confirmation_attempts: (existing as any).confirmation_attempts + 1,
    })
  }
}

export default CodModuleService
