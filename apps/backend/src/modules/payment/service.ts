import { MedusaService } from "@medusajs/framework/utils"
import PaymentRecord from "./models/payment-record"
import Refund from "./models/refund"
import SupplyMemo from "./models/supply-memo"
import CodRefundDetails from "./models/cod-refund-details"

class PaymentModuleService extends MedusaService({
  PaymentRecord,
  Refund,
  SupplyMemo,
  CodRefundDetails,
}) {
  async authorizeFull(data: {
    order_id: string
    gateway: "paytm" | "razorpay" | "stripe" | "cod"
    gateway_payment_id?: string
    payment_method: string
    amount: number
  }) {
    return await this.createPaymentRecords({
      order_id: data.order_id,
      gateway: data.gateway,
      gateway_payment_id: data.gateway_payment_id ?? null,
      payment_method: data.payment_method as any,
      authorized_amount: data.amount,
      captured_amount: 0,
      released_amount: 0,
      refunded_amount: 0,
      status: data.gateway === "cod" ? "cod_pending" : "authorized",
    })
  }

  async captureApproved(paymentId: string, amount: number) {
    const record = await this.retrievePaymentRecord(paymentId)
    const available = record.authorized_amount - record.captured_amount - record.released_amount

    if (amount > available) {
      throw new Error(`Cannot capture ${amount}: only ${available} available`)
    }

    const newCaptured = record.captured_amount + amount
    const isFullySettled = newCaptured + record.released_amount >= record.authorized_amount

    return await this.updatePaymentRecords({
      id: paymentId,
      captured_amount: newCaptured,
      captured_at: new Date(),
      status: isFullySettled ? "fully_captured" : "partially_captured",
    })
  }

  async releaseRejected(paymentId: string, amount: number) {
    const record = await this.retrievePaymentRecord(paymentId)
    const available = record.authorized_amount - record.captured_amount - record.released_amount

    if (amount > available) {
      throw new Error(`Cannot release ${amount}: only ${available} available for release`)
    }

    const newReleased = record.released_amount + amount
    const isFullySettled = record.captured_amount + newReleased >= record.authorized_amount

    return await this.updatePaymentRecords({
      id: paymentId,
      released_amount: newReleased,
      status: isFullySettled
        ? (record.captured_amount > 0 ? "fully_captured" : "voided")
        : "partially_captured",
    })
  }

  async processRefund(data: {
    payment_id: string
    order_id: string
    raised_by: string
    reason: string
    amount: number
  }) {
    return await this.createRefunds({
      payment_id: data.payment_id,
      order_id: data.order_id,
      raised_by: data.raised_by,
      approved_by: null,
      reason: data.reason as any,
      amount: data.amount,
      status: "pending_approval",
      gateway_refund_id: null,
      processed_at: null,
    })
  }

  async generatePaymentLink(data: {
    order_id: string
    amount: number
    customer_phone: string
    expiry_minutes?: number
  }) {
    return await this.createPaymentRecords({
      order_id: data.order_id,
      gateway: "paytm",
      gateway_payment_id: null,
      payment_method: "payment_link",
      authorized_amount: data.amount,
      status: "authorized",
      metadata: {
        type: "payment_link",
        customer_phone: data.customer_phone,
        expiry_minutes: data.expiry_minutes ?? 60,
        created_at: new Date().toISOString(),
      },
    })
  }

  async generateSupplyMemo(data: {
    order_id: string
    shipment_id?: string
    customer_name: string
    customer_address: string
    prescription_ref?: string
    pharmacist_name: string
    pharmacist_reg: string
    pharmacy_license: string
    items: Array<{
      drug_name: string
      batch_number: string
      expiry_date: string
      quantity: number
      mrp: number
      selling_price: number
      gst_percent: number
    }>
    payment_mode: string
  }) {
    let totalMrp = 0
    let totalDiscount = 0
    let totalGst = 0

    for (const item of data.items) {
      const mrpTotal = item.mrp * item.quantity
      const sellingTotal = item.selling_price * item.quantity
      totalMrp += mrpTotal
      totalDiscount += mrpTotal - sellingTotal
      totalGst += sellingTotal * (item.gst_percent / 100)
    }

    const totalPayable = totalMrp - totalDiscount + totalGst

    const year = new Date().getFullYear()
    const existing = await this.listSupplyMemoes(
      {},
      { order: { created_at: "DESC" }, take: 1 }
    )

    let seq = 1
    if (existing.length > 0) {
      const parts = existing[0].memo_number.split("-")
      seq = parseInt(parts[2] ?? "0", 10) + 1
    }

    const memoNumber = `EPHM-${year}-${String(seq).padStart(6, "0")}`

    return await this.createSupplyMemoes({
      memo_number: memoNumber,
      order_id: data.order_id,
      shipment_id: data.shipment_id ?? null,
      customer_name: data.customer_name,
      customer_address: data.customer_address,
      prescription_ref: data.prescription_ref ?? null,
      pharmacist_name: data.pharmacist_name,
      pharmacist_reg: data.pharmacist_reg,
      pharmacy_license: data.pharmacy_license,
      items: data.items as any,
      total_mrp: totalMrp,
      total_discount: totalDiscount,
      total_gst: totalGst,
      total_payable: totalPayable,
      payment_mode: data.payment_mode,
      generated_at: new Date(),
    })
  }
}

export default PaymentModuleService
