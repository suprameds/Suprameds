import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules, MedusaError } from "@medusajs/framework/utils"
import { PAYMENT_MODULE } from "../../modules/payment"

type ProcessRefundInput = {
  refund_id: string
}

/**
 * Fetches the refund and validates it is in approved status.
 * Returns the refund record for downstream steps.
 */
export const validateApprovedRefundStep = createStep(
  "validate-approved-refund-step",
  async (input: { refund_id: string }, { container }) => {
    const paymentService = container.resolve(PAYMENT_MODULE) as any

    const [refund] = await paymentService.listRefunds(
      { id: input.refund_id },
      { select: ["id", "status", "payment_id", "order_id", "amount", "raised_by", "approved_by", "metadata"] }
    )

    if (!refund) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Refund ${input.refund_id} not found`
      )
    }

    if (refund.status !== "approved") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Refund ${input.refund_id} is not in approved status (current: ${refund.status}). ` +
          `Refund must be approved before processing.`
      )
    }

    return new StepResponse(refund)
  }
)

/**
 * Fetches the PaymentRecord linked to this refund to determine the gateway.
 * Returns the payment record and resolved gateway type.
 */
export const resolvePaymentMethodStep = createStep(
  "resolve-payment-method-step",
  async (input: { payment_id: string }, { container }) => {
    const paymentService = container.resolve(PAYMENT_MODULE) as any

    const [payment] = await paymentService.listPaymentRecords(
      { id: input.payment_id },
      { select: ["id", "gateway", "gateway_payment_id", "payment_method"] }
    )

    if (!payment) {
      // payment_id may not exist yet if order was COD without a gateway record
      return new StepResponse({ payment: null, is_paytm: false, is_razorpay: false, is_cod: true })
    }

    const isPaytm = payment.gateway === "paytm"

    const isRazorpay =
      payment.gateway === "razorpay" ||
      (payment.gateway_payment_id &&
        typeof payment.gateway_payment_id === "string" &&
        payment.gateway_payment_id.startsWith("pay_"))

    const isCod = payment.gateway === "cod" || payment.payment_method === "cod"

    return new StepResponse({ payment, is_paytm: isPaytm, is_razorpay: isRazorpay, is_cod: isCod })
  }
)

/**
 * Executes the gateway-level refund call.
 * - Razorpay: calls the Razorpay Refunds API (normal speed).
 * - COD: checks if bank details have been submitted; if not, adds a metadata note
 *   so the finance team knows to collect them before marking processed.
 *
 * Returns { gateway_refund_id, needs_bank_details }.
 */
