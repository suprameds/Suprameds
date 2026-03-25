import { Loading } from "@/components/ui/loading"
import { Price } from "@/components/ui/price"
import Radio from "@/components/ui/radio"
import { HttpTypes } from "@medusajs/types"

type ShippingItemSelectorProps = {
  shippingOption: HttpTypes.StoreCartShippingOption;
  cart: HttpTypes.StoreCart;
  isSelected: boolean;
  handleSelect: (optionId: string) => void;
  /** Pre-calculated price for options with price_type === "calculated" */
  calculatedPrice?: number;
  /** Whether calculated prices are still being fetched */
  priceLoading?: boolean;
};

/**
 * Pure display component for a single shipping option.
 * All price calculation is handled by the parent (DeliveryStep)
 * following the Medusa v2 batch Promise.allSettled pattern.
 */
const ShippingItemSelector = ({
  shippingOption,
  cart,
  isSelected,
  handleSelect,
  calculatedPrice,
  priceLoading,
}: ShippingItemSelectorProps) => {
  const isCalculated = shippingOption.price_type === "calculated"
  const price = isCalculated ? calculatedPrice : shippingOption.amount

  // Disabled only while prices are still loading for calculated options
  const isDisabled =
    isCalculated && priceLoading === true && typeof calculatedPrice !== "number"

  return (
    <label
      className={`block transition-all duration-200 ${
        isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      }`}
    >
      <div
        className={`flex items-center justify-between p-5 border transition-colors ${
          isSelected
            ? "border-zinc-900 bg-zinc-50"
            : "border-zinc-200 hover:border-zinc-300"
        }`}
      >
        <div className="flex items-center gap-4">
          <Radio
            checked={isSelected}
            onChange={() => handleSelect(shippingOption.id)}
            disabled={isDisabled}
          />

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-base font-semibold text-zinc-900">
                {shippingOption.name}
              </p>
            </div>
            {typeof shippingOption.data?.description === "string" && (
              <p className="text-xs text-zinc-600 mt-1">
                {shippingOption.data.description}
              </p>
            )}
          </div>
        </div>

        <div className="text-right">
          {isCalculated && priceLoading && typeof calculatedPrice !== "number" ? (
            <Loading className="w-4 h-4" rows={1} />
          ) : typeof price === "number" ? (
            price === 0 ? (
              <span
                className="text-sm font-semibold"
                style={{ color: "#27AE60" }}
              >
                FREE
              </span>
            ) : (
              <Price
                price={price}
                currencyCode={cart.currency_code}
                textWeight="plus"
              />
            )
          ) : (
            // Calculation failed or not applicable — allow selection, price resolved server-side
            <span className="text-xs text-zinc-500">Price at checkout</span>
          )}
        </div>
      </div>
    </label>
  )
}

export default ShippingItemSelector
