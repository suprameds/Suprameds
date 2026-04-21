import {
  CartLineItem,
  CartSummary,
  CartEmpty,
  CartPromo,
} from "@/components/cart"
import { LoyaltyRedeem } from "@/components/loyalty-redeem"
import { Button } from "@/components/ui/button"
import { CartSkeleton } from "@/components/ui/skeletons"
import { useCart, useCreateCart } from "@/lib/hooks/use-cart"
import { sortCartItems } from "@/lib/utils/cart"
import { Link, useLoaderData } from "@tanstack/react-router"
import { useEffect, useMemo } from "react"

const DEFAULT_CART_FIELDS = "+items.*, +shipping_methods.*, *promotions"

function itemRequiresRx(item: { metadata?: Record<string, unknown> | null }): boolean {
  const schedule = item.metadata?.schedule_classification as string | undefined
  return schedule === "H" || schedule === "H1"
}

const RxBanner = () => (
  <div
    className="flex items-start gap-3 rounded-lg p-4 mb-6"
    style={{ background: "rgba(243,156,18,0.08)", border: "1px solid rgba(243,156,18,0.25)" }}
  >
    <svg
      width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand-amber)" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
    <div>
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        Your cart contains prescription medicines
      </p>
      <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
        A valid prescription from a registered medical practitioner is required before checkout.
        Our pharmacist will review it within 4 hours.
      </p>
      <Link
        to="/upload-rx"
        className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold transition-opacity hover:opacity-80"
        style={{ color: "var(--brand-teal)" }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        Upload Prescription
      </Link>
    </div>
  </div>
)

const Cart = () => {
  const { region } = useLoaderData({
    from: "/cart",
  })
  const { data: cart, isLoading: cartLoading } = useCart({
    fields: DEFAULT_CART_FIELDS,
  })
  const createCartMutation = useCreateCart()

  // Create a cart if none exists — must be in useEffect, not during render,
  // to prevent React from firing multiple mutations across re-renders.
  useEffect(() => {
    if (!cart && !cartLoading && !createCartMutation.isPending) {
      createCartMutation.mutate({ region_id: region.id })
    }
  }, [cart, cartLoading, createCartMutation, region.id])

  const cartItems = sortCartItems(cart?.items || [])

  const hasRxItems = useMemo(
    () => cartItems.some((item) => itemRequiresRx(item)),
    [cartItems]
  )

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "80vh" }}>
      <div className="content-container py-6 sm:py-10 lg:py-12 pb-28 md:pb-10 lg:pb-12">
        {cartLoading ? (
          <CartSkeleton />
        ) : cartItems.length === 0 ? (
          <CartEmpty />
        ) : (
          <div className="flex flex-col md:flex-row gap-6 sm:gap-8 lg:gap-12">
            {/* Cart items */}
            <div className="w-full md:w-2/3">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h1
                  className="text-lg sm:text-xl lg:text-2xl font-semibold"
                  style={{ color: "var(--text-primary)", fontFamily: "Fraunces, Georgia, serif" }}
                >
                  Your Cart ({cartItems.reduce((sum, i) => sum + i.quantity, 0)})
                </h1>
                <Link
                  to="/store"
                  className="text-xs sm:text-sm font-medium transition-colors hover:opacity-70"
                  style={{ color: "var(--brand-teal)" }}
                >
                  Continue shopping
                </Link>
              </div>

              {hasRxItems && <RxBanner />}

              <div className="space-y-0">
                {cartItems.map((item, index) => (
                  <div key={item.id}>
                    <CartLineItem
                      item={item}
                      cart={cart!}
                      fields={DEFAULT_CART_FIELDS}
                    />
                    {index < cartItems.length - 1 && (
                      <hr style={{ borderColor: "var(--border-primary)" }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Summary sidebar */}
            {cart && (
              <div className="w-full md:w-1/3">
                <div
                  className="rounded-xl p-4 sm:p-6 sticky top-32"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}
                >
                  <h2
                    className="text-lg font-semibold mb-4 sm:mb-5"
                    style={{ color: "var(--text-primary)", fontFamily: "Fraunces, Georgia, serif" }}
                  >
                    Order Summary
                  </h2>

                  <div className="flex flex-col gap-y-4">
                    <CartSummary cart={cart} />
                    <CartPromo cart={cart} />
                    <LoyaltyRedeem cart={cart} />
                  </div>

                  <div className="mt-5 hidden md:block">
                    <Link to="/checkout" search={{ step: "addresses" }}>
                      <Button className="w-full">Proceed to Checkout</Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile sticky checkout bar */}
      {!cartLoading && cart && cartItems.length > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 md:hidden border-t"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border-primary)" }}
        >
          <div className="content-container flex items-center justify-between py-3">
            <div>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Total</span>
              <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                ₹{(cart.total ?? 0).toLocaleString("en-IN")}
              </p>
            </div>
            <Link to="/checkout" search={{ step: "addresses" }}>
              <Button>Proceed to Checkout</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default Cart
