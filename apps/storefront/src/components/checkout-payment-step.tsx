import PaymentContainer from "@/components/payment-container"
import StripeCardContainer from "@/components/stripe-card-container"
import { Button } from "@/components/ui/button"
import {
  useCartPaymentMethods,
  useInitiateCartPaymentSession,
} from "@/lib/hooks/use-checkout"
import { queryKeys } from "@/lib/utils/query-keys"
import { isStripe as isStripeFunc, isRazorpay as isRazorpayProvider, getActivePaymentSession, isPaidWithGiftCard } from "@/lib/utils/checkout"
import { HttpTypes } from "@medusajs/types"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { useToast } from "@/lib/context/toast-context"

interface PaymentStepProps {
  cart: HttpTypes.StoreCart;
  onNext: () => void;
  onBack: () => void;
}

/**
 * Payment step — user SELECTS a method (no API call).
 * Session is only created when they click "Next".
 * This avoids all the COD↔Razorpay session conflict issues.
 */
const PaymentStep = ({ cart, onNext, onBack }: PaymentStepProps) => {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { data: availablePaymentMethods = [] } = useCartPaymentMethods({
    region_id: cart.region?.id,
  })
  const initiatePaymentSessionMutation = useInitiateCartPaymentSession()

  const activeSession = getActivePaymentSession(cart)
  const paidByGiftcard = isPaidWithGiftCard(cart)

  // Default to COD, or whatever session is already active
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    activeSession?.provider_id ?? "pp_system_default"
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isStripe = isStripeFunc(selectedPaymentMethod)

  // Stripe needs setError for its card component
  const setError = useCallback((msg: string | null) => { if (msg) showToast(msg) }, [showToast])

  // Only called when user clicks "Next" — not on selection
  const handleSubmit = useCallback(async () => {
    if (!selectedPaymentMethod || isSubmitting) return

    setIsSubmitting(true)
    try {
      // Create/reuse session for the selected provider
      await initiatePaymentSessionMutation.mutateAsync(
        { provider_id: selectedPaymentMethod },
      )
      // Refresh cart so Review step sees the correct session
      await queryClient.refetchQueries({ predicate: queryKeys.cart.predicate })
      onNext()
    } catch (err) {
      if (isRazorpayProvider(selectedPaymentMethod)) {
        showToast("Razorpay payment setup failed. Please try again or use Cash on Delivery.")
      } else {
        showToast(err instanceof Error ? err.message : "Payment setup failed")
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedPaymentMethod, onNext, initiatePaymentSessionMutation, isSubmitting, queryClient, showToast])

  return (
    <div className="flex flex-col gap-8">
      {!paidByGiftcard && availablePaymentMethods.length === 0 && (
        <p className="text-sm text-[var(--text-tertiary)] animate-pulse">
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
                onClick={() => setSelectedPaymentMethod(paymentMethod.id)}
              >
                {isStripeFunc(paymentMethod.id) && (
                  <StripeCardContainer
                    paymentProviderId={paymentMethod.id}
                    selectedPaymentOptionId={selectedPaymentMethod}
                    setError={setError}
                    onSelect={() => setSelectedPaymentMethod(paymentMethod.id)}
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
          <p className="text-base font-semibold text-[var(--text-primary)] mb-1">
            Payment method
          </p>
          <p
            className="text-base font-semibold text-[var(--text-secondary)]"
            data-testid="payment-method-summary"
          >
            Gift card
          </p>
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
