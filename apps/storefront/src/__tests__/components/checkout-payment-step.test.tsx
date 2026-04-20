import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

// ---- Mocks must be declared before imports ----

const mockMutateAsync = vi.fn()
const mockPaymentProviders = [{ id: "pp_system_default" }, { id: "pp_paytm_paytm" }, { id: "pp_razorpay_razorpay" }]
const mockShowToast = vi.fn()

vi.mock("@/lib/hooks/use-checkout", () => ({
  useCartPaymentMethods: () => ({ data: mockPaymentProviders }),
  useInitiateCartPaymentSession: () => ({
    isPending: false,
    mutateAsync: mockMutateAsync,
  }),
}))

vi.mock("@/lib/utils/checkout", () => ({
  isStripe: (id?: string) => id?.startsWith("pp_stripe_"),
  isPaytm: (id?: string) => id?.startsWith("pp_paytm_") || id === "paytm",
  isRazorpay: (id?: string) => id?.startsWith("pp_razorpay_") || id === "razorpay",
  getActivePaymentSession: vi.fn(),
  isPaidWithGiftCard: () => false,
}))

vi.mock("@/lib/context/toast-context", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock("@/components/payment-container", () => ({
  default: ({ children, onClick, paymentProviderId, selectedPaymentOptionId }: any) => (
    <div
      data-testid={`payment-container-${paymentProviderId}`}
      data-selected={selectedPaymentOptionId === paymentProviderId}
      onClick={onClick}
    >
      {paymentProviderId}
      {children}
    </div>
  ),
}))

vi.mock("@/components/stripe-card-container", () => ({
  default: () => null,
}))

vi.mock("@/lib/utils/query-keys", () => ({
  queryKeys: {
    cart: { detail: (id: string) => ["cart", id], predicate: () => false },
    wallet: { all: ["wallet"], balance: () => ["wallet", "balance"] },
  },
}))

vi.mock("@/lib/hooks/use-wallet", () => ({
  useWallet: () => ({ data: null, isLoading: false }),
  useApplyWallet: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveWallet: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

import PaymentStep from "@/components/checkout-payment-step"
import { getActivePaymentSession } from "@/lib/utils/checkout"
import { makeCart } from "@/test/mocks"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("PaymentStep", () => {
  const onNext = vi.fn()
  const onBack = vi.fn()
  const cart = makeCart()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(getActivePaymentSession as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    mockMutateAsync.mockResolvedValue(undefined)
  })

  it("renders COD only and filters out Paytm and Razorpay", () => {
    // Backend still returns Paytm + Razorpay, but the UI must hide them for now.
    render(<PaymentStep cart={cart} onNext={onNext} onBack={onBack} />, { wrapper: createWrapper() })
    expect(screen.getByTestId("payment-container-pp_system_default")).toBeInTheDocument()
    expect(screen.queryByTestId("payment-container-pp_paytm_paytm")).not.toBeInTheDocument()
    expect(screen.queryByTestId("payment-container-pp_razorpay_razorpay")).not.toBeInTheDocument()
  })

  it("does NOT initiate session on mount (only on Next click)", () => {
    render(<PaymentStep cart={cart} onNext={onNext} onBack={onBack} />, { wrapper: createWrapper() })
    // No API call on mount — session only created when clicking Next
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it("initiates session and calls onNext when clicking Next", async () => {
    render(<PaymentStep cart={cart} onNext={onNext} onBack={onBack} />, { wrapper: createWrapper() })

    const nextButton = screen.getByTestId("submit-payment-button")
    await userEvent.click(nextButton)

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ provider_id: "pp_system_default" })
      expect(onNext).toHaveBeenCalled()
    })
  })

  it("shows toast when COD session creation fails", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("Payment setup failed"))

    render(<PaymentStep cart={cart} onNext={onNext} onBack={onBack} />, { wrapper: createWrapper() })

    await userEvent.click(screen.getByTestId("submit-payment-button"))

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith("Payment setup failed")
      expect(onNext).not.toHaveBeenCalled()
    })
  })

  it("ignores stale Paytm/Razorpay session on cart and defaults to COD", async () => {
    (getActivePaymentSession as ReturnType<typeof vi.fn>).mockReturnValue({
      provider_id: "pp_razorpay_razorpay",
      status: "pending",
    })

    render(<PaymentStep cart={cart} onNext={onNext} onBack={onBack} />, { wrapper: createWrapper() })

    await userEvent.click(screen.getByTestId("submit-payment-button"))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ provider_id: "pp_system_default" })
    })
  })

  it("prevents double-click on Next", async () => {
    let resolveMutation: () => void
    mockMutateAsync.mockImplementation(
      () => new Promise<void>((resolve) => { resolveMutation = resolve })
    )

    render(<PaymentStep cart={cart} onNext={onNext} onBack={onBack} />, { wrapper: createWrapper() })

    const nextButton = screen.getByTestId("submit-payment-button")
    await userEvent.click(nextButton)
    await userEvent.click(nextButton)

    // Only one mutation call despite double-click
    expect(mockMutateAsync).toHaveBeenCalledTimes(1)

    resolveMutation!()
    await waitFor(() => {
      expect(onNext).toHaveBeenCalled()
    })
  })

  it("Back button calls onBack", async () => {
    render(<PaymentStep cart={cart} onNext={onNext} onBack={onBack} />, { wrapper: createWrapper() })
    const backBtn = screen.getByText("Back")
    await userEvent.click(backBtn)
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
