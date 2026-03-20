import { DEFAULT_CART_DROPDOWN_FIELDS } from "@/components/cart"
import ProductOptionSelect from "@/components/product-option-select"
import ProductPrice from "@/components/product-price"
import { Button } from "@/components/ui/button"
import { useCartDrawer } from "@/lib/context/cart"
import { useAddToCart } from "@/lib/hooks/use-cart"
import { getVariantOptionsKeymap, isVariantInStock } from "@/lib/utils/product"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import { HttpTypes } from "@medusajs/types"
import { Link, useLocation } from "@tanstack/react-router"
import { isEqual } from "lodash-es"
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
  const countryCode = getCountryCodeFromPath(location.pathname) || "dk"

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

  const drugProduct = (product as any)?.drug_product as
    | { schedule?: DrugSchedule }
    | undefined
  const schedule = drugProduct?.schedule
  const requiresRx = schedule === "H" || schedule === "H1"
  const isBlocked = schedule === "X"

  // add the selected variant to the cart
  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return null

    addToCartMutation.mutateAsync(
      {
        variant_id: selectedVariant.id,
        quantity: 1,
        country_code: countryCode,
        product,
        variant: selectedVariant,
        region,
      },
      {
        onSuccess: () => {
          openCart()
        },
      }
    )
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

      {isBlocked ? (
        <div
          className="rounded-lg border p-4 text-center"
          style={{ borderColor: "#EF4444", background: "rgba(239,68,68,0.06)" }}
        >
          <p className="text-sm font-medium" style={{ color: "#B91C1C" }}>
            This product cannot be sold online
          </p>
          <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
            NDPS Act, 1985 prohibits online sale of Schedule X substances.
          </p>
        </div>
      ) : requiresRx ? (
        <div className="flex flex-col gap-3">
          <div
            className="rounded-lg border p-4"
            style={{ borderColor: "#F39C12", background: "rgba(243,156,18,0.06)" }}
          >
            <p className="text-sm font-medium" style={{ color: "#92400E" }}>
              Prescription required
            </p>
            <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
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
              style={{ background: "#F39C12" }}
            >
              Upload Prescription
            </Button>
          </Link>
          <Button
            onClick={handleAddToCart}
            disabled={!inStock || !selectedVariant || !!disabled || !isValidVariant}
            variant="secondary"
            className="w-full"
            data-testid="add-product-button"
          >
            {!selectedVariant
              ? "Select variant"
              : !inStock || !isValidVariant
                ? "Out of stock"
                : "Add to cart (Rx verification at checkout)"}
          </Button>
        </div>
      ) : (
        <Button
          onClick={handleAddToCart}
          disabled={!inStock || !selectedVariant || !!disabled || !isValidVariant}
          variant="primary"
          className="w-full"
          data-testid="add-product-button"
        >
          {!selectedVariant
            ? "Select variant"
            : !inStock || !isValidVariant
              ? "Out of stock"
              : "Add to cart"}
        </Button>
      )}
    </div>
  )
})

export default ProductActions
