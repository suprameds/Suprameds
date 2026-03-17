import { MedusaService } from "@medusajs/framework/utils"
import Shipment from "./models/shipment"
import ShipmentItem from "./models/shipment-item"
import DeliveryOtpLog from "./models/delivery-otp-log"
import DeliveryDaysLookup from "./models/delivery-days-lookup"

/**
 * ShipmentModuleService — AWB entry, tracking, OTP delivery, NDR management.
 * India Post Speed Post as sole carrier.
 */
class ShipmentModuleService extends MedusaService({
  Shipment,
  ShipmentItem,
  DeliveryOtpLog,
  DeliveryDaysLookup,
}) {
  // TODO: createShipment(), enterAwb(), registerAfterShip(),
  //       sendDeliveryOtp(), verifyDeliveryOtp(), handleNdr(),
  //       getDeliveryEstimate()
}

export default ShipmentModuleService