export const processGatewayRefundStep = createStep(
  "process-gateway-refund-step",
  async (
    input: {
      refund_id: string
      payment: any
      is_paytm: boolean
      is_razorpay: boolean
      is_cod: boolean
      amount: number
    },
    { container }
  ) => {
    const logger = container.resolve("logger") as any

    // Paytm refund
    if (input.is_paytm && input.payment?.gateway_payment_id) {
      try {
        // @ts-ignore
        const PaytmChecksum = require("paytmchecksum")
        const refId = `RFND_${Date.now()}`

        const paytmBody = {
          mid: process.env.PAYTM_MERCHANT_ID,
          txnType: "REFUND",
          orderId: input.payment.metadata?.paytmOrderId || input.payment.order_id,
          txnId: input.payment.gateway_payment_id,
          refId,
          refundAmount: String(input.amount.toFixed(2)),
        }

        const signature = await PaytmChecksum.generateSignature(
          JSON.stringify(paytmBody),
          process.env.PAYTM_MERCHANT_KEY
        )

        const baseUrl = process.env.PAYTM_TEST_MODE === "true"
          ? "https://securegw-stage.paytm.in"
          : "https://securegw.paytm.in"

        const res = await fetch(`${baseUrl}/refund/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: paytmBody, head: { signature } }),
        })

        const result = await res.json() as any

        if (result.body?.resultInfo?.resultStatus === "PENDING" ||
            result.body?.resultInfo?.resultStatus === "TXN_SUCCESS") {
          logger.info(
            `[process-refund] Paytm refund initiated: ${refId} for txn ${input.payment.gateway_payment_id}`
          )
          return new StepResponse({
            gateway_refund_id: result.body?.refundId || refId,
            needs_bank_details: false,
          })
        }

        throw new Error(result.body?.resultInfo?.resultMsg || "Paytm refund failed")
      } catch (err: any) {
        logger.error(`[process-refund] Paytm refund failed: ${err.message}`)
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `Paytm refund failed: ${err.message}`
        )
      }
    }

    // Razorpay refund (backup gateway)
    if (input.is_razorpay && input.payment?.gateway_payment_id) {
      try {
        const Razorpay = require("razorpay")
        const razorpay = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET,
        })

        const rzRefund = await razorpay.payments.refund(
          input.payment.gateway_payment_id,
          {
            amount: Math.round(input.amount * 100), // Razorpay expects paise
            speed: "normal",
            notes: {
              refund_id: input.refund_id,
            },
          }
        )

        logger.info(
          `[process-refund] Razorpay refund created: ${rzRefund.id} for payment ${input.payment.gateway_payment_id}`
        )

        return new StepResponse({
          gateway_refund_id: rzRefund.id,
          needs_bank_details: false,
        })
      } catch (err: any) {
        logger.error(`[process-refund] Razorpay refund failed: ${err.message}`)
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `Razorpay refund failed: ${err.message}`
        )
      }
    }

    if (input.is_cod) {
      // Check whether bank/UPI details have been submitted for this refund
      const paymentService = container.resolve(PAYMENT_MODULE) as any
      const [codDetails] = await paymentService.listCodRefundDetails(
        { refund_id: input.refund_id }
      )

      if (!codDetails) {
        logger.warn(
          `[process-refund] COD refund ${input.refund_id} — no bank details submitted yet. ` +
            `Finance team must collect account details before transfer.`
        )
        // We do not throw — refund will be processed with a note in metadata
        return new StepResponse({
          gateway_refund_id: null,
          needs_bank_details: true,
        })
      }

      // Bank details exist; finance team will do the NEFT/UPI transfer manually
      logger.info(
        `[process-refund] COD refund ${input.refund_id} — bank details found (verified: ${codDetails.verified}). Marking for NEFT transfer.`
      )

      return new StepResponse({
        gateway_refund_id: "COD-NEFT",
        needs_bank_details: false,
      })
    }

    // Unknown gateway — log and mark manually
    logger.warn(
      `[process-refund] Refund ${input.refund_id} — unknown gateway. Marking as manual.`
    )
    return new StepResponse({
      gateway_refund_id: "MANUAL",
      needs_bank_details: false,
    })
  }
)

/**
 * Updates the refund record to processed status with gateway reference.
 * Compensation is a no-op: a processed refund cannot be un-processed.
 */
export const updateRefundProcessedStep = createStep(
  "update-refund-processed-step",
  async (
    input: {
      refund_id: string
      gateway_refund_id: string | null
      needs_bank_details: boolean
    },
    { container }
  ) => {
    const paymentService = container.resolve(PAYMENT_MODULE) as any

    const updatePayload: Record<string, any> = {
      id: input.refund_id,
      status: "processed",
      processed_at: new Date(),
    }

    if (input.gateway_refund_id) {
      updatePayload.gateway_refund_id = input.gateway_refund_id
    }

    if (input.needs_bank_details) {
      updatePayload.metadata = {
        processing_note:
          "COD refund: awaiting bank/UPI details from customer. Submit via POST /admin/refunds/:id/cod-bank-details.",
      }
      // Keep status as approved until bank details are collected
      updatePayload.status = "approved"
    }

    const updated = await paymentService.updateRefunds(updatePayload)

    return new StepResponse(updated)
  },
  // Compensation: no-op — we cannot un-process a gateway refund
  async (_data: any, { container }) => {
    const logger = container.resolve("logger") as any
    logger.warn("[process-refund] Compensation called on updateRefundProcessedStep — no-op. Gateway refund cannot be reversed automatically.")
  }
)

/**
 * Generates a SupplyMemo linked to the processed refund for audit trail.
 */
export const generateSupplyMemoStep = createStep(
  "generate-supply-memo-step",
  async (
    input: {
      refund: any
      gateway_refund_id: string | null
    },
    { container }
  ) => {
    const paymentService = container.resolve(PAYMENT_MODULE) as any
    const logger = container.resolve("logger") as any

    try {
      const memoNumber = `RFDM-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`

      const memo = await paymentService.createSupplyMemos({
        memo_number: memoNumber,
        order_id: input.refund.order_id,
        shipment_id: null,
        customer_name: "Customer",
        customer_address: "On file",
        prescription_ref: null,
        pharmacist_name: "System",
        pharmacist_reg: "N/A",
        pharmacy_license: process.env.PHARMACY_LICENSE_NO || "N/A",
        items: [],
        total_mrp: input.refund.amount,
        total_discount: 0,
        total_gst: 0,
        total_payable: input.refund.amount,
        payment_mode: "refund",
        generated_at: new Date(),
        metadata: {
          refund_id: input.refund.id,
          gateway_refund_id: input.gateway_refund_id,
          type: "refund_memo",
        },
      })

      logger.info(`[process-refund] Supply memo created: ${memo.memo_number}`)
      return new StepResponse({ memo })
    } catch (err: any) {
      // Supply memo generation failure should not block refund processing
      logger.warn(`[process-refund] Supply memo creation failed: ${err.message}`)
      return new StepResponse({ memo: null })
    }
  }
)

/**
 * Emits the refund.processed event to notify downstream subscribers
 * (e.g., customer email notification).
 */
export const emitRefundProcessedStep = createStep(
  "emit-refund-processed-step",
  async (
    data: { refund_id: string; order_id: string; gateway_refund_id: string | null },
    { container }
  ) => {
    const eventBus = container.resolve(Modules.EVENT_BUS) as any
    await eventBus.emit({
      name: "refund.processed",
      data: {
        refund_id: data.refund_id,
        order_id: data.order_id,
        gateway_refund_id: data.gateway_refund_id,
      },
    })
    return new StepResponse(null)
  }
)

/**
 * ProcessRefundWorkflow — executes the gateway refund call for an approved refund.
 * Handles both Razorpay (online) and COD (manual NEFT/UPI transfer) flows.
 */
export const ProcessRefundWorkflow = createWorkflow(
  "process-refund-workflow",
  (input: ProcessRefundInput) => {
    // Step 1: Validate refund is in approved status
    const refund = validateApprovedRefundStep({ refund_id: input.refund_id }) as any

    // Step 2: Determine payment gateway from PaymentRecord
    const paymentInfo = resolvePaymentMethodStep({ payment_id: refund.payment_id }) as any

    // Step 3: Execute gateway refund or validate COD bank details
    const gatewayResult = processGatewayRefundStep({
      refund_id: input.refund_id,
      payment: paymentInfo.payment,
      is_paytm: paymentInfo.is_paytm,
      is_razorpay: paymentInfo.is_razorpay,
      is_cod: paymentInfo.is_cod,
      amount: refund.amount,
    }) as any

    // Step 4: Persist processed status and gateway reference
    const updatedRefund = updateRefundProcessedStep({
      refund_id: input.refund_id,
      gateway_refund_id: gatewayResult.gateway_refund_id,
      needs_bank_details: gatewayResult.needs_bank_details,
    }) as any

    // Step 5: Generate supply memo for audit trail
    generateSupplyMemoStep({
      refund,
      gateway_refund_id: gatewayResult.gateway_refund_id,
    })

    // Step 6: Emit processed event for customer notification
    emitRefundProcessedStep({
      refund_id: input.refund_id,
      order_id: refund.order_id,
      gateway_refund_id: gatewayResult.gateway_refund_id,
    })

    return new WorkflowResponse(updatedRefund)
  }
)
