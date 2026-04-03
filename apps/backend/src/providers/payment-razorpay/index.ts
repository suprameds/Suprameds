/**
 * Local Razorpay payment provider that wraps the community plugin
 * and sanitizes the customer phone number before sending to Razorpay.
 *
 * Razorpay's API rejects contact numbers with anything besides
 * digits and '+'. This patch strips invalid chars (spaces, dashes, etc.)
 * from the phone before account-holder creation.
 */
import path from "path"

const pluginRoot = path.join(
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require.resolve("medusa-plugin-razorpay-v2/package.json"),
  ".."
)

const basePath = path.join(
  pluginRoot,
  ".medusa",
  "server",
  "src",
  "providers",
  "payment-razorpay",
  "src",
  "core",
  "razorpay-base.js"
)

// eslint-disable-next-line @typescript-eslint/no-require-imports
const RazorpayBase = require(basePath).default

const originalCreateAccountHolder =
  RazorpayBase.prototype.createAccountHolder

RazorpayBase.prototype.createAccountHolder = async function (input: any) {
  if (input?.context?.customer?.phone) {
    input.context.customer.phone = input.context.customer.phone.replace(
      /[^\d+]/g,
      ""
    )
  }
  return originalCreateAccountHolder.call(this, input)
}

// Patch deletePayment to handle missing session IDs gracefully.
// When switching from COD → Razorpay, Medusa calls deletePayment on the
// Razorpay provider with the COD session data (which has no Razorpay payment ID).
// The plugin throws "paymentSession - id must be defined" — we swallow it.
const originalDeletePayment = RazorpayBase.prototype.deletePayment
RazorpayBase.prototype.deletePayment = async function (input: any) {
  try {
    return await originalDeletePayment.call(this, input)
  } catch (err: any) {
    if (err?.message?.includes("id must be defined")) {
      // No Razorpay payment to cancel — safe to ignore (e.g., switching from COD)
      return {}
    }
    throw err
  }
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const communityProvider = require(
  "medusa-plugin-razorpay-v2/providers/payment-razorpay/src"
)

export default communityProvider.default ?? communityProvider
