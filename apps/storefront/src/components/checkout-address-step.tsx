import AddressForm, { normalizeIndianPhone } from "@/components/address-form"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useSetCartAddresses } from "@/lib/hooks/use-checkout"
import { useCustomer, useCustomerAddresses } from "@/lib/hooks/use-customer"
import { useLocation } from "@/lib/hooks/use-location"
import { DEFAULT_COUNTRY_CODE } from "@/lib/constants/site"
import { AddressFormData } from "@/lib/types/global"
import { HttpTypes } from "@medusajs/types"
import { useEffect, useRef, useState } from "react"

interface AddressStepProps {
  cart: HttpTypes.StoreCart;
  onNext: () => void;
}

/** Convert a saved customer address to the form shape */
function savedToForm(
  addr: HttpTypes.StoreCustomerAddress,
  fallbackCountry: string,
): AddressFormData {
  return {
    first_name: addr.first_name || "",
    last_name: addr.last_name || "",
    company: addr.company || "",
    address_1: addr.address_1 || "",
    address_2: addr.address_2 || "",
    city: addr.city || "",
    postal_code: addr.postal_code || "",
    province: addr.province || "",
    country_code: addr.country_code || fallbackCountry,
    phone: normalizeIndianPhone(addr.phone || ""),
  }
}

const EMPTY_FORM = (countryCode: string): AddressFormData => ({
  first_name: "",
  last_name: "",
  company: "",
  address_1: "",
  address_2: "",
  city: "",
  postal_code: "",
  province: "",
  country_code: countryCode,
  phone: "",
})

