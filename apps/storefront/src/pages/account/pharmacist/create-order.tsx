import { useState, useEffect, useRef, useCallback } from "react"
import { Link, useLocation } from "@tanstack/react-router"
import { getCountryCodeFromPath } from "@/lib/utils/region"
import {
  usePharmacistCustomerLookup,
  usePharmacistCreateOrder,
  usePharmacistProductSearch,
  type SearchProduct,
} from "@/lib/hooks/use-pharmacist"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "@/lib/utils/sdk"

// ── Types ──────────────────────────────────────────────────────────

interface CartItem {
  variant_id: string
  product_id: string
  title: string
  quantity: number
  unit_price: number
  thumbnail: string | null
  schedule: string | null
}

interface CustomerData {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string
  addresses: AddressData[]
}

interface AddressData {
  id?: string
  first_name: string
  last_name: string
  address_1: string
  address_2?: string
  city: string
  province?: string
  postal_code: string
  country_code: string
  phone?: string
  is_default_shipping?: boolean
}

interface OrderResult {
  order_id: string
  display_id: number
  total: number
  message: string
}

// ── Helpers ────────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

function formatPrice(amount: number): string {
  return `\u20B9${amount.toLocaleString("en-IN")}`
}

const EMPTY_ADDRESS: AddressData = {
  first_name: "",
  last_name: "",
  address_1: "",
  address_2: "",
  city: "",
  province: "",
  postal_code: "",
  country_code: "in",
  phone: "",
}

const FREE_SHIPPING_THRESHOLD = 300
const SHIPPING_COST = 50

// ── Draft persistence (localStorage) ──────────────────────────────

interface Draft {
  id: string
  savedAt: string
  customer: CustomerData
  cartItems: CartItem[]
  prescriptionId: string
  notes: string
}

const DRAFTS_KEY = "suprameds_pharmacist_drafts"

function loadDrafts(): Draft[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) || "[]")
  } catch {
    return []
  }
}

function saveDrafts(drafts: Draft[]) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts))
}

// ── Component ──────────────────────────────────────────────────────

