import { DeliveryEstimate } from "@/components/delivery-estimate"
import ShippingItemSelector from "@/components/shipping-item-selector"
import { Button } from "@/components/ui/button"
import {
  useSetCartShippingMethod,
  useShippingOptions,
} from "@/lib/hooks/use-checkout"
import { sdk } from "@/lib/utils/sdk"
import { HttpTypes } from "@medusajs/types"
import { useEffect, useRef, useState } from "react"

interface DeliveryStepProps {
  cart: HttpTypes.StoreCart;
  onNext: () => void;
  onBack: () => void;
}

/**
 * Checkout delivery step — follows the Medusa v2 recommended pattern:
 * 1. List shipping options via useShippingOptions
 * 2. Batch-calculate prices for all "calculated" options via Promise.allSettled
 * 3. Pass the resolved prices map down to each ShippingItemSelector
 * 4. On submit, call addShippingMethod with the selected option
 *
 * @see https://docs.medusajs.com/resources/storefront-development/checkout/shipping
 */
const DeliveryStep = ({ cart, onNext, onBack }: DeliveryStepProps) => {
  const { data: shippingOptions } = useShippingOptions({ cart_id: cart.id })
  const setShippingMethodMutation = useSetCartShippingMethod()

  const [selectedOptionId, setSelectedOptionId] = useState<string>(
    cart.shipping_methods?.[0]?.shipping_option_id || ""
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const hasAutoSelected = useRef(false)

  // Batch-calculated prices for options with price_type === "calculated"
  const [calculatedPrices, setCalculatedPrices] = useState<Record<string, number>>({})
  const [priceLoading, setPriceLoading] = useState(false)

  // Batch price calculation — fires once when shippingOptions arrive
  useEffect(() => {
    if (!cart || !shippingOptions?.length) return

    const calculatedOptions = shippingOptions.filter(
      (o) => o.price_type === "calculated"
    )

    if (calculatedOptions.length === 0) return

    setPriceLoading(true)

    const promises = calculatedOptions.map((option) =>
      sdk.store.fulfillment.calculate(option.id, {
        cart_id: cart.id,
      })
    )

    Promise.allSettled(promises).then((results) => {
      const pricesMap: Record<string, number> = {}

      results
        .filter(
          (r): r is PromiseFulfilledResult<{ shipping_option: HttpTypes.StoreCartShippingOption }> =>
            r.status === "fulfilled"
        )
        .forEach((r) => {
          const opt = r.value.shipping_option
          if (opt?.id != null && opt?.amount != null) {
            pricesMap[opt.id] = opt.amount
          }
        })

      setCalculatedPrices(pricesMap)
      setPriceLoading(false)
    })
  }, [shippingOptions, cart?.id])

  // Auto-select first option when options load
  useEffect(() => {
    if (
      !hasAutoSelected.current &&
      !selectedOptionId &&
      shippingOptions &&
      shippingOptions.length > 0
    ) {
      hasAutoSelected.current = true
      setSelectedOptionId(shippingOptions[0].id)
    }
  }, [shippingOptions, selectedOptionId])

  const handleSubmit = async () => {
    if (!selectedOptionId || isSubmitting) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      await setShippingMethodMutation.mutateAsync({
        shipping_option_id: selectedOptionId,
      })
      onNext()
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to set shipping method. Please try again."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        {!shippingOptions && (
          <p className="text-sm text-[var(--text-tertiary)] animate-pulse">
            Loading shipping options…
          </p>
        )}

        {shippingOptions && shippingOptions.length === 0 && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            No shipping options available for your address. Please go back and
            check your address details.
          </div>
        )}

        {shippingOptions?.map((option) => (
          <ShippingItemSelector
            key={option.id}
            shippingOption={option}
            isSelected={selectedOptionId === option.id}
            handleSelect={setSelectedOptionId}
            cart={cart}
            calculatedPrice={calculatedPrices[option.id]}
            priceLoading={priceLoading}
          />
        ))}
      </div>

      {submitError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {submitError}
        </div>
      )}

      <DeliveryEstimate
        state={cart.shipping_address?.province ?? undefined}
        pincode={cart.shipping_address?.postal_code ?? undefined}
      />

      <div className="flex items-center gap-4">
        <Button variant="secondary" onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!selectedOptionId || isSubmitting}
        >
          {isSubmitting ? "Saving…" : "Next"}
        </Button>
      </div>
    </div>
  )
}

export default DeliveryStep
