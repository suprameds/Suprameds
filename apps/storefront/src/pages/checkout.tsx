import { CartEmpty } from "@/components/cart"
import CheckoutProgress from "@/components/checkout-progress"
import { Loading } from "@/components/ui/loading"
import { useCart } from "@/lib/hooks/use-cart"
import { useCustomer } from "@/lib/hooks/use-customer"
import { useCartRxStatus } from "@/lib/hooks/use-prescriptions"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { sdk } from "@/lib/utils/sdk"
import { setStoredCart } from "@/lib/utils/cart"
import { type CheckoutStep, CheckoutStepKey } from "@/lib/types/global"
import {
  Link,
  useLoaderData,
  useLocation,
  useNavigate,
} from "@tanstack/react-router"
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react"

const DeliveryStep = lazy(() => import("@/components/checkout-delivery-step"))
const AddressStep = lazy(() => import("@/components/checkout-address-step"))
const PrescriptionStep = lazy(() => import("@/components/checkout-prescription-step"))
const PaymentStep = lazy(() => import("@/components/checkout-payment-step"))
const ReviewStep = lazy(() => import("@/components/checkout-review-step"))
const CheckoutSummary = lazy(() => import("@/components/checkout-summary"))

const GUEST_SESSION_KEY = "_suprameds_guest_session"

interface GuestSessionResponse {
  session_id: string
  session_token: string
  cart_id: string
  expires_at: string
}

function getGuestSession(): { session_id: string; session_token: string } | null {
  try {
    const raw = localStorage.getItem(GUEST_SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function storeGuestSession(session: { session_id: string; session_token: string }) {
  localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session))
}

/** Banner shown to unauthenticated users — lets them continue as guest or go to login */
function GuestCheckoutBanner({
  countryCode,
  onGuestContinue,
  isLoading,
}: {
  countryCode: string
  onGuestContinue: () => void
  isLoading: boolean
}) {
  return (
    <div
      className="rounded-xl border p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
      style={{ background: "#FFFBEB", borderColor: "#FDE68A" }}
    >
      <div className="flex-shrink-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "#FEF3C7" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D68910" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: "#92400E" }}>
          You're not signed in
        </p>
        <p className="text-xs mt-0.5" style={{ color: "#A16207" }}>
          Sign in to use saved addresses and track orders, or continue as a guest.
        </p>
      </div>
      <div className="flex gap-3 flex-shrink-0">
        <Link
          to="/$countryCode/account/login"
          params={{ countryCode }}
          search={{ redirectTo: `/${countryCode}/checkout` } as any}
          className="px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-white"
          style={{ color: "#0D1B2A", borderColor: "#D1D5DB", background: "#fff" }}
        >
          Login / Register
        </Link>
        <button
          type="button"
          onClick={onGuestContinue}
          disabled={isLoading}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
          style={{ background: "#0E7C86" }}
        >
          {isLoading ? "Setting up..." : "Continue as guest"}
        </button>
      </div>
    </div>
  )
}

const Checkout = () => {
  const { step } = useLoaderData({
    from: "/$countryCode/checkout",
  })
  const { data: cart, isLoading: cartLoading } = useCart()
  const { data: customer, isLoading: customerLoading } = useCustomer()
  const location = useLocation()
  const navigate = useNavigate()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"

  const [guestLoading, setGuestLoading] = useState(false)
  // Guest mode: customer is not logged in and either has a guest session or chose to continue as guest
  const [guestMode, setGuestMode] = useState(() => !!getGuestSession())

  // Check whether the cart contains Rx items (determines prescription step)
  const { data: rxStatus } = useCartRxStatus(cart?.id)
  const hasRxItems = rxStatus?.has_rx_items ?? false

  /** Create a guest checkout session and store the session token */
  const handleGuestContinue = useCallback(async () => {
    setGuestLoading(true)
    try {
      const response = await sdk.client.fetch<GuestSessionResponse>(
        "/store/orders/guest",
        { method: "POST", body: {} }
      )
      storeGuestSession({
        session_id: response.session_id,
        session_token: response.session_token,
      })
      // Use the guest cart created by the backend
      if (response.cart_id) {
        setStoredCart(response.cart_id)
      }
      setGuestMode(true)
    } catch {
      // If guest session creation fails, just let them proceed with existing cart
      setGuestMode(true)
    } finally {
      setGuestLoading(false)
    }
  }, [])

  const showGuestBanner = !customerLoading && !customer && !guestMode

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
    <div className="content-container py-4 sm:py-8 flex flex-col gap-4 sm:gap-6">
      {/* Guest checkout banner — shown when user is not authenticated and hasn't opted for guest */}
      {showGuestBanner && (
        <GuestCheckoutBanner
          countryCode={countryCode}
          onGuestContinue={handleGuestContinue}
          isLoading={guestLoading}
        />
      )}

      {/* Progress Steps */}
      <CheckoutProgress
        steps={steps}
        currentStepIndex={currentStepIndex}
        handleStepChange={goToStep}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-12">
        {/* Left Column - Checkout Steps */}
        <div className="space-y-4 sm:space-y-6 lg:col-span-2">
          <div className="flex flex-col gap-1">
            <h2 className="text-zinc-900 text-lg sm:text-xl font-semibold">
              {steps[currentStepIndex]?.title}
            </h2>
            <p className="text-sm sm:text-base font-medium text-zinc-600">
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

        {/* Right Column - Order Summary */}
        <div>
          <h2 className="text-zinc-900 text-lg sm:text-xl font-semibold mb-4">Order Summary</h2>
          <Suspense fallback={<Loading />}>
            {cartLoading && <Loading />}
            {cart && <CheckoutSummary cart={cart} />}
            {!cart && !cartLoading && <CartEmpty />}
          </Suspense>
        </div>
      </div>
    </div>
  )
}

export default Checkout
