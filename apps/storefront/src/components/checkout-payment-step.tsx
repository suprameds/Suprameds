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
import { useCallback, useEffect, useRef, useState } from "react"
import { useToast } from "@/lib/context/toast-context"

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

  const { showToast } = useToast()
  // Stripe component expects setError — route to toast
  const setError = useCallback((msg: string | null) => { if (msg) showToast(msg) }, [showToast])
  // Always default to COD — Razorpay session creation can fail and block checkout.
  // User can explicitly switch to Razorpay if they want online payment.
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("pp_system_default")

  // Match the active session to the user's selected provider (not just first pending)
  const activeSession = getActivePaymentSession(cart, selectedPaymentMethod || undefined)

  const isStripe = isStripeFunc(selectedPaymentMethod)

  const paidByGiftcard = isPaidWithGiftCard(cart)

  const initiatingRef = useRef(false)
  const activeProviderRef = useRef(selectedPaymentMethod)

  const initiatePaymentSession = useCallback(
    async (method: string, silent = false) => {
      if (initiatingRef.current) return
      initiatingRef.current = true
      activeProviderRef.current = method
      try {
        await initiatePaymentSessionMutation.mutateAsync(
          { provider_id: method },
        )
      } catch (err) {
        // Only show error if this is still the active selection AND not a silent auto-init
        if (activeProviderRef.current !== method || silent) return

        if (isRazorpayProvider(method)) {
          showToast("Razorpay payment setup failed. Please try again or use Cash on Delivery.")
        } else {
          showToast(err instanceof Error ? err.message : "An error occurred")
        }
      } finally {
        initiatingRef.current = false
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initiatePaymentSessionMutation]
  )

  const handlePaymentMethodChange = useCallback(
    async (method: string) => {
      setSelectedPaymentMethod(method)
      activeProviderRef.current = method

      await initiatePaymentSession(method)
    },
    [initiatePaymentSession]
  )

  // Initiate COD session on mount (idempotent — reuses existing if present)
  const didAutoInitRef = useRef(false)
  useEffect(() => {
    if (didAutoInitRef.current) return
    if (!availablePaymentMethods?.length) return

    didAutoInitRef.current = true
    activeProviderRef.current = "pp_system_default"
    initiatePaymentSession("pp_system_default", true)
  }, [availablePaymentMethods, initiatePaymentSession])

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!selectedPaymentMethod || isSubmitting) return

    setIsSubmitting(true)
    try {
      // Always ensure a session exists for the selected provider (idempotent — reuses existing)
      await initiatePaymentSession(selectedPaymentMethod)
      // Refresh cart cache so the Review step sees the correct provider
      await queryClient.refetchQueries({ predicate: queryKeys.cart.predicate })
      onNext()
    } catch {
      // Error already handled by initiatePaymentSession's catch block
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedPaymentMethod, onNext, initiatePaymentSession, isSubmitting, queryClient])

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
