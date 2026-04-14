import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter,
} from "@/components/ui/drawer"
import { DeliveryEstimate } from "@/components/delivery-estimate"
import { DrugInteractionWarnings } from "@/components/drug-interaction-warnings"
import { Input } from "@/components/ui/input"
import { Loading } from "@/components/ui/loading"
import { Price } from "@/components/ui/price"
import { Thumbnail } from "@/components/ui/thumbnail"
import {
  useCart,
  useDeleteLineItem,
  useUpdateLineItem,
  useApplyPromoCode,
  useRemovePromoCode,
} from "@/lib/hooks/use-cart"
import { sortCartItems } from "@/lib/utils/cart"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { getPricePercentageDiff } from "@/lib/utils/price"
import { useCartDrawer } from "@/lib/context/cart"
import { Minus, Plus, Trash, XMark } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Link, useLocation } from "@tanstack/react-router"
import { clsx } from "clsx"
import { useState } from "react"


const FREE_DELIVERY_THRESHOLD = 300

export const FreeDeliveryBar = ({ subtotal }: { subtotal: number; currencyCode: string }) => {
  const remaining = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal)
  const progress = Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100)
  const qualified = remaining <= 0

  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: qualified ? "rgba(39,174,96,0.08)" : "var(--bg-tertiary)", border: `1px solid ${qualified ? "rgba(39,174,96,0.25)" : "var(--border-primary)"}` }}
    >
      <div className="flex items-center gap-2 text-xs font-medium mb-1.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={qualified ? "var(--brand-green)" : "var(--brand-teal)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
        {qualified ? (
          <span style={{ color: "var(--price-color)" }}>You qualify for FREE delivery!</span>
        ) : (
          <span style={{ color: "var(--text-primary)" }}>Add ₹{remaining.toFixed(0)} more for <strong>FREE delivery</strong></span>
        )}
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-primary)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, background: qualified ? "var(--brand-green)" : "var(--brand-teal)" }}
        />
      </div>
    </div>
  )
}

type LineItemPriceProps = {
  item: HttpTypes.StoreCartLineItem | HttpTypes.StoreOrderLineItem
  currencyCode: string
  className?: string
}

export const LineItemPrice = ({ item, currencyCode, className }: LineItemPriceProps) => {
  const { total, original_total } = item
  const originalPrice = original_total
  const currentPrice = total
  const hasReducedPrice = currentPrice && originalPrice && currentPrice < originalPrice

  return (
    <Price
      price={currentPrice || 0}
      currencyCode={currencyCode}
      originalPrice={
        hasReducedPrice
          ? {
              price: originalPrice || 0,
              percentage: getPricePercentageDiff(originalPrice || 0, currentPrice || 0),
            }
          : undefined
      }
      className={className}
    />
  )
}


type CartDeleteItemProps = {
  item: HttpTypes.StoreCartLineItem
  fields?: string
}

export const CartDeleteItem = ({ item, fields }: CartDeleteItemProps) => {
  const deleteLineItemMutation = useDeleteLineItem({ fields })
  return (
    <Button
      onClick={() => deleteLineItemMutation.mutate({ line_id: item.id })}
      disabled={deleteLineItemMutation.isPending}
      className="text-[var(--text-secondary)] hover:text-[var(--text-tertiary)] transition-colors ml-2"
      variant="transparent"
      size="fit"
      aria-label="Remove item"
    >
      <Trash />
    </Button>
  )
}


type CartItemQuantitySelectorProps = {
  item: HttpTypes.StoreCartLineItem
  type?: "default" | "compact"
  fields?: string
}

