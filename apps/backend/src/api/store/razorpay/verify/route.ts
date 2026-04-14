import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import crypto from "crypto"
import { createLogger } from "../../../../lib/logger"

const log = createLogger("razorpay-verify")

interface VerifyBody {
  cart_id: string
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

/**
 * POST /store/razorpay/verify
 *
 * Verifies the Razorpay payment signature and authorizes the
 * corresponding Medusa payment session. This must be called BEFORE
 * cart.complete() so the payment is already authorized when Medusa
 * runs the completeCartWorkflow.
 *
 * Body:
 *  - cart_id: Medusa cart ID
 *  - razorpay_payment_id: from Razorpay handler callback
 *  - razorpay_order_id: from Razorpay handler callback
 *  - razorpay_signature: from Razorpay handler callback
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const {
    cart_id,
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
  } = req.body as VerifyBody

  // ── Validate input ──────────────────────────────────────────────────
  if (!cart_id || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Missing required fields: cart_id, razorpay_payment_id, razorpay_order_id, razorpay_signature",
    )
  }

  // ── Verify Razorpay signature ───────────────────────────────────────
  const keySecret =
    process.env.RAZORPAY_TEST_KEY_SECRET ||
    process.env.RAZORPAY_KEY_SECRET

  if (!keySecret) {
    log.error("Razorpay key secret not configured")
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Payment verification is not configured",
    )
  }

  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex")

  if (expectedSignature !== razorpay_signature) {
    log.warn("Razorpay signature mismatch", {
      cart_id,
      razorpay_order_id,
      razorpay_payment_id,
    })
    res.status(400).json({
      success: false,
      message: "Payment verification failed — signature mismatch",
    })
    return
  }

  log.info("Razorpay signature verified", {
    cart_id,
    razorpay_order_id,
    razorpay_payment_id,
  })

  // ── Retrieve cart + payment session ────────────────────────────────
  const cartModule = req.scope.resolve(Modules.CART) as any
  const paymentModule = req.scope.resolve(Modules.PAYMENT) as any

  let cart: any
  try {
    cart = await cartModule.retrieveCart(cart_id, {
      relations: ["payment_collection", "payment_collection.payment_sessions"],
    })
  } catch {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cart not found")
  }

  const paymentCollection = cart.payment_collection
  if (!paymentCollection) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Cart has no payment collection",
    )
  }

  // Find the Razorpay payment session (provider_id contains "razorpay")
  const razorpaySession = paymentCollection.payment_sessions?.find(
    (s: any) =>
      s.provider_id?.includes("razorpay") && s.status === "pending",
  )

  if (!razorpaySession) {
    log.warn("No pending Razorpay session found on cart", { cart_id })
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No pending Razorpay payment session found",
    )
  }

  // ── Authorize the payment session ─────────────────────────────────
  try {
    await paymentModule.authorizePaymentSession(razorpaySession.id, {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    })
    log.info("Payment session authorized", {
      session_id: razorpaySession.id,
      cart_id,
    })
  } catch (err) {
    log.error("Failed to authorize payment session", {
      session_id: razorpaySession.id,
      error: err instanceof Error ? err.message : String(err),
    })
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Failed to authorize payment. Please try again.",
    )
  }

  res.json({ success: true })
}