const AddressStep = ({ cart, onNext }: AddressStepProps) => {
  const setAddressesMutation = useSetCartAddresses()
  const [sameAsBilling, setSameAsBilling] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isShippingAddressValid, setIsShippingAddressValid] = useState(false)
  const [isBillingAddressValid, setIsBillingAddressValid] = useState(false)
  const { data: customer } = useCustomer()
  const [email, setEmail] = useState(cart.email || customer?.email || "")
  const { data: customerAddresses = [] } = useCustomerAddresses()
  const didAutofillFromSavedAddress = useRef(false)
  const storedCountryCode = DEFAULT_COUNTRY_CODE

  // GPS-detected location for auto-filling pincode/state on new addresses
  const { pincode: detectedPincode, state: detectedState } = useLocation()

  // "saved_<id>" for a stored address, "new" for blank form
  const [selectedAddressId, setSelectedAddressId] = useState<string>("new")

  const [shippingAddress, setShippingAddress] = useState<AddressFormData>({
    first_name: cart.shipping_address?.first_name || "",
    last_name: cart.shipping_address?.last_name || "",
    company: cart.shipping_address?.company || "",
    address_1: cart.shipping_address?.address_1 || "",
    address_2: cart.shipping_address?.address_2 || "",
    city: cart.shipping_address?.city || "",
    postal_code: cart.shipping_address?.postal_code || "",
    province: cart.shipping_address?.province || "",
    country_code:
      cart.shipping_address?.country_code || storedCountryCode || "",
    phone: normalizeIndianPhone(cart.shipping_address?.phone || ""),
  })
  const [billingAddress, setBillingAddress] = useState<AddressFormData>({
    first_name: cart.billing_address?.first_name || "",
    last_name: cart.billing_address?.last_name || "",
    company: cart.billing_address?.company || "",
    address_1: cart.billing_address?.address_1 || "",
    address_2: cart.billing_address?.address_2 || "",
    city: cart.billing_address?.city || "",
    postal_code: cart.billing_address?.postal_code || "",
    province: cart.billing_address?.province || "",
    country_code: cart.billing_address?.country_code || storedCountryCode || "",
    phone: normalizeIndianPhone(cart.billing_address?.phone || ""),
  })

  // Auto-select first saved address when addresses load (only once)
  useEffect(() => {
    if (didAutofillFromSavedAddress.current) return
    if (!customerAddresses.length) return

    const first = customerAddresses[0]
    if (!first) return

    didAutofillFromSavedAddress.current = true
    setSelectedAddressId(`saved_${first.id}`)

    const mapped = savedToForm(first, storedCountryCode || "")
    setShippingAddress(mapped)
    setBillingAddress(mapped)
  }, [customerAddresses, storedCountryCode])

  // Fill email from customer when it loads (may arrive after initial render)
  useEffect(() => {
    if (!email && customer?.email) setEmail(customer.email)
  }, [customer?.email]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill pincode/state from GPS detection (only for new addresses with empty fields)
  useEffect(() => {
    if (selectedAddressId !== "new") return
    if (!detectedPincode) return

    setShippingAddress((prev) => {
      // Only fill if user hasn't typed a pincode yet
      if (prev.postal_code) return prev
      return {
        ...prev,
        postal_code: detectedPincode,
        province: detectedState || prev.province,
      }
    })
  }, [detectedPincode, detectedState, selectedAddressId])

  const handleSelectSavedAddress = (addr: HttpTypes.StoreCustomerAddress) => {
    setSelectedAddressId(`saved_${addr.id}`)
    const mapped = savedToForm(addr, storedCountryCode || "")
    setShippingAddress(mapped)
    if (sameAsBilling) setBillingAddress(mapped)
    if (!email && customer?.email) setEmail(customer.email)
  }

  const handleSelectNewAddress = () => {
    setSelectedAddressId("new")
    setShippingAddress(EMPTY_FORM(storedCountryCode || ""))
    if (sameAsBilling) setBillingAddress(EMPTY_FORM(storedCountryCode || ""))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmitting) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Validate pincode serviceability for Indian addresses
      const pincode = shippingAddress.postal_code?.trim()
      if (pincode && /^\d{6}$/.test(pincode)) {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_MEDUSA_BACKEND_URL || "http://localhost:9000"}/store/pincodes/check?pincode=${pincode}`,
            { headers: { "x-publishable-api-key": import.meta.env.VITE_MEDUSA_PUBLISHABLE_KEY || "" } }
          )
          if (res.ok) {
            const data = await res.json()
            if (!data.serviceable) {
              setSubmitError(`Delivery is not available to pincode ${pincode}. ${data.message || "Please use a different address."}`)
              setIsSubmitting(false)
              return
            }
          }
        } catch {
          // Pincode check failed — don't block checkout, server-side will catch it
        }
      }

      const submitData = new FormData()

      submitData.append("email", email)

      Object.entries(shippingAddress).forEach(([key, value]) => {
        submitData.append(`shipping_address.${key}`, value)
      })

      const billingData = sameAsBilling ? shippingAddress : billingAddress
      Object.entries(billingData).forEach(([key, value]) => {
        submitData.append(`billing_address.${key}`, value)
      })

      await setAddressesMutation.mutateAsync(submitData)
      onNext()
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to save address. Please try again."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = () => {
    const emailValid = email.trim() && email.includes("@")

    return (
      emailValid &&
      isShippingAddressValid &&
      (isBillingAddressValid || sameAsBilling)
    )
  }

  useEffect(() => {
    if (!cart.region) {
      return
    }

    const isValidShippingAddressCountry = cart.region.countries?.some(
      (country) => country.iso_2 === shippingAddress.country_code
    )
    if (!isValidShippingAddressCountry) {
      setShippingAddress((prev) => ({
        ...prev,
        country_code: storedCountryCode || "",
      }))
    }

    const isValidBillingAddressCountry = cart.region.countries?.some(
      (country) => country.iso_2 === billingAddress.country_code
    )
    if (!isValidBillingAddressCountry) {
      setBillingAddress((prev) => ({
        ...prev,
        country_code: storedCountryCode || "",
      }))
    }
  }, [cart.region, storedCountryCode, shippingAddress.country_code, billingAddress.country_code])

  const showSavedAddressPicker = customerAddresses.length > 0

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <h3 className="!text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Shipping Address
          </h3>

          {/* Saved address picker */}
          {showSavedAddressPicker && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Choose a saved address or add a new one
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {customerAddresses.map((addr) => {
                  const isSelected = selectedAddressId === `saved_${addr.id}`
                  return (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => handleSelectSavedAddress(addr)}
                      className="text-left rounded-lg border-2 p-3.5 transition-all"
                      style={{
                        borderColor: isSelected ? "var(--brand-teal)" : "var(--border-primary)",
                        background: isSelected ? "#F0FDFA" : "var(--bg-secondary)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                            {addr.first_name} {addr.last_name}
                          </p>
                          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
                            {addr.address_1}
                            {addr.address_2 ? `, ${addr.address_2}` : ""}
                          </p>
                          <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                            {addr.city}
                            {addr.province ? `, ${addr.province}` : ""}
                            {addr.postal_code ? ` - ${addr.postal_code}` : ""}
                          </p>
                          {addr.phone && (
                            <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                              {addr.phone}
                            </p>
                          )}
                        </div>
                        {/* Radio indicator */}
                        <div
                          className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5"
                          style={{ borderColor: isSelected ? "var(--brand-teal)" : "var(--border-primary)" }}
                        >
                          {isSelected && (
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--brand-teal)" }} />
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}

                {/* Add new address card */}
                <button
                  type="button"
                  onClick={handleSelectNewAddress}
                  className="text-left rounded-lg border-2 border-dashed p-3.5 transition-all flex items-center justify-center gap-2 min-h-[80px]"
                  style={{
                    borderColor: selectedAddressId === "new" ? "var(--brand-teal)" : "var(--border-primary)",
                    background: selectedAddressId === "new" ? "#F0FDFA" : "var(--bg-primary)",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={selectedAddressId === "new" ? "var(--brand-teal)" : "var(--text-tertiary)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span
                    className="text-sm font-medium"
                    style={{ color: selectedAddressId === "new" ? "var(--brand-teal)" : "var(--text-secondary)" }}
                  >
                    Add new address
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Address form — always shown so user can review/edit */}
          <AddressForm
            addressFormData={shippingAddress}
            setAddressFormData={setShippingAddress}
            countries={cart.region?.countries}
            setIsFormValid={setIsShippingAddressValid}
          />
        </div>

        {/* Billing Address Checkbox */}
        <div className="flex items-center gap-x-2">
          <Checkbox
            id="same_as_billing"
            type="checkbox"
            checked={sameAsBilling}
            onChange={(e) => setSameAsBilling(!!e.target.checked)}
          />
          <label htmlFor="same_as_billing" className="text-sm">
            Billing address is the same as shipping address
          </label>
        </div>

        {/* Billing Address (if different) */}
        {!sameAsBilling && (
          <div className="flex flex-col gap-2">
            <h3 className="!text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Billing Address
            </h3>
            <AddressForm
              addressFormData={billingAddress}
              setAddressFormData={setBillingAddress}
              countries={cart.region?.countries}
              setIsFormValid={setIsBillingAddressValid}
            />
          </div>
        )}

        {/* Email */}
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="block text-sm font-medium">
            Email Address
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full"
          />
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            You'll receive order updates to this email.
          </p>
        </div>

        {submitError && (
          <div className="text-sm rounded px-3 py-2 border" style={{ color: "var(--brand-red)", background: "#FEE2E2", borderColor: "rgba(239,68,68,0.2)" }}>
            {submitError}
          </div>
        )}

        <div className="flex">
          <Button type="submit" disabled={!isFormValid() || isSubmitting}>
            {isSubmitting ? "Saving…" : "Next"}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default AddressStep