export const CartItemQuantitySelector = ({
  item,
  fields,
}: CartItemQuantitySelectorProps) => {
  const updateLineItemMutation = useUpdateLineItem({ fields })
  const deleteLineItemMutation = useDeleteLineItem({ fields })
  const isMutating = updateLineItemMutation.isPending || deleteLineItemMutation.isPending

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity === 0) {
      deleteLineItemMutation.mutate({ line_id: item.id })
    } else {
      updateLineItemMutation.mutate({
        line_id: item.id,
        quantity: newQuantity,
      })
    }
  }

  return (
    <div
      className={clsx(
        "inline-flex items-center rounded-lg border",
        isMutating && "opacity-50 pointer-events-none"
      )}
      style={{ borderColor: "var(--border-primary)", background: "var(--bg-secondary)" }}
    >
      <button
        type="button"
        onClick={() => handleQuantityChange(item.quantity - 1)}
        disabled={isMutating}
        aria-label="Decrease quantity"
        className="flex items-center justify-center w-10 h-10 sm:w-8 sm:h-8 transition-colors hover:bg-gray-50 disabled:opacity-30"
        style={{ color: "var(--text-primary)" }}
      >
        {item.quantity === 1 ? <Trash className="w-3.5 h-3.5" style={{ color: "var(--brand-red)" }} /> : <Minus className="w-3.5 h-3.5" />}
      </button>
      <input
        type="number"
        min={1}
        max={999}
        value={item.quantity}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10)
          if (!isNaN(v) && v >= 1) handleQuantityChange(v)
        }}
        onBlur={(e) => {
          if (!e.target.value || parseInt(e.target.value, 10) < 1) handleQuantityChange(1)
        }}
        disabled={isMutating}
        className="w-12 sm:w-10 text-center text-sm font-semibold tabular-nums outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        style={{ color: "var(--text-primary)", borderLeft: "1px solid var(--border-primary)", borderRight: "1px solid var(--border-primary)", height: 36 }}
      />
      <button
        type="button"
        onClick={() => handleQuantityChange(item.quantity + 1)}
        disabled={isMutating}
        aria-label="Increase quantity"
        className="flex items-center justify-center w-10 h-10 sm:w-8 sm:h-8 transition-colors hover:bg-gray-50 disabled:opacity-30"
        style={{ color: "var(--text-primary)" }}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}


interface CartLineItemProps {
  item: HttpTypes.StoreCartLineItem
  cart: HttpTypes.StoreCart
  type?: "default" | "compact" | "display"
  fields?: string
  className?: string
}

const CompactCartLineItem = ({ item, cart, fields }: CartLineItemProps) => {
  return (
    <div className="flex items-start gap-x-4" data-testid="cart-item">
      <Thumbnail thumbnail={item.thumbnail} alt={item.product_title || item.title} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="text-base font-medium line-clamp-1 text-[var(--text-primary)]">
              {item.product_title}
            </h4>
            <div className="text-sm text-[var(--text-secondary)]">
              {item.variant_title && item.variant_title !== "Default Variant" && (
                <span>{item.variant_title}</span>
              )}
            </div>
          </div>
          <CartDeleteItem item={item} fields={fields} />
        </div>

        <div className="flex items-center justify-between mt-2">
          <CartItemQuantitySelector item={item} fields={fields} />
          <Price price={item.total || 0} currencyCode={cart.currency_code} textSize="small" />
        </div>
      </div>
    </div>
  )
}

const DisplayCartLineItem = ({ item, cart, className }: CartLineItemProps) => {
  return (
    <div
      className={clsx(
        "flex items-center gap-4 py-3 border-b border-[var(--border-primary)] last:border-b-0",
        className
      )}
    >
      <Thumbnail
        thumbnail={item.thumbnail}
        alt={item.product_title || item.title}
        className="w-16 h-16"
      />
      <div className="flex-1">
        <p className="text-base font-semibold text-[var(--text-primary)]">{item.product_title}</p>
        {item.variant_title && item.variant_title !== "Default Variant" && (
          <p className="text-sm text-[var(--text-secondary)]">{item.variant_title}</p>
        )}
        <p className="text-sm text-[var(--text-secondary)]">Quantity: {item.quantity}</p>
      </div>
      <div className="text-right">
        <Price price={item.total || 0} currencyCode={cart.currency_code} textWeight="plus" />
      </div>
    </div>
  )
}

export const CartLineItem = ({
  item,
  cart,
  type = "default",
  fields,
  className,
}: CartLineItemProps) => {
  if (type === "compact") {
    return <CompactCartLineItem item={item} cart={cart} fields={fields} className={className} />
  }

  if (type === "display") {
    return <DisplayCartLineItem item={item} cart={cart} className={className} />
  }

  const schedule = (item as any).metadata?.schedule_classification as string | undefined
  const isRx = schedule === "H" || schedule === "H1"

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 py-4">
      <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
        <div className="flex-shrink-0">
          <Thumbnail thumbnail={item.thumbnail} alt={item.product_title || item.title} />
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-y-1">
          <span className="text-[var(--text-primary)] text-sm sm:text-base font-semibold line-clamp-2">{item.product_title}</span>
          <div className="flex items-center gap-2">
            {item.variant_title && item.variant_title !== "Default Variant" && (
              <span className="text-[var(--text-secondary)] text-xs sm:text-sm">{item.variant_title}</span>
            )}
            {isRx && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border"
                style={{
                  borderColor: "var(--brand-amber)",
                  color: "#A16207",
                  background: "rgba(243,156,18,0.10)",
                }}
              >
                Rx
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pl-0 sm:pl-0">
        <CartItemQuantitySelector item={item} fields={fields} />

        <div className="text-right min-w-[50px] sm:min-w-[60px]">
          <LineItemPrice item={item} currencyCode={cart.currency_code} />
        </div>

        <CartDeleteItem item={item} fields={fields} />
      </div>
    </div>
  )
}