export default function CreateOrderPage() {
  const location = useLocation()
  const countryCode = getCountryCodeFromPath(location.pathname) || "in"

  // State
  const [phone, setPhone] = useState("")
  const [newFirstName, setNewFirstName] = useState("")
  const [newLastName, setNewLastName] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showResults, setShowResults] = useState(false)
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState("")
  const [selectedAddress, setSelectedAddress] = useState<AddressData | null>(null)
  const [showNewAddress, setShowNewAddress] = useState(false)
  const [newAddress, setNewAddress] = useState<AddressData>({ ...EMPTY_ADDRESS })
  const [notes, setNotes] = useState("")
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>(loadDrafts)
  const searchRef = useRef<HTMLDivElement>(null)

  // Hooks
  const customerLookup = usePharmacistCustomerLookup()
  const createOrder = usePharmacistCreateOrder()
  const debouncedSearch = useDebouncedValue(searchQuery, 300)
  const { data: searchResults, isLoading: searchLoading } = usePharmacistProductSearch(debouncedSearch)

  // Close search results on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Derived
  const hasRxItems = cartItems.some((i) => i.schedule === "H" || i.schedule === "H1")
  const subtotal = cartItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  const shippingCost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST
  const total = subtotal + shippingCost
  const activeAddress = showNewAddress ? newAddress : selectedAddress

  const canPlaceOrder =
    selectedCustomer &&
    cartItems.length > 0 &&
    activeAddress &&
    activeAddress.address_1 &&
    activeAddress.city &&
    activeAddress.postal_code &&
    (!hasRxItems || selectedPrescriptionId.trim())

  // Handlers
  function handleCustomerSearch() {
    if (!phone.trim()) return
    customerLookup.mutate(
      { phone: phone.replace(/\s/g, "") },
      {
        onSuccess: (res) => {
          if (res.found && res.customer) {
            setSelectedCustomer(res.customer)
          }
        },
      }
    )
  }

  function handleCreateCustomer() {
    if (!phone.trim() || !newFirstName.trim()) return
    customerLookup.mutate(
      { phone: phone.replace(/\s/g, ""), first_name: newFirstName.trim(), last_name: newLastName.trim() },
      {
        onSuccess: (res) => {
          if (res.customer) {
            setSelectedCustomer(res.customer)
          }
        },
      }
    )
  }

  function handleResetCustomer() {
    setSelectedCustomer(null)
    setCartItems([])
    setSelectedAddress(null)
    setShowNewAddress(false)
    setSelectedPrescriptionId("")
    setNotes("")
    customerLookup.reset()
    setNewFirstName("")
    setNewLastName("")
  }

  function addToCart(product: SearchProduct) {
    const variant = product.variant
    if (!variant) return
    const existing = cartItems.find((i) => i.variant_id === variant.id)
    if (existing) {
      setCartItems((items) =>
        items.map((i) => (i.variant_id === variant.id ? { ...i, quantity: i.quantity + 1 } : i))
      )
    } else {
      setCartItems((items) => [
        ...items,
        {
          variant_id: variant.id,
          product_id: product.id,
          title: product.title,
          quantity: 1,
          unit_price: variant.price ?? 0,
          thumbnail: product.thumbnail,
          schedule: product.drug_product?.schedule ?? null,
        },
      ])
    }
    setSearchQuery("")
    setShowResults(false)
  }

  function updateQuantity(variantId: string, delta: number) {
    setCartItems((items) =>
      items
        .map((i) => (i.variant_id === variantId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i))
        .filter((i) => i.quantity > 0)
    )
  }

  function removeItem(variantId: string) {
    setCartItems((items) => items.filter((i) => i.variant_id !== variantId))
  }

  function selectExistingAddress(addr: AddressData) {
    setSelectedAddress(addr)
    setShowNewAddress(false)
  }

  function handlePlaceOrder() {
    if (!canPlaceOrder || !selectedCustomer || !activeAddress) return
    createOrder.mutate(
      {
        customer_id: selectedCustomer.id,
        items: cartItems.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
        shipping_address: {
          first_name: activeAddress.first_name || selectedCustomer.first_name || "Customer",
          last_name: activeAddress.last_name || selectedCustomer.last_name || "",
          address_1: activeAddress.address_1,
          address_2: activeAddress.address_2,
          city: activeAddress.city,
          province: activeAddress.province,
          postal_code: activeAddress.postal_code,
          country_code: activeAddress.country_code || "in",
          phone: activeAddress.phone,
        },
        prescription_id: hasRxItems ? selectedPrescriptionId.trim() : undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: (res) => setOrderResult(res),
      }
    )
  }

  function handleReset() {
    setPhone("")
    setNewFirstName("")
    setNewLastName("")
    setSelectedCustomer(null)
    setCartItems([])
    setSearchQuery("")
    setSelectedPrescriptionId("")
    setSelectedAddress(null)
    setShowNewAddress(false)
    setNewAddress({ ...EMPTY_ADDRESS })
    setNotes("")
    setOrderResult(null)
    customerLookup.reset()
    createOrder.reset()
  }

  function handleSaveDraft() {
    if (!selectedCustomer || cartItems.length === 0) return
    const draft: Draft = {
      id: `draft_${Date.now()}`,
      savedAt: new Date().toISOString(),
      customer: selectedCustomer,
      cartItems,
      prescriptionId: selectedPrescriptionId,
      notes,
    }
    const updated = [draft, ...drafts.filter((d) => d.id !== draft.id)].slice(0, 20) // max 20 drafts
    setDrafts(updated)
    saveDrafts(updated)
    handleReset()
  }

  function handleLoadDraft(draft: Draft) {
    setSelectedCustomer(draft.customer)
    setPhone(draft.customer.phone?.replace("+91", "") || "")
    setCartItems(draft.cartItems)
    setSelectedPrescriptionId(draft.prescriptionId)
    setNotes(draft.notes)
    // Remove the loaded draft
    const updated = drafts.filter((d) => d.id !== draft.id)
    setDrafts(updated)
    saveDrafts(updated)
  }

  function handleDeleteDraft(draftId: string) {
    const updated = drafts.filter((d) => d.id !== draftId)
    setDrafts(updated)
    saveDrafts(updated)
  }

  // ── Success Screen ──

  if (orderResult) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16">
        <div
          className="w-full max-w-md rounded-xl border p-8 text-center"
          style={{ background: "rgba(22,163,74,0.06)", borderColor: "var(--brand-green)" }}
        >
          <div className="text-4xl mb-4">&#10003;</div>
          <h2
            className="text-xl font-semibold mb-2"
            style={{ color: "var(--text-primary)", fontFamily: "Fraunces, Georgia, serif" }}
          >
            Order Placed
          </h2>
          <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
            Order <span className="font-semibold" style={{ color: "var(--text-primary)" }}>#{orderResult.display_id}</span> created successfully.
          </p>
          <p className="text-lg font-semibold mb-6" style={{ color: "var(--brand-green)" }}>
            {formatPrice(orderResult.total)}
          </p>
          <button
            onClick={handleReset}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "var(--brand-teal)" }}
          >
            Create Another Order
          </button>
        </div>
      </div>
    )
  }

  // ── Main Form ──

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1
              className="text-xl lg:text-2xl font-semibold"
              style={{ color: "var(--text-primary)", fontFamily: "Fraunces, Georgia, serif" }}
            >
              Create Order
            </h1>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: "rgba(14,124,134,0.1)", color: "var(--brand-teal)" }}
            >
              Pharmacist
            </span>
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Create a COD order on behalf of a customer.
          </p>
        </div>
        <Link
          to={"/$countryCode/account/pharmacist/rx-queue" as any}
          params={{ countryCode } as any}
          className="text-sm font-medium hover:underline"
          style={{ color: "var(--brand-teal)" }}
        >
          Back to Rx Queue
        </Link>
      </div>

      {/* Saved Drafts */}
      {drafts.length > 0 && (
        <section
          className="rounded-xl border p-4 mb-1"
          style={{ background: "rgba(14,124,134,0.03)", borderColor: "var(--brand-teal)" }}
        >
          <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Saved Drafts ({drafts.length})
          </h3>
          <div className="flex flex-col gap-2">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="flex items-center justify-between p-3 rounded-lg border"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border-primary)" }}
              >
                <div>
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {draft.customer.first_name} {draft.customer.last_name}
                  </span>
                  <span className="text-xs ml-2" style={{ color: "var(--text-tertiary)" }}>
                    {draft.cartItems.length} item{draft.cartItems.length !== 1 ? "s" : ""} · saved{" "}
                    {new Date(draft.savedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleLoadDraft(draft)}
                    className="px-3 py-1.5 rounded text-xs font-semibold text-white"
                    style={{ background: "var(--brand-teal)" }}
                  >
                    Resume
                  </button>
                  <button
                    onClick={() => handleDeleteDraft(draft.id)}
                    className="px-3 py-1.5 rounded text-xs font-medium"
                    style={{ color: "var(--brand-red)", background: "rgba(239,68,68,0.06)" }}
                  >
                    Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 1: Customer Selector */}
      <section
        className="rounded-xl border p-5"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border-primary)" }}
      >
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
          1. Customer
        </h2>

        {selectedCustomer ? (
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4" style={{ borderColor: "var(--border-primary)" }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {selectedCustomer.first_name} {selectedCustomer.last_name}
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {selectedCustomer.phone} {selectedCustomer.email ? `| ${selectedCustomer.email}` : ""}
              </p>
            </div>
            <button
              onClick={handleResetCustomer}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border hover:opacity-80"
              style={{ color: "var(--brand-red)", borderColor: "var(--border-primary)" }}
            >
              Change
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="flex flex-1 items-center rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-primary)" }}>
                <span
                  className="px-3 py-2.5 text-sm font-medium border-r"
                  style={{ color: "var(--text-secondary)", borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}
                >
                  +91
                </span>
                <input
                  type="tel"
                  placeholder="Phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCustomerSearch()}
                  className="flex-1 px-3.5 py-2.5 text-sm outline-none"
                  style={{ color: "var(--text-primary)", background: "transparent" }}
                  maxLength={10}
                />
              </div>
              <button
                onClick={handleCustomerSearch}
                disabled={customerLookup.isPending || !phone.trim()}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--brand-teal)" }}
              >
                {customerLookup.isPending ? "..." : "Search"}
              </button>
            </div>

            {/* Not found — create */}
            {customerLookup.isSuccess && !customerLookup.data?.found && (
              <div className="rounded-lg border p-4" style={{ borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}>
                <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                  No customer found. Enter a name to create one:
                </p>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="First name"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-lg border text-sm outline-none"
                    style={{ color: "var(--text-primary)", borderColor: "var(--border-primary)", background: "transparent" }}
                  />
                  <input
                    type="text"
                    placeholder="Last name"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-lg border text-sm outline-none"
                    style={{ color: "var(--text-primary)", borderColor: "var(--border-primary)", background: "transparent" }}
                  />
                </div>
                <button
                  onClick={handleCreateCustomer}
                  disabled={customerLookup.isPending || !newFirstName.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: "var(--brand-green)" }}
                >
                  {customerLookup.isPending ? "Creating..." : "Create & Select"}
                </button>
              </div>
            )}

            {customerLookup.isError && (
              <p className="text-xs" style={{ color: "var(--brand-red)" }}>
                Failed to look up customer. Please try again.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Section 2: Product Search + Cart */}
      {selectedCustomer && (
        <section
          className="rounded-xl border p-5"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border-primary)" }}
        >
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            2. Products
          </h2>

          {/* Search */}
          <div className="relative mb-4" ref={searchRef}>
            <input
              type="text"
              placeholder="Search medicines..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setShowResults(true)
              }}
              onFocus={() => setShowResults(true)}
              className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none"
              style={{ color: "var(--text-primary)", borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}
            />

            {/* Results dropdown */}
            {showResults && debouncedSearch.length >= 2 && (
              <div
                className="absolute left-0 right-0 top-full mt-1 rounded-lg border shadow-lg z-10 max-h-72 overflow-y-auto"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border-primary)" }}
              >
                {searchLoading && (
                  <p className="px-4 py-3 text-xs" style={{ color: "var(--text-tertiary)" }}>Searching...</p>
                )}
                {!searchLoading && searchResults && searchResults.length === 0 && (
                  <p className="px-4 py-3 text-xs" style={{ color: "var(--text-tertiary)" }}>No products found.</p>
                )}
                {searchResults?.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:opacity-80 cursor-pointer border-b last:border-b-0"
                    style={{ borderColor: "var(--border-primary)" }}
                    onClick={() => addToCart(product)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {product.title}
                        </p>
                        {product.drug_product?.schedule && (product.drug_product.schedule === "H" || product.drug_product.schedule === "H1") && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
                            style={{ background: "rgba(245,158,11,0.1)", color: "var(--brand-amber)" }}
                          >
                            Rx
                          </span>
                        )}
                        {product.drug_product?.schedule && product.drug_product.schedule !== "H" && product.drug_product.schedule !== "H1" && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
                            style={{ background: "rgba(22,163,74,0.1)", color: "var(--brand-green)" }}
                          >
                            OTC
                          </span>
                        )}
                      </div>
                      {product.drug_product?.generic_name && (
                        <p className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>
                          {product.drug_product.generic_name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {product.variant?.price != null ? formatPrice(product.variant.price) : "--"}
                      </span>
                      <span
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white"
                        style={{ background: "var(--brand-teal)" }}
                      >
                        Add
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart table */}
          {cartItems.length === 0 ? (
            <p className="text-xs py-6 text-center" style={{ color: "var(--text-tertiary)" }}>
              Search and add products above.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {cartItems.map((item) => (
                <div
                  key={item.variant_id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                  style={{ borderColor: "var(--border-primary)" }}
                >
                  {/* Thumbnail */}
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded shrink-0" style={{ background: "var(--border-primary)" }} />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {item.title}
                      </p>
                      {(item.schedule === "H" || item.schedule === "H1") && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
                          style={{ background: "rgba(245,158,11,0.1)", color: "var(--brand-amber)" }}
                        >
                          Rx
                        </span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {formatPrice(item.unit_price)} each
                    </p>
                  </div>

                  {/* Qty controls */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => updateQuantity(item.variant_id, -1)}
                      className="w-7 h-7 rounded border flex items-center justify-center text-sm hover:opacity-80"
                      style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
                    >
                      -
                    </button>
                    <span className="w-7 text-center text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.variant_id, 1)}
                      className="w-7 h-7 rounded border flex items-center justify-center text-sm hover:opacity-80"
                      style={{ borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
                    >
                      +
                    </button>
                  </div>

                  {/* Line total */}
                  <span className="text-sm font-semibold w-16 text-right shrink-0" style={{ color: "var(--text-primary)" }}>
                    {formatPrice(item.unit_price * item.quantity)}
                  </span>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(item.variant_id)}
                    className="text-xs hover:opacity-80 shrink-0"
                    style={{ color: "var(--brand-red)" }}
                    title="Remove"
                  >
                    &#10005;
                  </button>
                </div>
              ))}

              {/* Subtotal */}
              <div className="flex justify-end pt-2 border-t" style={{ borderColor: "var(--border-primary)" }}>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Subtotal:</span>
                <span className="text-sm font-semibold ml-2" style={{ color: "var(--text-primary)" }}>
                  {formatPrice(subtotal)}
                </span>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Section 3: Prescription (conditional) */}
      {selectedCustomer && hasRxItems && (
        <PrescriptionSelector
          customerId={selectedCustomer.id}
          selectedPrescriptionId={selectedPrescriptionId}
          onSelect={setSelectedPrescriptionId}
        />
      )}

      {/* Section 4: Shipping + Place Order */}
      {selectedCustomer && cartItems.length > 0 && (
        <section
          className="rounded-xl border p-5"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border-primary)" }}
        >
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            {hasRxItems ? "4" : "3"}. Shipping Address
          </h2>

          {/* Existing addresses */}
          {selectedCustomer.addresses.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {selectedCustomer.addresses.map((addr, idx) => (
                <label
                  key={addr.id ?? idx}
                  className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all"
                  style={{
                    borderColor: selectedAddress?.id === addr.id && !showNewAddress ? "var(--brand-teal)" : "var(--border-primary)",
                    background: selectedAddress?.id === addr.id && !showNewAddress ? "rgba(14,124,134,0.04)" : "transparent",
                  }}
                >
                  <input
                    type="radio"
                    name="address"
                    checked={selectedAddress?.id === addr.id && !showNewAddress}
                    onChange={() => selectExistingAddress(addr)}
                    className="mt-0.5"
                  />
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                      {addr.first_name} {addr.last_name}
                    </p>
                    <p>{addr.address_1}{addr.address_2 ? `, ${addr.address_2}` : ""}</p>
                    <p>{addr.city}{addr.province ? `, ${addr.province}` : ""} - {addr.postal_code}</p>
                    {addr.is_default_shipping && (
                      <span className="text-[10px] font-bold" style={{ color: "var(--brand-teal)" }}>Default</span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* New address toggle */}
          <label
            className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer mb-3"
            style={{
              borderColor: showNewAddress ? "var(--brand-teal)" : "var(--border-primary)",
              background: showNewAddress ? "rgba(14,124,134,0.04)" : "transparent",
            }}
          >
            <input
              type="radio"
              name="address"
              checked={showNewAddress}
              onChange={() => {
                setShowNewAddress(true)
                setSelectedAddress(null)
              }}
            />
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Enter new address
            </span>
          </label>

          {showNewAddress && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <input
                placeholder="First name"
                value={newAddress.first_name}
                onChange={(e) => setNewAddress((a) => ({ ...a, first_name: e.target.value }))}
                className="px-3.5 py-2.5 rounded-lg border text-sm outline-none"
                style={{ color: "var(--text-primary)", borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}
              />
              <input
                placeholder="Last name"
                value={newAddress.last_name}
                onChange={(e) => setNewAddress((a) => ({ ...a, last_name: e.target.value }))}
                className="px-3.5 py-2.5 rounded-lg border text-sm outline-none"
                style={{ color: "var(--text-primary)", borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}
              />
              <input
                placeholder="Address line 1"
                value={newAddress.address_1}
                onChange={(e) => setNewAddress((a) => ({ ...a, address_1: e.target.value }))}
                className="col-span-2 px-3.5 py-2.5 rounded-lg border text-sm outline-none"
                style={{ color: "var(--text-primary)", borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}
              />
              <input
                placeholder="Address line 2 (optional)"
                value={newAddress.address_2}
                onChange={(e) => setNewAddress((a) => ({ ...a, address_2: e.target.value }))}
                className="col-span-2 px-3.5 py-2.5 rounded-lg border text-sm outline-none"
                style={{ color: "var(--text-primary)", borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}
              />
              <input
                placeholder="City"
                value={newAddress.city}
                onChange={(e) => setNewAddress((a) => ({ ...a, city: e.target.value }))}
                className="px-3.5 py-2.5 rounded-lg border text-sm outline-none"
                style={{ color: "var(--text-primary)", borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}
              />
              <input
                placeholder="State / Province"
                value={newAddress.province}
                onChange={(e) => setNewAddress((a) => ({ ...a, province: e.target.value }))}
                className="px-3.5 py-2.5 rounded-lg border text-sm outline-none"
                style={{ color: "var(--text-primary)", borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}
              />
              <input
                placeholder="PIN code"
                value={newAddress.postal_code}
                onChange={(e) => setNewAddress((a) => ({ ...a, postal_code: e.target.value }))}
                className="px-3.5 py-2.5 rounded-lg border text-sm outline-none"
                style={{ color: "var(--text-primary)", borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}
                maxLength={6}
              />
              <input
                placeholder="Phone (optional)"
                value={newAddress.phone}
                onChange={(e) => setNewAddress((a) => ({ ...a, phone: e.target.value }))}
                className="px-3.5 py-2.5 rounded-lg border text-sm outline-none"
                style={{ color: "var(--text-primary)", borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}
              />
            </div>
          )}

          {/* Order Summary */}
          <div
            className="rounded-lg border p-4 mb-4"
            style={{ borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}
          >
            <h3 className="text-xs font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
              ORDER SUMMARY
            </h3>
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>
                  Items ({cartItems.reduce((s, i) => s + i.quantity, 0)})
                </span>
                <span style={{ color: "var(--text-primary)" }}>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Shipping</span>
                <span style={{ color: shippingCost === 0 ? "var(--brand-green)" : "var(--text-primary)" }}>
                  {shippingCost === 0 ? "FREE" : formatPrice(shippingCost)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t font-semibold" style={{ borderColor: "var(--border-primary)" }}>
                <span style={{ color: "var(--text-primary)" }}>Total</span>
                <span style={{ color: "var(--text-primary)" }}>{formatPrice(total)}</span>
              </div>
            </div>
          </div>

          {/* COD badge */}
          <div className="flex items-center gap-2 mb-4">
            <span
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: "rgba(22,163,74,0.1)", color: "var(--brand-green)" }}
            >
              Cash on Delivery
            </span>
          </div>

          {/* Notes */}
          <textarea
            placeholder="Order notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none resize-none mb-4"
            style={{ color: "var(--text-primary)", borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}
          />

          {/* Place Order + Save Draft */}
          <div className="flex gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={!selectedCustomer || cartItems.length === 0 || createOrder.isPending}
              className="flex-1 py-3 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 border"
              style={{ color: "var(--brand-teal)", borderColor: "var(--brand-teal)", background: "transparent" }}
            >
              Save as Draft
            </button>
            <button
              onClick={handlePlaceOrder}
              disabled={!canPlaceOrder || createOrder.isPending}
              className="flex-[2] py-3 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--brand-teal)" }}
            >
              {createOrder.isPending ? "Placing..." : "Place Order"}
            </button>
          </div>

          {createOrder.isError && (
            <p className="text-xs mt-2 text-center" style={{ color: "var(--brand-red)" }}>
              Failed to place order. Please try again.
            </p>
          )}
        </section>
      )}
    </div>
  )
}

// ── Prescription Selector Component ──────────────────────────────────

function PrescriptionSelector({
  customerId,
  selectedPrescriptionId,
  onSelect,
}: {
  customerId: string
  selectedPrescriptionId: string
  onSelect: (id: string) => void
}) {
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch prescriptions for this customer
  const { data: prescriptions, isLoading, refetch } = useQuery({
    queryKey: ["pharmacist", "customer-prescriptions", customerId],
    queryFn: async () => {
      const res = await sdk.client.fetch<{ prescriptions: any[] }>(
        `/store/pharmacist/prescriptions?customer_id=${customerId}`,
        { method: "GET" }
      )
      return res.prescriptions ?? []
    },
    enabled: !!customerId,
  })

  const validPrescriptions = (prescriptions ?? []).filter(
    (rx: any) => rx.status === "approved" || rx.status === "pending_review"
  )

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      alert("File too large. Max 10MB.")
      return
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    if (!allowed.includes(file.type)) {
      alert("Only JPG, PNG, WebP, or PDF files accepted.")
      return
    }

    setUploading(true)
    try {
      // Read file as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(",")[1]) // strip data:... prefix
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Upload file
      const uploadRes = await sdk.client.fetch<{ file_key: string; file_url: string }>(
        "/store/prescriptions/upload-file",
        { method: "POST", body: { filename: file.name, content_type: file.type, content: base64 } }
      )

      // Create prescription record linked to the customer
      const rxRes = await sdk.client.fetch<{ prescription: any }>(
        "/store/prescriptions",
        {
          method: "POST",
          body: {
            file_key: uploadRes.file_key,
            file_url: uploadRes.file_url,
            original_filename: file.name,
            content_type: file.type,
            file_size_bytes: file.size,
            customer_id: customerId,
          },
        }
      )

      // Select the newly uploaded prescription
      if (rxRes.prescription?.id) {
        onSelect(rxRes.prescription.id)
      }

      // Refresh the list
      refetch()
      setShowUpload(false)
    } catch (err: any) {
      alert("Upload failed: " + (err.message || "Please try again"))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [customerId, onSelect, refetch])

  return (
    <section
      className="rounded-xl border p-5"
      style={{ background: "rgba(245,158,11,0.06)", borderColor: "var(--brand-amber)" }}
    >
      <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--brand-amber)" }}>
        3. Prescription Required
      </h2>
      <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
        This order contains prescription medicines. Select an existing prescription or upload a new one.
      </p>

      {/* Existing prescriptions */}
      {isLoading ? (
        <p className="text-xs py-3" style={{ color: "var(--text-tertiary)" }}>Loading prescriptions...</p>
      ) : validPrescriptions.length > 0 ? (
        <div className="flex flex-col gap-2 mb-3">
          {validPrescriptions.map((rx: any) => (
            <label
              key={rx.id}
              className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all"
              style={{
                borderColor: selectedPrescriptionId === rx.id ? "var(--brand-teal)" : "var(--border-primary)",
                background: selectedPrescriptionId === rx.id ? "rgba(14,124,134,0.04)" : "var(--bg-primary)",
              }}
            >
              <input
                type="radio"
                name="prescription"
                checked={selectedPrescriptionId === rx.id}
                onChange={() => onSelect(rx.id)}
                className="accent-[var(--brand-teal)]"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {rx.original_filename || "Prescription"}
                  </span>
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{
                      background: rx.status === "approved" ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
                      color: rx.status === "approved" ? "#16a34a" : "#d97706",
                    }}
                  >
                    {rx.status === "approved" ? "Approved" : "Pending Review"}
                  </span>
                </div>
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {rx.doctor_name ? `Dr. ${rx.doctor_name}` : "Doctor not specified"} · Uploaded{" "}
                  {new Date(rx.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              </div>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-xs py-2 mb-2" style={{ color: "var(--text-tertiary)" }}>
          No prescriptions found for this customer.
        </p>
      )}

      {/* Upload new */}
      {showUpload ? (
        <div className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: "var(--border-primary)", background: "var(--bg-primary)" }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFileUpload}
            disabled={uploading}
            className="text-xs flex-1"
          />
          {uploading && (
            <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border-primary)", borderTopColor: "var(--brand-teal)" }} />
          )}
          <button onClick={() => setShowUpload(false)} className="text-xs" style={{ color: "var(--text-tertiary)" }}>Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => setShowUpload(true)}
          className="text-xs font-medium px-3 py-2 rounded-lg border transition-all hover:opacity-80"
          style={{ color: "var(--brand-teal)", borderColor: "var(--brand-teal)" }}
        >
          + Upload New Prescription
        </button>
      )}

      {/* Selected confirmation */}
      {selectedPrescriptionId && (
        <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: "var(--brand-green)" }}>
          <span>&#10003;</span> Prescription attached
        </div>
      )}
    </section>
  )
}
