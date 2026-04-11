import {
  AbstractPaymentProvider,
} from "@medusajs/framework/utils"

// paytmchecksum is CJS — use require
// @ts-ignore
const PaytmChecksum = require("paytmchecksum")

const LOG = "[paytm-provider]"

type PaytmOptions = {
  merchant_id: string
  merchant_key: string
  website_name: string
  callback_url: string
  test_mode?: boolean
}

type PaytmTxnResponse = {
  body: {
    resultInfo: { resultStatus: string; resultCode: string; resultMsg: string }
    txnId?: string
    orderId?: string
    txnAmount?: string
    txnDate?: string
    gatewayName?: string
    bankName?: string
    paymentMode?: string
    bankTxnId?: string
  }
  head: { signature: string }
}

class PaytmPaymentProviderService extends AbstractPaymentProvider<PaytmOptions> {
  static identifier = "paytm"

  private merchantId: string
  private merchantKey: string
  private websiteName: string
  private callbackUrl: string
  private baseUrl: string

  constructor(container: Record<string, unknown>, options: PaytmOptions) {
    // @ts-ignore — Medusa container typing mismatch
    super(container, options)

    this.merchantId = options.merchant_id
    this.merchantKey = options.merchant_key
    this.websiteName = options.website_name || "DEFAULT"
    this.callbackUrl = options.callback_url
    this.baseUrl = options.test_mode
      ? "https://securegw-stage.paytm.in"
      : "https://securegw.paytm.in"

    if (!this.merchantId || !this.merchantKey) {
      throw new Error("Paytm merchant_id and merchant_key are required")
    }
  }

  // ── Helper: sign and call Paytm API ─────────────────────────────────