interface CartSummaryProps {
  cart: HttpTypes.StoreCart
}

export const CartSummary = ({ cart }: CartSummaryProps) => {
  if ("isOptimistic" in cart && cart.isOptimistic) {
    return <Loading />
  }
  return (
    <div className="space-y-4">
      <FreeDeliveryBar subtotal={cart.item_subtotal ?? cart.subtotal ?? 0} currencyCode={cart.currency_code} />

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--text-primary)" }}>Subtotal</span>
          <Price price={cart.item_subtotal ?? cart.subtotal} currencyCode={cart.currency_code} />
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--text-primary)" }}>Shipping</span>
          {(() => {
            const hasShippingMethod = (cart.shipping_methods?.length ?? 0) > 0
            // Shipping price is tax-inclusive — show base amount without tax
            const shippingBase = (cart.shipping_subtotal as number | undefined)
              ?? Math.round(((cart.shipping_total ?? 0) / 1.05) * 100) / 100

            if (hasShippingMethod && (cart.shipping_total ?? 0) === 0) {
              return <span className="text-sm font-semibold" style={{ color: "var(--brand-green)" }}>FREE</span>
            }
            if (hasShippingMethod) {
              return <Price price={shippingBase} currencyCode={cart.currency_code} />
            }

            const itemTotal = cart.item_subtotal ?? cart.subtotal ?? 0
            return itemTotal >= FREE_DELIVERY_THRESHOLD
              ? <span className="text-sm font-semibold" style={{ color: "var(--brand-green)" }}>FREE</span>
              : <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>Calculated at checkout</span>
          })()}
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--text-primary)" }}>Discount</span>
          <Price price={cart.discount_total} currencyCode={cart.currency_code} type="discount" />
        </div>
        {(cart.tax_total ?? 0) > 0 && (
          <div className="flex justify-between text-xs">
            <span style={{ color: "var(--text-tertiary)" }}>Tax (incl. 5% GST)</span>
            <span style={{ color: "var(--text-tertiary)" }}>
              <Price price={cart.tax_total} currencyCode={cart.currency_code} />
            </span>
          </div>
        )}
      </div>

      <hr style={{ borderColor: "var(--border-primary)" }} />

      <div className="flex justify-between text-sm font-semibold">
        <span style={{ color: "var(--text-primary)" }}>Total</span>
        <Price price={(cart.total ?? 0) - (cart.tax_total ?? 0)} currencyCode={cart.currency_code} />
      </div>

      {(cart.metadata?.drug_interactions as any[])?.length > 0 && (
        <DrugInteractionWarnings
          interactions={cart.metadata!.drug_interactions as any[]}
          className="mt-1"
        />
      )}

      <DeliveryEstimate showLocationButton />
    </div>
  )
}


type CartPromoProps = {
  cart: HttpTypes.StoreCart
}

export const CartPromo = ({ cart }: CartPromoProps) => {
  const [showInput, setShowInput] = useState(false)
  const [promoCode, setPromoCode] = useState("")
  const applyPromoCodeMutation = useApplyPromoCode()
  const removePromoCodeMutation = useRemovePromoCode()

  const handleRemove = (code: string) => {
    removePromoCodeMutation.mutate({ code })
  }

  const [promoError, setPromoError] = useState<string | null>(null)

  const handleApply = () => {
    setPromoError(null)
    applyPromoCodeMutation.mutate(
      { code: promoCode },
      {
        onSuccess: () => {
          setShowInput(false)
          setPromoCode("")
        },
        onError: (error) => {
          setPromoError(
            error instanceof Error ? error.message : "Invalid promo code"
          )
        },
      }
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {cart.promotions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {cart.promotions.map((promotion) => (
            <Button key={promotion.code} variant="secondary" size="fit">
              {promotion.code}
              <XMark
                onClick={() => handleRemove(promotion.code || "")}
                className="ml-2 text-[var(--text-secondary)] hover:text-[var(--text-tertiary)] cursor-pointer"
              />
            </Button>
          ))}
        </div>
      )}

      {!showInput && (
        <Button
          onClick={() => setShowInput(true)}
          variant="transparent"
          className="text-[var(--text-secondary)] p-0 underline hover:bg-transparent hover:text-[var(--text-tertiary)]"
          size="fit"
        >
          Add promo code
        </Button>
      )}

      {showInput && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              placeholder="Enter promo code"
              name="promoCode"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value)
                setPromoError(null)
              }}
            />
            <Button
              onClick={handleApply}
              variant="primary"
              size="fit"
              disabled={applyPromoCodeMutation.isPending || !promoCode.trim()}
            >
              {applyPromoCodeMutation.isPending ? "Applying…" : "Apply"}
            </Button>
            <Button onClick={() => { setShowInput(false); setPromoError(null) }} variant="secondary" size="fit">
              Cancel
            </Button>
          </div>
          {promoError && (
            <p className="text-sm text-red-600">{promoError}</p>
          )}
        </div>
      )}
    </div>
  )
}


