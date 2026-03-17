import { MedusaService } from "@medusajs/framework/utils"
import OrderExtension from "./models/order-extension"
import OrderStateHistory from "./models/order-state-history"
import CsPlacedOrder from "./models/cs-placed-order"
import GuestSession from "./models/guest-session"
import PartialShipmentPreference from "./models/partial-shipment-preference"

/**
 * OrdersModuleService — Order state machine, COD flow, guest orders,
 * CS-placed orders, partial shipment management.
 */
class OrdersModuleService extends MedusaService({
  OrderExtension,
  OrderStateHistory,
  CsPlacedOrder,
  GuestSession,
  PartialShipmentPreference,
}) {
  // TODO: createGuestOrder(), createRxOrder(), applyPartialApprovals(),
  //       recalculateOrderTotals(), orderStateMachine(), csPlaceOrder(),
  //       handlePartialShipment()
}

export default OrdersModuleService
