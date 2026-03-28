import { Button } from "@/components/ui/button"
import { useCompleteCartOrder } from "@/lib/hooks/use-checkout"
import {
  getActivePaymentSession,
  isManual,
  isRazorpay,
  isStripe,
} from "@/lib/utils/checkout"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { HttpTypes } from "@medusajs/types"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { useRef, useState } from "react"
import { RazorpayPaymentButton } from "./razorpay-payment-button"

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart;
  className?: string;
  disabled?: boolean;
};

const PaymentButton = ({ cart, className, disabled }: PaymentButtonProps) => {
  const notReady =
    disabled ||
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  const paymentSession = getActivePaymentSession(cart)

  switch (true) {
    case isStripe(paymentSession?.provider_id):
      return <StripePaymentButton notReady={notReady} className={className} />
    case isRazorpay(paymentSession?.provider_id):
      return (
        <RazorpayPaymentButton
          cart={cart}
          session={paymentSession!}
          notReady={notReady}
          className={className}
        />
      )
    case isManual(paymentSession?.provider_id):
      return <ManualPaymentButton notReady={notReady} className={className} />
    default:
      return <Button disabled>Select a payment method</Button>
  }
}

const StripePaymentButton = ({
  notReady,
  className,
}: {
  notReady: boolean;
  className?: string;
}) => {
  const [submitting, setSubmitting] = useState(false)
  const lockRef = useRef(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname)
  const completeOrderMutation = useCompleteCartOrder()

  const handlePayment = async () => {
    if (lockRef.current) return
    lockRef.current = true
    setSubmitting(true)
    setErrorMessage(null)

    try {
      const order = await completeOrderMutation.mutateAsync()

      navigate({
        to: `/${countryCode}/order/${order.id}/confirmed`,
        replace: true,
      })
    } catch (error) {
      lockRef.current = false
      setErrorMessage(
        error instanceof Error ? error.message : "Payment failed"
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        disabled={notReady || submitting || completeOrderMutation.isPending}
        onClick={handlePayment}
        data-testid="place-order-button"
        className={className}
      >
        {submitting ? "Processing…" : "Place Order"}
      </Button>
      {errorMessage && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mt-2">{errorMessage}</div>
      )}
    </>
  )
}

const ManualPaymentButton = ({
  notReady,
  className,
}: {
  notReady: boolean;
  className?: string;
}) => {
  const [submitting, setSubmitting] = useState(false)
  const lockRef = useRef(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname)
  const completeOrderMutation = useCompleteCartOrder()

  const handlePayment = async () => {
    if (lockRef.current) return
    lockRef.current = true
    setSubmitting(true)
    setErrorMessage(null)

    try {
      const order = await completeOrderMutation.mutateAsync()

      navigate({
        to: `/${countryCode}/order/${order.id}/confirmed`,
        replace: true,
      })
    } catch (error) {
      lockRef.current = false
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to place order"
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="p-3 rounded-lg border text-sm"
        style={{ background: "#FFFBEB", borderColor: "var(--brand-amber)", color: "var(--brand-amber-dark)" }}
      >
        <strong>Cash on Delivery</strong> — Pay in cash when your order arrives.
        Please keep the exact amount ready for a smooth handover.
      </div>

      <Button
        disabled={notReady || submitting || completeOrderMutation.isPending}
        loading={submitting}
        onClick={handlePayment}
        data-testid="place-order-button"
        className={className}
      >
        {submitting ? "Processing…" : "Place COD Order"}
      </Button>
      {errorMessage && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mt-2">{errorMessage}</div>
      )}
    </div>
  )
}

export default PaymentButton
