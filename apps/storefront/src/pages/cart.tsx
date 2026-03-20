import {
  CartLineItem,
  CartSummary,
  CartEmpty,
  CartPromo,
} from "@/components/cart"
import { Button } from "@/components/ui/button"
import { Loading } from "@/components/ui/loading"
import { useCart, useCreateCart } from "@/lib/hooks/use-cart"
import { sortCartItems } from "@/lib/utils/cart"
import { Link, useLoaderData } from "@tanstack/react-router"
import { useMemo } from "react"

const DEFAULT_CART_FIELDS =
  "id, *items, total, currency_code, subtotal, shipping_total, discount_total, tax_total, *promotions"

/**
 * Checks product metadata for Rx schedule classification.
 * Products with schedule H or H1 require a prescription.
 */
function itemRequiresRx(item: { metadata?: Record<string, unknown> | null }): boolean {
  const schedule = item.metadata?.schedule_classification as string | undefined
  return schedule === "H" || schedule === "H1"
}

const RxBanner = ({ countryCode }: { countryCode: string }) => (
  <div
    className="flex items-start gap-3 rounded-lg p-4 mb-6"
    style={{ background: "rgba(243,156,18,0.08)", border: "1px solid rgba(243,156,18,0.25)" }}
  >
    <svg
      width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D68910" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
    <div>
      <p className="text-sm font-semibold" style={{ color: "#0D1B2A" }}>
        Your cart contains prescription medicines
      </p>
      <p className="text-xs mt-1" style={{ color: "#666" }}>
        A valid prescription from a registered medical practitioner is required before checkout.
        Our pharmacist will review it within 4 hours.
      </p>
      <Link
        to="/$countryCode/upload-rx"
        params={{ countryCode }}
        className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold transition-opacity hover:opacity-80"
        style={{ color: "#0E7C86" }}
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
  const { region, countryCode } = useLoaderData({
    from: "/$countryCode/cart",
  })
  const { data: cart, isLoading: cartLoading } = useCart({
    fields: DEFAULT_CART_FIELDS,
  })
  const createCartMutation = useCreateCart()

  if (!cart && !cartLoading && !createCartMutation.isPending) {
    createCartMutation.mutate({ region_id: region.id })
  }

  const cartItems = sortCartItems(cart?.items || [])

  const hasRxItems = useMemo(
    () => cartItems.some((item) => itemRequiresRx(item)),
    [cartItems]
  )

  return (
    <div className="content-container py-12">
      {cartLoading ? (
        <Loading />
      ) : cartItems.length === 0 ? (
        <CartEmpty />
      ) : (
        <div className="flex flex-col md:flex-row gap-8">
          <div className="space-y-6 w-full md:w-2/3">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-zinc-900 text-xl">Cart</h1>
              {cartItems.length > 0 && (
                <Link
                  to="/$countryCode/store"
                  params={{ countryCode }}
                  className="text-zinc-600 hover:text-zinc-500 text-sm underline"
                >
                  Continue shopping
                </Link>
              )}
            </div>

            {hasRxItems && <RxBanner countryCode={countryCode} />}

            {cartItems.map((item, index) => (
              <div key={item.id}>
                <CartLineItem
                  item={item}
                  cart={cart!}
                  fields={DEFAULT_CART_FIELDS}
                />
                {index < cartItems.length - 1 && (
                  <hr className="bg-zinc-200 mt-6" />
                )}
              </div>
            ))}
          </div>

          {cart && (
            <div className="flex flex-col gap-y-8 w-full md:w-1/3">
              <div>
                <h2 className="text-zinc-900 text-xl">
                  Cart Summary
                </h2>
              </div>

              <div className="flex flex-col gap-y-4">
                <CartSummary cart={cart} />

                <CartPromo cart={cart} />
              </div>

              <Link to="/$countryCode/checkout" params={{ countryCode }}>
                <Button className="w-full">Checkout</Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Cart
