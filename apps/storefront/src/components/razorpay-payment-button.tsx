import { Button } from "@/components/ui/button"
import { useCompleteCartOrder } from "@/lib/hooks/use-checkout"
import { getStoredCart } from "@/lib/utils/cart"
import { sdk } from "@/lib/utils/sdk"
import { HttpTypes } from "@medusajs/types"
import { useNavigate } from "@tanstack/react-router"
import { useCallback, useRef, useState } from "react"
import { useRazorpay } from "react-razorpay"

/** Razorpay handler callback response */
interface RazorpaySuccessResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

/** Razorpay session data from Medusa payment session */
interface RazorpaySessionData {
  razorpayOrder?: { id: string }
}

interface RazorpayPaymentButtonProps {
  cart: HttpTypes.StoreCart
  session: HttpTypes.StorePaymentSession
  notReady: boolean
  className?: string
}

/** Converts amount to Razorpay's smallest unit (paise for INR) */
function toRazorpayAmount(amount: number, currencyCode: string): number {
  const upper = currencyCode.toUpperCase()
  // JPY, KRW, etc. use 1; INR, USD, EUR use 100
  if (["JPY", "KRW", "VND", "BIF", "CLP", "DJF", "GNF", "KMF", "MGA", "PYG", "RWF", "UGX", "VUV", "XAF", "XOF", "XPF"].includes(upper)) {
    return Math.round(amount)
  }
  if (["BHD", "IQD", "JOD", "KWD", "OMR", "TND"].includes(upper)) {
    return Math.round(amount * 1000)
  }
  return Math.round(amount * 100)
}

export function RazorpayPaymentButton({
  cart,
  session,
  notReady,
  className,
}: RazorpayPaymentButtonProps) {
  const [submitting, setSubmitting] = useState(false)
  const lockRef = useRef(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const navigate = useNavigate()
  const completeOrderMutation = useCompleteCartOrder()
  const { Razorpay: RazorpayClass, isLoading: razorpayLoading, error: razorpayError } = useRazorpay()

  const sessionData = session?.data as RazorpaySessionData | undefined
  const razorpayOrderId = sessionData?.razorpayOrder?.id
  const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined

  const handlePaymentSuccess = useCallback(async (response: RazorpaySuccessResponse) => {
    if (lockRef.current) return
    lockRef.current = true
    try {
      const cartId = getStoredCart()
      if (!cartId) throw new Error("No cart found")

      // Verify the Razorpay signature and authorize the payment session
      // BEFORE completing the cart — prevents the race condition where
      // Razorpay API hasn't yet reflected "paid" status.
      const verifyResult = await sdk.client.fetch<{ success: boolean; message?: string }>(
        "/store/razorpay/verify",
        {
          method: "POST",
          body: {
            cart_id: cartId,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          },
        },
      )

      if (!verifyResult.success) {
        throw new Error(verifyResult.message || "Payment verification failed")
      }

      const order = await completeOrderMutation.mutateAsync()
      navigate({
        to: `/order/${order.id}/confirmed`,
        replace: true,
      })
    } catch (err) {
      lockRef.current = false
      setErrorMessage(err instanceof Error ? err.message : "Failed to place order")
    } finally {
      setSubmitting(false)
    }
  }, [completeOrderMutation, navigate])

  const handlePayment = useCallback(() => {
    if (!RazorpayClass || !keyId || !razorpayOrderId) return

    setSubmitting(true)
    setErrorMessage(null)

    const amountInPaise = toRazorpayAmount(session.amount ?? 0, cart.currency_code ?? "INR")

    const options = {
      key: keyId,
      amount: amountInPaise,
      currency: (cart.currency_code ?? "INR").toUpperCase() as any,
      order_id: razorpayOrderId,
      name: "Suprameds",
      description: `Order payment`,
      modal: {
        backdropclose: true,
        escape: true,
        handleback: true,
        ondismiss: () => {
          setSubmitting(false)
          setErrorMessage("Payment cancelled")
        },
      },
      handler: (response: RazorpaySuccessResponse) => {
        handlePaymentSuccess(response)
      },
      prefill: {
        name: [cart.billing_address?.first_name, cart.billing_address?.last_name].filter(Boolean).join(" ") || undefined,
        email: cart.email || undefined,
        contact: cart.shipping_address?.phone || cart.billing_address?.phone || undefined,
      },
    }

    const razorpay = new RazorpayClass(options)
    razorpay.on("payment.failed", (response: { error?: { description?: string } }) => {
      setSubmitting(false)
      setErrorMessage(response?.error?.description ?? "Payment failed")
    })
    razorpay.open()
  }, [RazorpayClass, keyId, razorpayOrderId, session.amount, cart, handlePaymentSuccess])

  const disabled =
    notReady ||
    submitting ||
    razorpayLoading ||
    !razorpayOrderId ||
    !keyId ||
    !!razorpayError

  return (
    <>
      <Button
        disabled={disabled}
        onClick={handlePayment}
        data-testid="place-order-button"
        className={className}
      >
        {submitting || razorpayLoading ? "Processing…" : "Place Order"}
      </Button>
      {errorMessage && (
        <div className="text-[var(--brand-red)] text-sm mt-2">{errorMessage}</div>
      )}
      {!keyId && !razorpayError && (
        <div className="text-amber-600 text-sm mt-2">
          Online payment is currently unavailable. Please use Cash on Delivery.
        </div>
      )}
      {razorpayError && (
        <div className="text-amber-600 text-sm mt-2">
          Online payment failed to load. Please refresh or use Cash on Delivery.
        </div>
      )}
    </>
  )
}
