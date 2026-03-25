import Address from "@/components/address"
import PaymentButton from "@/components/payment-button"
import PaymentMethodInfo from "@/components/payment-method-info"
import { Button } from "@/components/ui/button"
import { Price } from "@/components/ui/price"
import { useCartRxStatus } from "@/lib/hooks/use-prescriptions"
import { getActivePaymentSession, isManual, isPaidWithGiftCard } from "@/lib/utils/checkout"
import { HttpTypes } from "@medusajs/types"

interface ReviewStepProps {
  cart: HttpTypes.StoreCart;
  onBack: () => void;
}

const ReviewStep = ({ cart, onBack }: ReviewStepProps) => {
  const paidByGiftcard = isPaidWithGiftCard(cart)
  const activeSession = getActivePaymentSession(cart)
  const { data: rxStatus } = useCartRxStatus(cart.id)

  return (
    <div className="flex flex-col gap-8">
      {/* Delivery Information */}
      {cart.shipping_address && (
        <>
          <div className="flex flex-col gap-2">
            <h3 className="text-zinc-900 !text-base font-semibold">
              Shipping Address
            </h3>
            <Address address={cart.shipping_address} />
          </div>

          {cart.shipping_methods?.[0] && (
            <div className="flex flex-col gap-2">
              <h3 className="text-zinc-900 !text-base font-semibold">
                Shipping Method
              </h3>
              <div className="text-sm text-zinc-600 flex items-center gap-2">
                <div>{cart.shipping_methods[0].name}</div>
                <Price
                  price={cart.shipping_methods[0].amount}
                  currencyCode={cart.currency_code}
                  textWeight="plus"
                  className="text-zinc-600"
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Prescription (shown only when cart has Rx items) */}
      {rxStatus?.has_rx_items && (
        <div className="flex flex-col gap-2">
          <h3 className="text-zinc-900 !text-base font-semibold">
            Prescription
          </h3>
          {rxStatus.prescription ? (
            <>
              <div className="text-sm text-zinc-600 flex items-center gap-2">
                <span>
                  {rxStatus.prescription.original_filename || "Prescription"}
                </span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase"
                  style={{
                    color: rxStatus.prescription.status === "approved" ? "#065F46" : "#92400E",
                    background: rxStatus.prescription.status === "approved" ? "#ECFDF5" : "#FEF3C7",
                  }}
                >
                  {rxStatus.prescription.status === "approved" ? "Approved" : "Pending review"}
                </span>
              </div>
              {rxStatus.prescription.status === "pending_review" && (
                <div
                  className="mt-1 p-3 rounded-lg border text-sm"
                  style={{ background: "#EFF6FF", borderColor: "#3B82F6", color: "#1E40AF" }}
                >
                  Your prescription will be verified by our pharmacist after you
                  place your order. We'll process your order once verified. If
                  any issue is found, we'll contact you.
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-amber-700">No prescription attached</p>
          )}
        </div>
      )}

      {/* Payment Information */}
      <div className="flex flex-col gap-2">
        <h3 className="text-zinc-900 !text-base font-semibold">
          Billing Address
        </h3>
        <div className="text-sm text-zinc-600">
          {cart.billing_address ? (
            <Address address={cart.billing_address} />
          ) : (
            <span>Same as shipping address</span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-zinc-900 !text-base font-semibold">
          Payment Method
        </h3>
        <div className="text-sm text-zinc-600 flex items-center gap-2">
          {activeSession && (
            <PaymentMethodInfo provider_id={activeSession.provider_id} />
          )}
          {paidByGiftcard && <span>Gift Card</span>}
        </div>
      </div>

      {isManual(activeSession?.provider_id) ? (
        <p className="text-sm text-zinc-600">
          You will pay <strong>in cash</strong> when your order is delivered.
          Our delivery partner will collect the exact amount at your doorstep.
        </p>
      ) : (
        <p className="text-sm text-zinc-600">
          When you place your order, your payment will be authorized and we'll
          start processing your order.
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-4">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>

        <PaymentButton cart={cart} />
      </div>
    </div>
  )
}

export default ReviewStep
