import { CartEmpty } from "@/components/cart"
import CheckoutProgress from "@/components/checkout-progress"
import { Loading } from "@/components/ui/loading"
import { useCart } from "@/lib/hooks/use-cart"
import { useCustomer } from "@/lib/hooks/use-customer"
import { useCartRxStatus } from "@/lib/hooks/use-prescriptions"
import { trackBeginCheckout } from "@/lib/utils/analytics"
import { type CheckoutStep, CheckoutStepKey } from "@/lib/types/global"
import {
  useLoaderData,
  useNavigate,
} from "@tanstack/react-router"
import { formatPrice } from "@/lib/utils/price"
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react"

const DeliveryStep = lazy(() => import("@/components/checkout-delivery-step"))
const AddressStep = lazy(() => import("@/components/checkout-address-step"))
const PrescriptionStep = lazy(() => import("@/components/checkout-prescription-step"))
const PaymentStep = lazy(() => import("@/components/checkout-payment-step"))
const ReviewStep = lazy(() => import("@/components/checkout-review-step"))
const CheckoutSummary = lazy(() => import("@/components/checkout-summary"))

const Checkout = () => {
  const { step } = useLoaderData({
    from: "/checkout",
  })
  const { data: cart, isLoading: cartLoading } = useCart()
  const { data: customer, isLoading: customerLoading } = useCustomer()
  const navigate = useNavigate()

  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false)

  // Check whether the cart contains Rx items (determines prescription step)
  const { data: rxStatus } = useCartRxStatus(cart?.id)
  const hasRxItems = rxStatus?.has_rx_items ?? false

  // GA4: track begin_checkout on mount
  useEffect(() => {
    if (!cart?.items?.length) return
    trackBeginCheckout(
      cart.items.map((item: any) => ({
        product: { id: item.product_id, title: item.product_title, variants: [] },
        variantIndex: 0,
        quantity: item.quantity,
      })),
      cart.total ?? 0,
      cart.currency_code?.toUpperCase() || "INR",
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart?.id])

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
        to: "/checkout",
        search: { step: nextStep },
        replace: true,
      })
    },
    [navigate]
  )

  // Redirect to cart page if cart is empty or missing.
  // Skip redirect when on the Review step (order completion clears the cart
  // right before navigating to the confirmation page — don't race it).
  useEffect(() => {
    if (cartLoading) return
    if (step === "review") return
    if (!cart || !cart.items?.length) {
      navigate({ to: "/cart" })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, cartLoading, navigate])

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
    <div className="content-container py-4 sm:py-8 flex flex-col gap-4 sm:gap-6">
      {/* Require sign-in for checkout — no guest checkout for pharma compliance */}
      {!customerLoading && !customer && (
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}
        >
          <p className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            Sign in to continue checkout
          </p>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            As a licensed pharmacy, we need your account details for prescription verification and order traceability.
          </p>
          <a
            href={`/account/login?redirectTo=/checkout`}
            className="inline-flex px-6 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--brand-teal)", color: "var(--text-inverse)" }}
          >
            Sign in or Register
          </a>
        </div>
      )}

      {/* Checkout content — only shown when authenticated */}
      {customer && <>
      <CheckoutProgress
        steps={steps}
        currentStepIndex={currentStepIndex}
        handleStepChange={goToStep}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-12">
        {/* Left Column - Checkout Steps */}
        <div className="space-y-4 sm:space-y-6 lg:col-span-2">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg sm:text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {steps[currentStepIndex]?.title}
            </h2>
            <p className="text-sm sm:text-base font-medium" style={{ color: "var(--text-secondary)" }}>
              {steps[currentStepIndex]?.description}
            </p>
          </div>

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

        {/* Right Column - Order Summary (desktop only) */}
        <div className="hidden lg:block">
          <h2 className="text-lg sm:text-xl font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Order Summary</h2>
          <Suspense fallback={<Loading />}>
            {cartLoading && <Loading />}
            {cart && <CheckoutSummary cart={cart} />}
            {!cart && !cartLoading && <CartEmpty />}
          </Suspense>
        </div>
      </div>

      {/* Mobile Sticky Summary Bar — visible only below lg breakpoint */}
      {cart && (
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
          style={{
            background: "var(--bg-primary)",
            borderTop: "1px solid var(--border-primary)",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.10)",
          }}
        >
          {/* Expanded panel — slides in above the bar */}
          {mobileSummaryOpen && (
            <div
              className="overflow-y-auto px-4 pt-4 pb-2"
              style={{
                maxHeight: "60vh",
                borderBottom: "1px solid var(--border-primary)",
              }}
            >
              <Suspense fallback={<Loading />}>
                <CheckoutSummary cart={cart} />
              </Suspense>
            </div>
          )}

          {/* Sticky bar row */}
          <button
            type="button"
            onClick={() => setMobileSummaryOpen((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-3 gap-3"
            aria-expanded={mobileSummaryOpen}
            aria-label={mobileSummaryOpen ? "Hide order summary" : "View order summary"}
          >
            <div className="flex items-center gap-2">
              {/* Chevron icon */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-secondary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: mobileSummaryOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                  flexShrink: 0,
                }}
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                {mobileSummaryOpen ? "Hide summary" : "View summary"}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: "var(--bg-secondary)",
                  color: "var(--text-secondary)",
                }}
              >
                {cart.items?.length ?? 0} {(cart.items?.length ?? 0) === 1 ? "item" : "items"}
              </span>
            </div>
            <span className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              {formatPrice({
                amount: cart.total ?? 0,
                currency_code: cart.currency_code?.toUpperCase() || "INR",
                locale: "en-IN",
              })}
            </span>
          </button>
        </div>
      )}

      {/* Spacer so content isn't hidden behind the sticky bar on mobile */}
      {cart && <div className="lg:hidden h-14" />}
      </>}
    </div>
  )
}

export default Checkout
