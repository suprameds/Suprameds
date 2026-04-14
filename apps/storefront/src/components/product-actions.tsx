import { DEFAULT_CART_DROPDOWN_FIELDS } from "@/components/cart"
import ProductOptionSelect from "@/components/product-option-select"
import ProductPrice from "@/components/product-price"
import { Button } from "@/components/ui/button"
import { WishlistButton } from "@/components/wishlist-button"
import { useCartDrawer } from "@/lib/context/cart"
import { useAddToCart } from "@/lib/hooks/use-cart"
import { getVariantOptionsKeymap, isVariantInStock } from "@/lib/utils/product"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { useRequireAuth } from "@/lib/hooks/use-require-auth"
import { HttpTypes } from "@medusajs/types"
import { Link, useLocation } from "@tanstack/react-router"
import { isEqual } from "lodash-es"
import { Minus, Plus } from "@medusajs/icons"
import { trackAddToCart } from "@/lib/utils/analytics"
import { hapticImpact, hapticNotification } from "@/lib/utils/haptics"
import { memo, useEffect, useMemo, useState } from "react"

type DrugSchedule = "OTC" | "H" | "H1" | "X"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct;
  region: HttpTypes.StoreRegion;
  disabled?: boolean;
};

const ProductActions = memo(function ProductActions({
  product,
  region,
  disabled,
}: ProductActionsProps) {
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string | undefined>
  >({})
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"

  const addToCartMutation = useAddToCart({
    fields: DEFAULT_CART_DROPDOWN_FIELDS,
  })
  const { openCart } = useCartDrawer()

  useEffect(() => {
    setSelectedOptions({})
  }, [product?.handle])

  // If there is only 1 variant, preselect the options
  useEffect(() => {
    const variants = product?.variants
    if (variants?.length === 1) {
      const firstVariant = variants[0]
      const optionsKeymap = getVariantOptionsKeymap(
        firstVariant?.options ?? []
      )
      setSelectedOptions(optionsKeymap ?? {})
    }
  }, [product?.variants])

  const selectedVariant = useMemo(() => {
    if (!product?.variants || product?.variants.length === 0) {
      return
    }

    // If there's only one variant and no options, select it directly
    if (
      product?.variants.length === 1 &&
      (!product?.options || product?.options.length === 0)
    ) {
      return product?.variants[0]
    }

    const variants = product?.variants
    if (!variants) return

    const variant = variants.find((v) => {
      const optionsKeymap = getVariantOptionsKeymap(v?.options ?? [])
      const matches = isEqual(optionsKeymap, selectedOptions)

      return matches
    })

    return variant
  }, [product?.variants, product?.options, selectedOptions])

  // update the options when a variant is selected
  const setOptionValue = (optionId: string, value: string) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [optionId]: value,
    }))
  }

  //check if the selected options produce a valid variant
  const isValidVariant = useMemo(() => {
    return product?.variants?.some((v) => {
      const optionsKeymap = getVariantOptionsKeymap(v?.options ?? [])
      return isEqual(optionsKeymap, selectedOptions)
    })
  }, [product?.variants, selectedOptions])

  // check if the selected variant is in stock
  const inStock = useMemo(() => {
    // If no variant is selected, we can't add to cart
    if (!selectedVariant) {
      return false
    }

    return isVariantInStock(selectedVariant)
  }, [selectedVariant])

  const [quantity, setQuantity] = useState(1)

  // Reset quantity when product changes
  useEffect(() => {
    setQuantity(1)
  }, [product?.handle])

  const drugProduct = (product as any)?.drug_product as
    | { schedule?: DrugSchedule }
    | undefined
  const schedule = drugProduct?.schedule
  const requiresRx = schedule === "H" || schedule === "H1"
  const isBlocked = schedule === "X"

  const requireAuth = useRequireAuth()

  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return null
    if (!requireAuth()) return null
    hapticImpact("medium")

    try {
      await addToCartMutation.mutateAsync({
        variant_id: selectedVariant.id,
        quantity,
        country_code: countryCode,
        product,
        variant: selectedVariant,
        region,
      })
      const variantIndex = product.variants?.findIndex((v) => v.id === selectedVariant.id) ?? 0
      trackAddToCart(product, variantIndex, quantity, region?.currency_code?.toUpperCase() || "INR")
      hapticNotification("success")
      setQuantity(1)
      openCart()
    } catch {
      // Optimistic rollback is handled by the hook; no extra action needed.
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <ProductPrice
        product={product}
        variant={selectedVariant}
        priceProps={{
          textSize: "large",
        }}
      />

      {(product.variants?.length ?? 0) > 1 && (
        <div className="flex flex-col gap-y-4">
          {(product.options || []).map((option) => {
            return (
              <div key={option.id}>
                <ProductOptionSelect
                  option={option}
                  current={selectedOptions[option.id]}
                  updateOption={setOptionValue}
                  title={option.title ?? ""}
                  data-testid="product-options"
                  disabled={!!disabled || addToCartMutation.isPending}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Quantity selector */}
      {!isBlocked && selectedVariant && inStock && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Qty</span>
          <div
            className="inline-flex items-center rounded-lg border"
            style={{ borderColor: "var(--border-primary)", background: "var(--bg-secondary)" }}
          >
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1 || addToCartMutation.isPending}
              className="flex items-center justify-center w-9 h-9 transition-colors disabled:opacity-30"
              style={{ color: "var(--text-primary)" }}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              min={1}
              max={999}
              value={quantity}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v) && v >= 1) setQuantity(v)
                else if (e.target.value === "") setQuantity(1)
              }}
              className="w-12 text-center text-sm font-semibold tabular-nums outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              style={{ color: "var(--text-primary)", borderLeft: "1px solid var(--border-primary)", borderRight: "1px solid var(--border-primary)", height: 36 }}
            />
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQuantity((q) => q + 1)}
              disabled={addToCartMutation.isPending}
              className="flex items-center justify-center w-9 h-9 transition-colors disabled:opacity-30"
              style={{ color: "var(--text-primary)" }}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {isBlocked ? (
        <div
          className="rounded-lg border p-4 text-center"
          style={{ borderColor: "var(--brand-red)", background: "rgba(239,68,68,0.06)" }}
        >
          <p className="text-sm font-medium" style={{ color: "#B91C1C" }}>
            This product cannot be sold online
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            NDPS Act, 1985 prohibits online sale of Schedule X substances.
          </p>
        </div>
      ) : requiresRx ? (
        <div className="flex flex-col gap-3">
          <div
            className="rounded-lg border p-4"
            style={{ borderColor: "var(--brand-amber)", background: "rgba(243,156,18,0.06)" }}
          >
            <p className="text-sm font-medium" style={{ color: "var(--brand-amber-dark)" }}>
              Prescription required
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              Upload a valid prescription to add this medicine to your cart.
              A pharmacist will verify it before your order ships.
            </p>
          </div>
          <Link
            to="/$countryCode/upload-rx"
            params={{ countryCode }}
            className="w-full"
          >
            <Button
              variant="primary"
              className="w-full"
              style={{ background: "var(--brand-amber)" }}
            >
              Upload Prescription
            </Button>
          </Link>
          <Button
            onClick={handleAddToCart}
            disabled={!inStock || !selectedVariant || !!disabled || !isValidVariant || addToCartMutation.isPending}
            loading={addToCartMutation.isPending}
            variant="secondary"
            className="w-full"
            data-testid="add-product-button"
          >
            {addToCartMutation.isPending
              ? "Adding…"
              : !selectedVariant
                ? "Select variant"
                : !inStock || !isValidVariant
                  ? "Out of stock"
                  : "Add to cart (Rx verification at checkout)"}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            onClick={handleAddToCart}
            disabled={!inStock || !selectedVariant || !!disabled || !isValidVariant || addToCartMutation.isPending}
            loading={addToCartMutation.isPending}
            variant="primary"
            className="flex-1"
            data-testid="add-product-button"
          >
            {addToCartMutation.isPending
              ? "Adding…"
              : !selectedVariant
                ? "Select variant"
                : !inStock || !isValidVariant
                  ? "Out of stock"
                  : "Add to cart"}
          </Button>
          <WishlistButton
            productId={product.id}
            variantId={selectedVariant?.id}
            currentPrice={
              (selectedVariant as any)?.calculated_price?.calculated_amount ?? undefined
            }
            className="flex-shrink-0 border border-gray-200"
          />
        </div>
      )}
    </div>
  )
})

export default ProductActions