export const CartEmpty = () => {
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"

  return (
    <div className="text-center py-16 flex flex-col items-center justify-center gap-4">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--border-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
      <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Your cart is empty</h2>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Browse our medicines and add items to your cart</p>
      <Link to="/$countryCode/store" params={{ countryCode }}>
        <Button variant="primary" size="fit">
          Browse Medicines
        </Button>
      </Link>
    </div>
  )
}


export const DEFAULT_CART_DROPDOWN_FIELDS = "id, *items, total, currency_code, item_subtotal"

export const CartDropdown = () => {
  const { isOpen, openCart, closeCart } = useCartDrawer()
  const { data: cart, isLoading: isCartLoading } = useCart({
    fields: DEFAULT_CART_DROPDOWN_FIELDS,
  })
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"

  const sortedItems = sortCartItems(cart?.items || [])
  const itemCount = sortedItems?.reduce((total, item) => total + item.quantity, 0) || 0

  return (
    <Drawer open={isOpen} onOpenChange={(open) => (open ? openCart() : closeCart())}>
      <DrawerTrigger asChild>
        <button
          className="text-[var(--text-secondary)] hover:text-[var(--text-tertiary)] min-h-[44px] px-2 flex items-center"
          aria-label={`Cart ${itemCount} items`}
        >
          <span aria-live="polite">Cart ({itemCount})</span>
        </button>
      </DrawerTrigger>

      <DrawerContent className="flex flex-col">
        <DrawerHeader>
          <DrawerTitle>Shopping Cart</DrawerTitle>
        </DrawerHeader>

        {isCartLoading && (
          <div className="flex items-center justify-center flex-1 p-6">
            <span className="text-sm text-[var(--text-tertiary)] animate-pulse">Loading cart…</span>
          </div>
        )}

        {!isCartLoading && (!cart || itemCount === 0) && (
          <div className="flex flex-col items-center justify-center flex-1 p-6">
            <span className="text-base font-medium text-[var(--text-secondary)] mb-4">
              Your cart is empty
            </span>
            <Link to="/$countryCode/store" params={{ countryCode }} onClick={closeCart}>
              <Button variant="secondary" size="fit">
                Explore products
              </Button>
            </Link>
          </div>
        )}

        {/* Cart Items */}
        {cart && itemCount > 0 && (
          <>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {sortedItems?.map((item) => (
                <CartLineItem
                  key={item.id}
                  item={item}
                  cart={cart}
                  type="compact"
                  fields={DEFAULT_CART_DROPDOWN_FIELDS}
                />
              ))}
            </div>

            <DrawerFooter>
              <FreeDeliveryBar subtotal={cart.item_subtotal ?? 0} currencyCode={cart.currency_code} />
              <div className="flex items-center justify-between mb-4 mt-3">
                <span className="text-base font-medium" style={{ color: "var(--text-primary)" }}>Subtotal</span>
                <Price price={cart.item_subtotal} currencyCode={cart.currency_code} />
              </div>

              {(cart.metadata?.drug_interactions as any[])?.length > 0 && (
                <DrugInteractionWarnings
                  interactions={cart.metadata!.drug_interactions as any[]}
                  compact
                  className="mb-3"
                />
              )}

              <Link to="/$countryCode/cart" params={{ countryCode }} onClick={closeCart}>
                <Button className="w-full" variant="primary">
                  Go to cart
                </Button>
              </Link>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}

// Default export for backwards compatibility
export default CartLineItem
