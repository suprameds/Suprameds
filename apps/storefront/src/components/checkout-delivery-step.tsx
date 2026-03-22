import { DeliveryEstimate } from "@/components/delivery-estimate"
import ShippingItemSelector from "@/components/shipping-item-selector"
import { Button } from "@/components/ui/button"
import {
  useSetCartShippingMethod,
  useShippingOptions,
} from "@/lib/hooks/use-checkout"
import { HttpTypes } from "@medusajs/types"
import { useEffect, useRef, useState } from "react"

interface DeliveryStepProps {
  cart: HttpTypes.StoreCart;
  onNext: () => void;
  onBack: () => void;
}

const DeliveryStep = ({ cart, onNext, onBack }: DeliveryStepProps) => {
  const { data: shippingOptions } = useShippingOptions({ cart_id: cart.id })
  const setShippingMethodMutation = useSetCartShippingMethod()
  const [selectedOptionId, setSelectedOptionId] = useState<string>(
    cart.shipping_methods?.[0]?.shipping_option_id || ""
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const hasAutoSelected = useRef(false)

  useEffect(() => {
    // Auto-select first option if none selected and options are available
    if (!hasAutoSelected.current && !selectedOptionId && shippingOptions && shippingOptions.length > 0) {
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
        error instanceof Error ? error.message : "Failed to set shipping method. Please try again."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        {!shippingOptions && (
          <p className="text-sm text-zinc-500 animate-pulse">Loading shipping options…</p>
        )}

        {shippingOptions && shippingOptions.length === 0 && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            No shipping options available for your address. Please go back and check your address details.
          </div>
        )}

        {shippingOptions?.map((option) => (
          <ShippingItemSelector
            key={option.id}
            shippingOption={option}
            isSelected={selectedOptionId === option.id}
            handleSelect={setSelectedOptionId}
            cart={cart}
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
