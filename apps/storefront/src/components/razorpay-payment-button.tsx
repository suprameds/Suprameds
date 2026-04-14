import { Button } from "@/components/ui/button"
import { useCompleteCartOrder } from "@/lib/hooks/use-checkout"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { HttpTypes } from "@medusajs/types"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { useCallback, useRef, useState } from "react"
import { useRazorpay } from "react-razorpay"

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
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname)
  const completeOrderMutation = useCompleteCartOrder()
  const { Razorpay: RazorpayClass, isLoading: razorpayLoading, error: razorpayError } = useRazorpay()

  const sessionData = session?.data as RazorpaySessionData | undefined
  const razorpayOrderId = sessionData?.razorpayOrder?.id
  const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined

  const handlePaymentSuccess = useCallback(async () => {
    if (lockRef.current) return
    lockRef.current = true
    try {
      const order = await completeOrderMutation.mutateAsync()
      navigate({
        to: `/${countryCode}/order/${order.id}/confirmed`,
        replace: true,
      })
    } catch (err) {
      lockRef.current = false
      setErrorMessage(err instanceof Error ? err.message : "Failed to place order")
    } finally {
      setSubmitting(false)
    }
  }, [completeOrderMutation, navigate, countryCode])

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
      handler: (/* response: RazorpaySuccesshandlerArgs */) => {
        handlePaymentSuccess()
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
