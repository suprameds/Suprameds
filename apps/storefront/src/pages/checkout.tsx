import { CartEmpty } from "@/components/cart"
import CheckoutProgress from "@/components/checkout-progress"
import { Loading } from "@/components/ui/loading"
import { useCart } from "@/lib/hooks/use-cart"
import { useCartRxStatus } from "@/lib/hooks/use-prescriptions"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { type CheckoutStep, CheckoutStepKey } from "@/lib/types/global"
import {
  useLoaderData,
  useLocation,
  useNavigate,
} from "@tanstack/react-router"
import { lazy, Suspense, useCallback, useEffect, useMemo } from "react"

const DeliveryStep = lazy(() => import("@/components/checkout-delivery-step"))
const AddressStep = lazy(() => import("@/components/checkout-address-step"))
const PrescriptionStep = lazy(() => import("@/components/checkout-prescription-step"))
const PaymentStep = lazy(() => import("@/components/checkout-payment-step"))
const ReviewStep = lazy(() => import("@/components/checkout-review-step"))
const CheckoutSummary = lazy(() => import("@/components/checkout-summary"))

const Checkout = () => {
  const { step } = useLoaderData({
    from: "/$countryCode/checkout",
  })
  const { data: cart, isLoading: cartLoading } = useCart()
  const location = useLocation()
  const navigate = useNavigate()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"

  // Check whether the cart contains Rx items (determines prescription step)
  const { data: rxStatus } = useCartRxStatus(cart?.id)
  const hasRxItems = rxStatus?.has_rx_items ?? false

  const steps: CheckoutStep[] = useMemo(() => {
    const base: CheckoutStep[] = [
      {
        key: CheckoutStepKey.ADDRESSES,
        title: "Addresses",
        description: "Enter your shipping and billing addresses.",
        completed: !!(cart?.shipping_address && cart?.billing_address),
      },
      {
        key: CheckoutStepKey.DELIVERY,
        title: "Delivery",
        description: "Select a shipping method.",
        completed: !!cart?.shipping_methods?.length,
      },
    ]

    // Conditionally insert Prescription step when cart has Rx (H/H1) items
    if (hasRxItems) {
      const prescriptionAttached = !!(
        (cart?.metadata as Record<string, any> | undefined)?.prescription_id
      )
      base.push({
        key: CheckoutStepKey.PRESCRIPTION,
        title: "Prescription",
        description:
          "Attach a valid prescription for your Rx medicines. One prescription covers all items.",
        completed: prescriptionAttached,
      })
    }

    base.push(
      {
        key: CheckoutStepKey.PAYMENT,
        title: "Payment",
        description:
          "Select a payment method. You won't be charged until you place your order.",
        completed: !!cart?.payment_collection?.payment_sessions?.length,
      },
      {
        key: CheckoutStepKey.REVIEW,
        title: "Review",
        description: "Review your order details before placing your order.",
        completed: false,
      }
    )

    return base
  }, [cart, hasRxItems])

  const currentStepIndex = useMemo(
    () => steps.findIndex((s) => s.key === step),
    [step, steps]
  )

  const goToStep = useCallback(
    (nextStep: CheckoutStepKey) => {
      navigate({
        to: "/$countryCode/checkout",
        params: { countryCode },
        search: { step: nextStep },
        replace: true,
      })
    },
    [navigate, countryCode]
  )

  // Redirect to cart page if cart is empty or missing (e.g. after order completion)
  useEffect(() => {
    if (cartLoading) return
    if (!cart || !cart.items?.length) {
      navigate({ to: "/$countryCode/cart", params: { countryCode } })
    }
  }, [cart, cartLoading, navigate, countryCode])

  useEffect(() => {
    if (!cart) return

    // Walk through steps sequentially — redirect back if any prior step isn't done
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]
      if (s.key === step) break
      if (!s.completed && step !== s.key) {
        goToStep(s.key)
        return
      }
    }
  }, [cart, steps, step, goToStep])

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < steps.length) {
      goToStep(steps[nextIndex].key)
    }
  }

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      goToStep(steps[prevIndex].key)
    }
  }

  return (
    <div className="content-container py-8 flex flex-col gap-8">
      {/* Progress Steps */}
      <CheckoutProgress
        steps={steps}
        currentStepIndex={currentStepIndex}
        handleStepChange={goToStep}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-24">
        <div className="flex flex-col gap-1 lg:col-span-2">
          <h2 className="text-zinc-900 text-xl">
            {steps[currentStepIndex]?.title}
          </h2>
          <p className="text-base font-medium text-zinc-600">
            {steps[currentStepIndex]?.description}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-zinc-900 text-xl">Order Summary</h2>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-24">
        {/* Left Column - Checkout Steps */}
        <div className="space-y-6 lg:col-span-2">
          <Suspense fallback={<Loading />}>
            {cartLoading && <Loading />}
            {cart && (
              <>
                {step === CheckoutStepKey.ADDRESSES && (
                  <AddressStep cart={cart} onNext={handleNext} />
                )}

                {step === CheckoutStepKey.DELIVERY && (
                  <DeliveryStep
                    cart={cart}
                    onNext={handleNext}
                    onBack={handleBack}
                  />
                )}

                {step === CheckoutStepKey.PRESCRIPTION && (
                  <PrescriptionStep
                    cart={cart}
                    onNext={handleNext}
                    onBack={handleBack}
                  />
                )}

                {step === CheckoutStepKey.PAYMENT && (
                  <PaymentStep
                    cart={cart}
                    onNext={handleNext}
                    onBack={handleBack}
                  />
                )}

                {step === CheckoutStepKey.REVIEW && (
                  <ReviewStep cart={cart} onBack={handleBack} />
                )}
              </>
            )}
          </Suspense>
        </div>

        {/* Right Column - Order Summary */}
        <Suspense fallback={<Loading />}>
          {cartLoading && <Loading />}
          {cart && <CheckoutSummary cart={cart} />}
          {!cart && !cartLoading && <CartEmpty />}
        </Suspense>
      </div>
    </div>
  )
}

export default Checkout
