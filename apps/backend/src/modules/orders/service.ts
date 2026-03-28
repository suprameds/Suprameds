import { MedusaService } from "@medusajs/framework/utils"
import OrderExtension from "./models/order-extension"
import OrderStateHistory from "./models/order-state-history"
import CsPlacedOrder from "./models/cs-placed-order"
import GuestSession from "./models/guest-session"
import PartialShipmentPreference from "./models/partial-shipment-preference"

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_cod_confirmation: ["pending_rx_review", "cancelled"],
  pending_rx_review: ["partially_approved", "fully_approved", "cancelled"],
  partially_approved: ["payment_captured", "cancelled"],
  fully_approved: ["payment_captured", "cancelled"],
  payment_captured: ["allocation_pending"],
  allocation_pending: ["pick_pending", "partially_fulfilled", "cancelled"],
  pick_pending: ["packing", "cancelled"],
  packing: ["pending_dispatch_approval"],
  pending_dispatch_approval: ["dispatched", "packing"],
  dispatched: ["delivered", "partially_fulfilled"],
  delivered: ["refunded"],
  partially_fulfilled: ["delivered", "dispatched", "refunded"],
  cancelled: ["refunded"],
  refunded: [],
}

class OrdersModuleService extends MedusaService({
  OrderExtension,
  OrderStateHistory,
  CsPlacedOrder,
  GuestSession,
  PartialShipmentPreference,
}) {
  async createGuestOrder(data: {
    phone: string
    email?: string
    cart_id?: string
    session_token: string
  }) {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    return await this.createGuestSessions({
      session_token: data.session_token,
      phone: data.phone,
      email: data.email ?? null,
      cart_id: data.cart_id ?? null,
      expires_at: expiresAt,
      converted_to: null,
    })
  }

  async createRxOrder(data: {
    order_id: string
    prescription_id: string
    is_cod?: boolean
    cod_amount?: number
    is_guest_order?: boolean
    gstin?: string
  }) {
    return await this.createOrderExtensions({
      order_id: data.order_id,
      is_rx_order: true,
      is_guest_order: data.is_guest_order ?? false,
      prescription_id: data.prescription_id,
      is_cod: data.is_cod ?? false,
      cod_amount: data.cod_amount ?? 0,
      cod_confirmation_status: data.is_cod ? "pending" : "not_required",
      status: data.is_cod ? "pending_cod_confirmation" : "pending_rx_review",
      gstin: data.gstin ?? null,
    })
  }

  async applyPartialApprovals(
    order_id: string,
    approvedAmount: number,
    rejectedAmount: number,
    changedBy: string
  ) {
    const [ext] = await this.listOrderExtensions({ order_id })
    if (!ext) throw new Error(`Order extension not found for order ${order_id}`)

    const updated = await this.updateOrderExtensions({
      id: ext.id,
      is_partial_approval: true,
      payment_captured_amount: approvedAmount,
      payment_released_amount: rejectedAmount,
    })

    await this.orderStateMachine(
      order_id,
      "partially_approved",
      changedBy,
      `Partial approval: approved=${approvedAmount}, released=${rejectedAmount}`
    )

    return updated
  }

  async recalculateOrderTotals(
    order_id: string,
    capturedAmount: number,
    releasedAmount: number
  ) {
    const [ext] = await this.listOrderExtensions({ order_id })
    if (!ext) throw new Error(`Order extension not found for order ${order_id}`)

    return await this.updateOrderExtensions({
      id: ext.id,
      payment_captured_amount: capturedAmount,
      payment_released_amount: releasedAmount,
      payment_authorized_amount: capturedAmount + releasedAmount,
    })
  }

  async orderStateMachine(
    order_id: string,
    newStatus: string,
    changedBy: string,
    reason?: string
  ) {
    const [ext] = await this.listOrderExtensions({ order_id })
    if (!ext) throw new Error(`Order extension not found for order ${order_id}`)

    const currentStatus = ext.status
    const allowed = VALID_TRANSITIONS[currentStatus] ?? []

    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Invalid order transition: ${currentStatus} -> ${newStatus}. Allowed: [${allowed.join(", ")}]`
      )
    }

    await this.updateOrderExtensions({ id: ext.id, status: newStatus as any })

    await this.createOrderStateHistories({
      order_id,
      from_status: currentStatus,
      to_status: newStatus,
      changed_by: changedBy,
      reason: reason ?? null,
    })

    return { from: currentStatus, to: newStatus }
  }

  async csPlaceOrder(data: {
    order_id: string
    agent_id: string
    customer_id?: string
    customer_phone: string
    channel: "whatsapp" | "phone" | "email" | "walk_in"
    payment_method: "cod" | "payment_link" | "prepaid_existing"
    payment_link_id?: string
    notes?: string
    is_rx_order?: boolean
    prescription_id?: string
  }) {
    const csRecord = await this.createCsPlacedOrders({
      order_id: data.order_id,
      agent_id: data.agent_id,
      customer_id: data.customer_id ?? null,
      customer_phone: data.customer_phone,
      channel: data.channel,
      payment_method: data.payment_method,
      payment_link_id: data.payment_link_id ?? null,
      notes: data.notes ?? null,
    })

    const isCod = data.payment_method === "cod"
    await this.createOrderExtensions({
      order_id: data.order_id,
      is_cs_placed: true,
      cs_agent_id: data.agent_id,
      is_rx_order: data.is_rx_order ?? false,
      prescription_id: data.prescription_id ?? null,
      is_cod: isCod,
      cod_confirmation_status: isCod ? "confirmed" : "not_required",
      cod_confirmed_by: isCod ? data.agent_id : null,
      cod_confirmed_at: isCod ? new Date() : null,
      status: data.is_rx_order ? "pending_rx_review" : "allocation_pending",
    })

    return csRecord
  }

  async handlePartialShipment(data: {
    order_id: string
    customer_id: string
    choice: "ship_available" | "wait_for_all" | "cancel_oos_item"
    oos_items: unknown[]
  }) {
    const pref = await this.createPartialShipmentPreferences({
      order_id: data.order_id,
      customer_id: data.customer_id,
      choice: data.choice,
      oos_items: data.oos_items as any,
      chosen_at: new Date(),
    })

    const [ext] = await this.listOrderExtensions({ order_id: data.order_id })
    if (ext) {
      const pref_value = data.choice === "cancel_oos_item"
        ? "ship_available"
        : data.choice === "wait_for_all"
          ? "customer_choice"
          : data.choice
      await this.updateOrderExtensions({
        id: ext.id,
        partial_shipment_preference: pref_value as any,
      })
    }

    return pref
  }
}

export default OrdersModuleService