  private async paytmRequest<T = any>(
    path: string,
    body: Record<string, any>
  ): Promise<T> {
    const signature = await PaytmChecksum.generateSignature(
      JSON.stringify(body),
      this.merchantKey
    )

    const payload = { body, head: { signature } }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Paytm API error (${res.status}): ${text}`)
    }

    return res.json() as Promise<T>
  }

  // ── Core Medusa payment provider methods ────────────────────────────

  async initiatePayment(input: any): Promise<any> {
    const { amount, currency_code, context } = input

    const orderId =
      (context?.session_id as string) ||
      (context?.extra?.session_id as string) ||
      `ORD_${Date.now()}`

    const customerId =
      (context?.customer?.id as string) || `CUST_${Date.now()}`

    const paytmBody = {
      requestType: "Payment",
      mid: this.merchantId,
      websiteName: this.websiteName,
      orderId,
      txnAmount: {
        value: String(amount.toFixed(2)),
        currency: (currency_code || "INR").toUpperCase(),
      },
      userInfo: { custId: customerId },
      callbackUrl: this.callbackUrl,
    }

    try {
      const result = await this.paytmRequest<{
        body: {
          resultInfo: { resultStatus: string; resultCode: string; resultMsg: string }
          txnToken?: string
        }
        head: { signature: string }
      }>(
        `/theia/api/v1/initiateTransaction?mid=${this.merchantId}&orderId=${orderId}`,
        paytmBody
      )

      if (result.body.resultInfo.resultStatus === "F") {
        return {
          error: result.body.resultInfo.resultMsg || "Paytm initiation failed",
          code: result.body.resultInfo.resultCode,
          detail: result.body.resultInfo.resultMsg,
        }
      }

      return {
        id: orderId,
        data: {
          paytmOrderId: orderId,
          txnToken: result.body.txnToken,
          mid: this.merchantId,
          amount,
          currency: (currency_code || "INR").toUpperCase(),
          callbackUrl: this.callbackUrl,
        },
      }
    } catch (err: any) {
      return {
        error: err.message || "Failed to initiate Paytm payment",
        code: "PAYTM_INITIATE_ERROR",
        detail: err.message,
      }
    }
  }

  async authorizePayment(input: any): Promise<any> {
    const orderId = input.data?.paytmOrderId as string

    if (!orderId) {
      return { status: "error", data: input.data || {} }
    }

    try {
      const status = await this.queryTransactionStatus(orderId)

      return {
        status: status.sessionStatus,
        data: {
          ...input.data,
          paytmTxnId: status.txnId,
          paytmStatus: status.resultStatus,
          paytmPaymentMode: status.paymentMode,
          paytmBankName: status.bankName,
          paytmBankTxnId: status.bankTxnId,
        },
      }
    } catch (err: any) {
      return {
        status: "error",
        data: { ...input.data, error: err.message },
      }
    }
  }

  async capturePayment(input: any): Promise<any> {
    // Paytm auto-captures — just verify success state
    const orderId = input.data?.paytmOrderId as string

    if (!orderId) {
      return { data: input.data || {} }
    }

    try {
      const status = await this.queryTransactionStatus(orderId)

      return {
        data: {
          ...input.data,
          paytmTxnId: status.txnId,
          capturedAt: new Date().toISOString(),
        },
      }
    } catch (err: any) {
      return {
        error: err.message || "Paytm capture verification failed",
        code: "PAYTM_CAPTURE_ERROR",
        detail: err.message,
      }
    }
  }

  async refundPayment(input: any): Promise<any> {
    const orderId = input.data?.paytmOrderId as string
    const txnId = input.data?.paytmTxnId as string

    if (!orderId || !txnId) {
      return {
        error: "Missing orderId or txnId for refund",
        code: "PAYTM_REFUND_MISSING_DATA",
        detail: "Cannot process refund without Paytm order and transaction IDs",
      }
    }

    const refundId = `RFND_${Date.now()}`

    try {
      const result = await this.paytmRequest<{
        body: {
          resultInfo: { resultStatus: string; resultCode: string; resultMsg: string }
          refundId?: string
        }
        head: { signature: string }
      }>("/refund/apply", {
        mid: this.merchantId,
        txnType: "REFUND",
        orderId,
        txnId,
        refId: refundId,
        refundAmount: String(input.amount.toFixed(2)),
      })

      if (
        result.body.resultInfo.resultStatus === "PENDING" ||
        result.body.resultInfo.resultStatus === "TXN_SUCCESS"
      ) {
        return {
          data: {
            ...input.data,
            paytmRefundId: result.body.refundId || refundId,
            refundAmount: input.amount,
            refundStatus: result.body.resultInfo.resultStatus,
          },
        }
      }

      return {
        error: result.body.resultInfo.resultMsg || "Paytm refund failed",
        code: result.body.resultInfo.resultCode,
        detail: result.body.resultInfo.resultMsg,
      }
    } catch (err: any) {
      return {
        error: err.message || "Paytm refund request failed",
        code: "PAYTM_REFUND_ERROR",
        detail: err.message,
      }
    }
  }

  async cancelPayment(input: any): Promise<any> {
    // Paytm auto-expires uncompleted transactions
    return { data: input.data || {} }
  }

  async deletePayment(input: any): Promise<any> {
    // No-op — sessions cleaned up by Paytm automatically
    return { data: input.data || {} }
  }

  async getPaymentStatus(input: any): Promise<any> {
    const orderId = input.data?.paytmOrderId as string

    if (!orderId) return { status: "pending" }

    try {
      const status = await this.queryTransactionStatus(orderId)
      return { status: status.sessionStatus }
    } catch {
      return { status: "pending" }
    }
  }

  async retrievePayment(input: any): Promise<any> {
    return { data: input.data || {} }
  }

  async updatePayment(input: any): Promise<any> {
    const { amount, currency_code, context } = input

    if (amount && amount !== (input.data?.amount as number)) {
      return this.initiatePayment({
        amount,
        currency_code: currency_code || "inr",
        context: context || {},
      })
    }

    return { data: input.data || {} }
  }

  async getWebhookActionAndData(payload: any): Promise<any> {
    const data = payload.data as Record<string, any>

    const orderId = data.ORDERID || data.orderId
    const txnStatus = data.STATUS || data.resultInfo?.resultStatus
    const checksumHash = data.CHECKSUMHASH

    // Verify checksum if present
    if (checksumHash) {
      const verifyData = { ...data }
      delete verifyData.CHECKSUMHASH

      const isValid = await PaytmChecksum.verifySignature(
        JSON.stringify(verifyData),
        this.merchantKey,
        checksumHash
      )

      if (!isValid) {
        console.warn(`${LOG} Invalid checksum for order ${orderId}`)
        return { action: "not_supported" }
      }
    }

    if (txnStatus === "TXN_SUCCESS") {
      return {
        action: "authorized",
        data: {
          session_id: orderId,
          amount: data.TXNAMOUNT ? parseFloat(data.TXNAMOUNT) : undefined,
        },
      }
    }

    if (txnStatus === "TXN_FAILURE") {
      return {
        action: "failed",
        data: { session_id: orderId },
      }
    }

    return { action: "not_supported" }
  }

  // ── Internal helpers ────────────────────────────────────────────────

  private async queryTransactionStatus(orderId: string) {
    const result = await this.paytmRequest<PaytmTxnResponse>(
      "/v3/order/status",
      { mid: this.merchantId, orderId }
    )

    const { resultInfo } = result.body
    let sessionStatus = "pending"
    if (resultInfo.resultStatus === "TXN_SUCCESS") {
      sessionStatus = "authorized"
    } else if (resultInfo.resultStatus === "TXN_FAILURE") {
      sessionStatus = "error"
    }

    return {
      resultStatus: resultInfo.resultStatus,
      resultMsg: resultInfo.resultMsg,
      txnId: result.body.txnId || "",
      sessionStatus,
      paymentMode: result.body.paymentMode,
      bankName: result.body.bankName,
      bankTxnId: result.body.bankTxnId,
    }
  }
}

export default PaytmPaymentProviderService
