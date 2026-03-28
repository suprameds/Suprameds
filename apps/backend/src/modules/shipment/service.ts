import { MedusaService } from "@medusajs/framework/utils"
import Shipment from "./models/shipment"
import ShipmentItem from "./models/shipment-item"
import DeliveryOtpLog from "./models/delivery-otp-log"
import DeliveryDaysLookup from "./models/delivery-days-lookup"

class ShipmentModuleService extends MedusaService({
  Shipment,
  ShipmentItem,
  DeliveryOtpLog,
  DeliveryDaysLookup,
}) {
  async createShipment(data: {
    order_id: string
    warehouse_id: string
    contains_rx_drug: boolean
    is_cod?: boolean
    cod_amount?: number
    items: Array<{
      order_item_id: string
      batch_id: string
      quantity_shipped: number
      batch_number: string
      expiry_date: Date
    }>
    estimated_delivery?: Date
  }) {
    const year = new Date().getFullYear()
    const existing = await this.listShipments(
      {},
      { order: { created_at: "DESC" }, take: 1 }
    )

    let seq = 1
    if (existing.length > 0) {
      const parts = existing[0].shipment_number.split("-")
      seq = parseInt(parts[2] ?? "0", 10) + 1
    }

    const shipmentNumber = `SHP-${year}-${String(seq).padStart(6, "0")}`

    let deliveryOtp: string | null = null
    if (data.contains_rx_drug) {
      deliveryOtp = String(Math.floor(100000 + Math.random() * 900000))
    }

    const shipment = await this.createShipments({
      order_id: data.order_id,
      shipment_number: shipmentNumber,
      carrier: "india-post",
      service_type: "speed-post",
      warehouse_id: data.warehouse_id,
      contains_rx_drug: data.contains_rx_drug,
      is_cod: data.is_cod ?? false,
      cod_amount: data.cod_amount ?? 0,
      estimated_delivery: data.estimated_delivery ?? null,
      delivery_otp: deliveryOtp,
      status: "label_created",
    })

    for (const item of data.items) {
      await this.createShipmentItems({
        shipment_id: shipment.id,
        order_item_id: item.order_item_id,
        batch_id: item.batch_id,
        quantity_shipped: item.quantity_shipped,
        batch_number: item.batch_number,
        expiry_date: item.expiry_date,
      })
    }

    return shipment
  }

  async enterAwb(shipmentId: string, awbNumber: string, dispatchedBy: string) {
    const awbPattern = /^(EU|EE|CP|EM|ED)\d{9}IN$/i
    if (!awbPattern.test(awbNumber)) {
      throw new Error(`Invalid AWB format: ${awbNumber}. Expected: EU/EE/CP + 9 digits + IN`)
    }

    return await this.updateShipments({
      id: shipmentId,
      awb_number: awbNumber.toUpperCase(),
      dispatched_at: new Date(),
      dispatched_by: dispatchedBy,
      status: "in_transit",
    })
  }

  async registerAfterShip(shipmentId: string, aftershipTrackingId: string) {
    return await this.updateShipments({
      id: shipmentId,
      aftership_tracking_id: aftershipTrackingId,
    })
  }

  async sendDeliveryOtp(data: { shipment_id: string; phone: string }) {
    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const maskedPhone = data.phone.replace(/(\d{2})\d{6}(\d{2})/, "$1******$2")

    const log = await this.createDeliveryOtpLogs({
      shipment_id: data.shipment_id,
      otp_code: otp,
      sent_to_phone: maskedPhone,
      attempts: 0,
      verified: false,
    })

    await this.updateShipments({ id: data.shipment_id, delivery_otp: otp })

    return { log_id: log.id, otp }
  }

  async verifyDeliveryOtp(shipmentId: string, otp: string) {
    const shipment = await this.retrieveShipment(shipmentId)

    if (shipment.delivery_otp !== otp) {
      const [log] = await this.listDeliveryOtpLogs({ shipment_id: shipmentId })
      if (log) {
        const newAttempts = (log.attempts ?? 0) + 1
        await this.updateDeliveryOtpLogs({
          id: log.id,
          attempts: newAttempts,
          failed_reason: newAttempts >= 3 ? "max_attempts_exceeded" : null,
        })
      }
      return { verified: false, reason: "Invalid OTP" }
    }

    await this.updateShipments({ id: shipmentId, delivery_otp_verified: true })

    const [log] = await this.listDeliveryOtpLogs({ shipment_id: shipmentId })
    if (log) {
      await this.updateDeliveryOtpLogs({ id: log.id, verified: true, verified_at: new Date() })
    }

    return { verified: true }
  }

  async handleNdr(shipmentId: string, action: "reattempt" | "rto", reason: string) {
    const shipment = await this.retrieveShipment(shipmentId)
    const updates: Record<string, unknown> = { ndr_reason: reason, ndr_action: action }

    if (action === "rto") {
      updates.status = "rto_initiated"
    } else {
      updates.status = "out_for_delivery"
      updates.delivery_attempts = (shipment.delivery_attempts ?? 0) + 1
    }

    return await this.updateShipments({ id: shipmentId, ...updates })
  }

  async getDeliveryEstimate(
    originState: string,
    destState: string,
    cityType: "metro" | "tier2" | "tier3" | "rural" = "metro"
  ) {
    const [lookup] = await this.listDeliveryDaysLookups({
      origin_state: originState,
      dest_state: destState,
      city_type: cityType,
    })

    if (!lookup) {
      return { min_days: 5, max_days: 10, display_text: "5-10 business days" }
    }

    return {
      min_days: lookup.min_days,
      max_days: lookup.max_days,
      display_text: lookup.display_text,
    }
  }
}

export default ShipmentModuleService
