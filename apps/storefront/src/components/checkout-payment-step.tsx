import PaymentContainer from "@/components/payment-container"
import StripeCardContainer from "@/components/stripe-card-container"
import { Button } from "@/components/ui/button"
import {
  useCartPaymentMethods,
  useInitiateCartPaymentSession,
} from "@/lib/hooks/use-checkout"
import { queryKeys } from "@/lib/utils/query-keys"
import { isStripe as isStripeFunc, getActivePaymentSession, isPaidWithGiftCard } from "@/lib/utils/checkout"
import { HttpTypes } from "@medusajs/types"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"

interface PaymentStepProps {
  cart: HttpTypes.StoreCart;
  onNext: () => void;
  onBack: () => void;
}

const PaymentStep = ({ cart, onNext, onBack }: PaymentStepProps) => {
  const queryClient = useQueryClient()
  const { data: availablePaymentMethods = [] } = useCartPaymentMethods({
    region_id: cart.region?.id,
  })
  const initiatePaymentSessionMutation = useInitiateCartPaymentSession()

  const activeSession = getActivePaymentSession(cart)

  const [error, setError] = useState<string | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    activeSession?.provider_id ?? ""
  )

  const isStripe = isStripeFunc(selectedPaymentMethod)

  const paidByGiftcard = isPaidWithGiftCard(cart)

  const initiatingRef = useRef(false)
  const initiatePaymentSession = useCallback(
    async (method: string) => {
      if (initiatingRef.current) return
      initiatingRef.current = true
      try {
        await initiatePaymentSessionMutation.mutateAsync(
          { provider_id: method },
        )
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An error occurred"
        )
      } finally {
        initiatingRef.current = false
      }
    },
    [initiatePaymentSessionMutation]
  )

  const handlePaymentMethodChange = useCallback(
    async (method: string) => {
      setError(null)
      setSelectedPaymentMethod(method)

      await initiatePaymentSession(method)
    },
    [initiatePaymentSession]
  )

  // Auto-select + initiate the first payment method when list loads
  const didAutoInitRef = useRef(false)
  useEffect(() => {
    if (didAutoInitRef.current) return
    if (!availablePaymentMethods?.length) return
    if (selectedPaymentMethod) return

    didAutoInitRef.current = true
    const firstMethod = availablePaymentMethods[0]
    if (firstMethod) {
      setSelectedPaymentMethod(firstMethod.id)
      initiatePaymentSession(firstMethod.id)
    }
  }, [availablePaymentMethods, selectedPaymentMethod, initiatePaymentSession])

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!selectedPaymentMethod || isSubmitting) return

    setIsSubmitting(true)
    try {
      // Always ensure the active session matches the user's selection.
      // Without this, switching from Razorpay→COD leaves the old session
      // as "active" because the cart data hasn't refreshed yet.
      const needsNewSession =
        !activeSession || activeSession.provider_id !== selectedPaymentMethod

      if (needsNewSession) {
        await initiatePaymentSession(selectedPaymentMethod)
        // Wait for cart cache to refresh with the new payment session
        // so the Review step sees the correct provider
        await queryClient.refetchQueries({ predicate: queryKeys.cart.predicate })
      }
      onNext()
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedPaymentMethod, activeSession, onNext, initiatePaymentSession, isSubmitting, queryClient])

  return (
    <div className="flex flex-col gap-8">
      {!paidByGiftcard && availablePaymentMethods.length === 0 && (
        <p className="text-sm text-zinc-500 animate-pulse">
          Loading payment methods…
        </p>
      )}

      {!paidByGiftcard && availablePaymentMethods.length > 0 && (
        <>
          {availablePaymentMethods.map((paymentMethod) => (
            <div key={paymentMethod.id}>
              <PaymentContainer
                paymentProviderId={paymentMethod.id}
                selectedPaymentOptionId={selectedPaymentMethod}
                onClick={() => handlePaymentMethodChange(paymentMethod.id)}
              >
                {isStripeFunc(paymentMethod.id) && (
                  <StripeCardContainer
                    paymentProviderId={paymentMethod.id}
                    selectedPaymentOptionId={selectedPaymentMethod}
                    setError={setError}
                    onSelect={() => handlePaymentMethodChange(paymentMethod.id)}
                    onCardComplete={handleSubmit}
                  />
                )}
              </PaymentContainer>
            </div>
          ))}
        </>
      )}

      {paidByGiftcard && (
        <div className="flex flex-col w-1/3">
          <p className="text-base font-semibold text-zinc-900 mb-1">
            Payment method
          </p>
          <p
            className="text-base font-semibold text-zinc-600"
            data-testid="payment-method-summary"
          >
            Gift card
          </p>
        </div>
      )}

      {error && (
        <div
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
          data-testid="payment-method-error-message"
        >
          {error}
        </div>
      )}

      <div className="flex items-center gap-4">
        <Button
          variant="secondary"
          onClick={onBack}
          disabled={isSubmitting || initiatePaymentSessionMutation.isPending}
        >
          Back
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={
            (isStripe && !activeSession) ||
            (!selectedPaymentMethod && !paidByGiftcard) ||
            isSubmitting ||
            initiatePaymentSessionMutation.isPending
          }
          loading={isSubmitting}
          data-testid="submit-payment-button"
        >
          {isSubmitting
            ? "Setting up payment…"
            : !activeSession && isStripeFunc(selectedPaymentMethod)
              ? "Enter card details"
              : "Next"}
        </Button>
      </div>
    </div>
  )
}

export default PaymentStep
