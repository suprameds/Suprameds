import { MedusaService } from "@medusajs/framework/utils"
import PaymentRecord from "./models/payment-record"
import Refund from "./models/refund"
import SupplyMemo from "./models/supply-memo"
import CodRefundDetails from "./models/cod-refund-details"

/**
 * PaymentModuleService — Razorpay/Stripe/COD orchestration,
 * auth/capture split, refund management, supply memo generation.
 */
class PaymentModuleService extends MedusaService({
  PaymentRecord,
  Refund,
  SupplyMemo,
  CodRefundDetails,
}) {
  // TODO: authorizeFull(), captureApproved(), releaseRejected(),
  //       processRefund(), generatePaymentLink(), generateSupplyMemo()
}

export default PaymentModuleService
