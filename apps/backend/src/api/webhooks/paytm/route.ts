import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, PaymentActions } from "@medusajs/framework/utils"

// @ts-ignore
const PaytmChecksum = require("paytmchecksum")

const PROVIDER = "paytm_paytm"
const LOG = "[webhook:paytm]"

/**
 * Paytm Webhook / Callback Handler
 *
 * Receives payment callback from Paytm after checkout completion.
 * Verifies checksum, maps Paytm status to Medusa payment actions,
 * and runs process-payment-workflow for successful payments.
 *
 * Always returns 200 to prevent Paytm retry loops.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger")
  logger.info(`${LOG} Callback received`)

  const merchantKey = process.env.PAYTM_MERCHANT_KEY
  if (!merchantKey) {
    logger.warn(`${LOG} PAYTM_MERCHANT_KEY not configured — ignoring callback`)
    return res.status(200).json({ received: true })
  }

  try {
    const body = req.body as Record<string, any>
    const orderId = body.ORDERID || body.orderId
    const txnStatus = body.STATUS || body.status
    const txnId = body.TXNID || body.txnId
    const checksumHash = body.CHECKSUMHASH

    logger.info(
      `${LOG} Order: ${orderId ?? "n/a"}, Status: ${txnStatus ?? "n/a"}, TxnId: ${txnId ?? "n/a"}`
    )

    // Verify checksum
    if (checksumHash && merchantKey) {
      // Remove CHECKSUMHASH from the data before verification
      const verifyData = { ...body }
      delete verifyData.CHECKSUMHASH

      const isValid = await PaytmChecksum.verifySignature(
        JSON.stringify(verifyData),
        merchantKey,
        checksumHash
      )

      if (!isValid) {
        logger.error(`${LOG} Invalid checksum for order ${orderId}`)
        return res.status(200).json({ received: true })
      }

      logger.info(`${LOG} Checksum verified for order ${orderId}`)
    }

    // Delegate to payment module webhook handler
    const paymentModule = req.scope.resolve(Modules.PAYMENT) as any
    const result = await paymentModule.getWebhookActionAndData({
      provider: PROVIDER,
      payload: {
        data: body,
        rawData: (req as any).rawBody || Buffer.from(JSON.stringify(body)),
        headers: req.headers,
      },
    })

    logger.info(
      `${LOG} Resolved action: ${result.action}, session_id: ${result.data?.session_id ?? "n/a"}`
    )

    // Only process AUTHORIZED and SUCCESSFUL actions
    const processableActions: string[] = [
      PaymentActions.AUTHORIZED,
      PaymentActions.SUCCESSFUL,
    ]

    if (!result.data || !processableActions.includes(result.action)) {
      logger.info(`${LOG} Action "${result.action}" — no workflow processing needed`)
      return res.status(200).json({ received: true })
    }

    // Run Medusa's processPaymentWorkflow
    const workflowEngine = req.scope.resolve(Modules.WORKFLOW_ENGINE) as any
    await workflowEngine.run("process-payment-workflow", { input: result })

    logger.info(
      `${LOG} Successfully processed "${result.action}" for session ${result.data.session_id}`
    )
  } catch (error) {
    const err = error as Error
    logger.error(`${LOG} Processing error: ${err.message} – ${err.stack ?? ""}`)
  }

  // Always 200 — prevent Paytm retry loops
  return res.status(200).json({ received: true })
}
