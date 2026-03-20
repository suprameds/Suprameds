// Local shim so Medusa resolves the Razorpay provider from project source.
// The community package exports this provider under a nested path.
export { default } from "medusa-plugin-razorpay-v2/providers/payment-razorpay/src"

