/**
 * Legacy Paytm webhook path — matches the URL configured in Paytm dashboard:
 * https://www.suprameds.in/webhook/paytm_webhook
 *
 * Delegates to the canonical /webhooks/paytm handler.
 */
export { POST } from "../../webhooks/paytm/route"
