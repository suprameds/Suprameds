import { Button } from "@/components/ui/button"
import { useCompleteCartOrder } from "@/lib/hooks/use-checkout"
import { HttpTypes } from "@medusajs/types"
import { useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useRef, useState } from "react"

interface PaytmSessionData {
  txnToken?: string
  paytmOrderId?: string
  mid?: string
  amount?: number
  currency?: string
  callbackUrl?: string
}

interface PaytmPaymentButtonProps {
  cart: HttpTypes.StoreCart
  session: HttpTypes.StorePaymentSession
  notReady: boolean
  className?: string
}

declare global {
  interface Window {
    Paytm?: {
      CheckoutJS: {
        init: (config: Record<string, any>) => Promise<void>
        invoke: () => Promise<void>
        close: () => void
      }
    }
  }
}

/**
 * Loads the Paytm JS Checkout script dynamically.
 * Returns true when the script is ready.
 */
function usePaytmScript(mid: string | undefined): {
  isLoaded: boolean
  error: string | null
} {
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scriptRef = useRef<HTMLScriptElement | null>(null)

  useEffect(() => {
    if (!mid) return

    // Already loaded
    if (window.Paytm?.CheckoutJS) {
      setIsLoaded(true)
      return
    }

    // Already loading
    if (scriptRef.current) return

    const baseUrl = import.meta.env.VITE_PAYTM_TEST_MODE === "true"
      ? "https://securegw-stage.paytm.in"
      : "https://securegw.paytm.in"

    const script = document.createElement("script")
    script.src = `${baseUrl}/merchantpgpui/checkoutjs/merchants/${mid}.js`
    script.crossOrigin = "anonymous"
    script.async = true

    script.onload = () => {
      if (window.Paytm?.CheckoutJS) {
        setIsLoaded(true)
      } else {
        setError("Paytm checkout failed to initialize")
      }
    }

    script.onerror = () => {
      setError("Failed to load Paytm checkout")
    }

    scriptRef.current = script
    document.body.appendChild(script)

    return () => {
      // Don't remove — Paytm script should persist for the session
    }
  }, [mid])

  return { isLoaded, error }
}

export function PaytmPaymentButton({
  cart,
  session,
  notReady,
  className,
}: PaytmPaymentButtonProps) {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const navigate = useNavigate()
  const completeOrderMutation = useCompleteCartOrder()

  // cart used for prefill data in future enhancements
  void cart

  const sessionData = session?.data as PaytmSessionData | undefined
  const txnToken = sessionData?.txnToken
  const paytmOrderId = sessionData?.paytmOrderId
  const mid = sessionData?.mid || (import.meta.env.VITE_PAYTM_MERCHANT_ID as string)

  const { isLoaded: paytmLoaded, error: paytmError } = usePaytmScript(mid)

  const lockRef = useRef(false)

  const handlePaymentSuccess = useCallback(async () => {
    if (lockRef.current) return
    lockRef.current = true
    try {
      const order = await completeOrderMutation.mutateAsync()
      navigate({
        to: `/order/${order.id}/confirmed`,
        replace: true,
      })
    } catch (err) {
      lockRef.current = false
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to place order"
      )
    } finally {
      setSubmitting(false)
    }
  }, [completeOrderMutation, navigate])

  const handlePayment = useCallback(async () => {
    if (!window.Paytm?.CheckoutJS || !txnToken || !paytmOrderId || !mid) return

    setSubmitting(true)
    setErrorMessage(null)

    const amount = String((session.amount ?? 0).toFixed(2))

    const config = {
      root: "",
      flow: "DEFAULT",
      data: {
        orderId: paytmOrderId,
        token: txnToken,
        tokenType: "TXN_TOKEN",
        amount,
      },
      handler: {
        notifyMerchant: (eventName: string, _data: any) => {
          // Paytm sends various events — APP_CLOSED means user dismissed
          if (eventName === "APP_CLOSED") {
            setSubmitting(false)
            setErrorMessage("Payment cancelled")
          }
        },
        transactionStatus: async (response: Record<string, any>) => {
          // Called after payment attempt — check STATUS field
          if (response.STATUS === "TXN_SUCCESS") {
            await handlePaymentSuccess()
          } else {
            setSubmitting(false)
            setErrorMessage(
              response.RESPMSG || response.resultMsg || "Payment failed"
            )
          }
        },
      },
      merchant: {
        mid,
        name: "Suprameds",
        redirect: false,
      },
      style: {
        headerBackgroundColor: "#1E2D5A",
        headerColor: "#FFFFFF",
        themeBackgroundColor: "#FAFAF8",
        themeColor: "#1E2D5A",
      },
    }

    try {
      await window.Paytm.CheckoutJS.init(config)
      await window.Paytm.CheckoutJS.invoke()
    } catch (err: any) {
      setSubmitting(false)
      setErrorMessage(err?.message || "Paytm checkout failed to open")
    }
  }, [txnToken, paytmOrderId, mid, session.amount, handlePaymentSuccess])

  const disabled =
    notReady ||
    submitting ||
    !paytmLoaded ||
    !txnToken ||
    !paytmOrderId ||
    !mid ||
    !!paytmError

  return (
    <>
      <Button
        disabled={disabled}
        onClick={handlePayment}
        data-testid="place-order-button"
        className={className}
      >
        {submitting ? "Processing…" : !paytmLoaded ? "Loading Paytm…" : "Place Order"}
      </Button>
      {errorMessage && (
        <div className="text-[var(--brand-red)] text-sm mt-2">
          {errorMessage}
        </div>
      )}
      {!mid && !paytmError && (
        <div className="text-amber-600 text-sm mt-2">
          Online payment is currently unavailable. Please use Cash on Delivery.
        </div>
      )}
      {paytmError && (
        <div className="text-amber-600 text-sm mt-2">
          Online payment failed to load. Please refresh or use Cash on Delivery.
        </div>
      )}
    </>
  )
}
