import Address from "@/components/address"
import PaymentButton from "@/components/payment-button"
import PaymentMethodInfo from "@/components/payment-method-info"
import { Button } from "@/components/ui/button"
import { Price } from "@/components/ui/price"
import { useCartRxStatus } from "@/lib/hooks/use-prescriptions"
import { getActivePaymentSession, isManual, isPaidWithGiftCard } from "@/lib/utils/checkout"
import { sdk } from "@/lib/utils/sdk"
import { HttpTypes } from "@medusajs/types"
import { useCallback, useState } from "react"

// 15-char Indian GST Identification Number
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

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

      {/* GSTIN Input (Optional, for B2B invoices) */}
      <GstinCheckoutInput cartId={cart.id} existingGstin={(cart.metadata as Record<string, any> | undefined)?.gstin} />

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

// ============ GSTIN COLLAPSIBLE INPUT ============

/**
 * Collapsible GSTIN input for B2B customers. Saves to cart metadata
 * so the value carries over when the order is created.
 */
const GstinCheckoutInput = ({
  cartId,
  existingGstin,
}: {
  cartId: string
  existingGstin?: string
}) => {
  const [isOpen, setIsOpen] = useState(!!existingGstin)
  const [gstin, setGstin] = useState(existingGstin ?? "")
  const [saved, setSaved] = useState(!!existingGstin)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const isValid = GSTIN_REGEX.test(gstin)

  const handleSave = useCallback(async () => {
    if (!isValid) return
    setSaving(true)
    setError("")
    try {
      // Persist GSTIN in cart metadata — backend copies to order on placement
      await sdk.store.cart.update(cartId, {
        metadata: { gstin: gstin.toUpperCase() },
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save GSTIN")
    } finally {
      setSaving(false)
    }
  }, [cartId, gstin, isValid])

  return (
    <div
      className="rounded-xl border transition-all"
      style={{ borderColor: saved ? "#A7F3D0" : "#EDE9E1", background: saved ? "#F0FDF4" : "#fff" }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: "#0D1B2A" }}>
            Have a GSTIN? (Optional)
          </span>
          {saved && (
            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#065F46" }}>
              <GstinCheckIcon /> Saved
            </span>
          )}
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <p className="text-xs" style={{ color: "#6B7280" }}>
            Enter your 15-digit GST Identification Number for a B2B tax invoice.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={gstin}
              onChange={(e) => {
                setGstin(e.target.value.toUpperCase())
                setSaved(false)
                setError("")
              }}
              placeholder="e.g. 27AAPFU0939F1ZV"
              maxLength={15}
              disabled={saving}
              className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono uppercase tracking-wider outline-none transition-colors"
              style={{
                borderColor: gstin && !isValid ? "#FCA5A5" : saved ? "#A7F3D0" : "#D1D5DB",
                background: saved ? "#F0FDF4" : "#fff",
              }}
            />
            {saved ? (
              <span className="flex items-center gap-1 text-xs font-semibold whitespace-nowrap" style={{ color: "#065F46" }}>
                <GstinCheckIcon /> Saved
              </span>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={!isValid || saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "#0E7C86" }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            )}
          </div>

          {gstin && !isValid && gstin.length > 0 && (
            <p className="text-xs" style={{ color: "#C0392B" }}>
              Invalid GSTIN format. Must be 15 characters (e.g. 27AAPFU0939F1ZV).
            </p>
          )}
          {error && (
            <p className="text-xs" style={{ color: "#C0392B" }}>{error}</p>
          )}
        </div>
      )}
    </div>
  )
}

const GstinCheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A7A4A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export default ReviewStep
