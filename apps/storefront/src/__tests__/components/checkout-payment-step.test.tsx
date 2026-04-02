import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

// ---- Mocks must be declared before imports ----

const mockMutateAsync = vi.fn()
const mockPaymentProviders = [{ id: "pp_system_default" }]
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
  queryKeys: { cart: { detail: (id: string) => ["cart", id], predicate: () => false } },
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
  })

  it("renders available payment methods", () => {
    render(<PaymentStep cart={cart} onNext={onNext} onBack={onBack} />, { wrapper: createWrapper() })
    expect(screen.getByTestId("payment-container-pp_system_default")).toBeInTheDocument()
  })

  it("shows loading text when no payment methods yet", () => {
    mockPaymentProviders.length = 0
    render(<PaymentStep cart={cart} onNext={onNext} onBack={onBack} />, { wrapper: createWrapper() })
    expect(screen.getByText("Loading payment methods…")).toBeInTheDocument()
    mockPaymentProviders.push({ id: "pp_system_default" })
  })

  it("awaits mutateAsync before calling onNext", async () => {
    mockMutateAsync.mockResolvedValueOnce(undefined)

    render(<PaymentStep cart={cart} onNext={onNext} onBack={onBack} />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled()
    })

    let resolveMutation: () => void
    mockMutateAsync.mockImplementation(
      () => new Promise<void>((resolve) => { resolveMutation = resolve })
    )

    const nextButton = screen.getByTestId("submit-payment-button")
    await userEvent.click(nextButton)

    resolveMutation!()

    await waitFor(() => {
      expect(onNext).toHaveBeenCalled()
    })
  })

  it("shows toast when payment session initiation fails", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("Session creation failed"))

    render(<PaymentStep cart={cart} onNext={onNext} onBack={onBack} />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith("Session creation failed")
    })
  })

  it("always initiates session on submit (idempotent)", async () => {
    // Even with an active session, handleSubmit always calls initiatePaymentSession
    ;(getActivePaymentSession as ReturnType<typeof vi.fn>).mockReturnValue({
      id: "ps_1",
      provider_id: "pp_system_default",
      status: "pending",
    })
    mockMutateAsync.mockResolvedValue(undefined)

    render(<PaymentStep cart={cart} onNext={onNext} onBack={onBack} />, { wrapper: createWrapper() })

    const nextButton = screen.getByTestId("submit-payment-button")
    await userEvent.click(nextButton)

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledTimes(1)
    })
  })

  it("prevents double-click on Next", async () => {
    mockMutateAsync.mockResolvedValueOnce(undefined)

    render(<PaymentStep cart={cart} onNext={onNext} onBack={onBack} />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled()
    })

    let resolveMutation: () => void
    mockMutateAsync.mockImplementation(
      () => new Promise<void>((resolve) => { resolveMutation = resolve })
    )

    const nextButton = screen.getByTestId("submit-payment-button")
    const callsBefore = mockMutateAsync.mock.calls.length

    await userEvent.click(nextButton)
    await userEvent.click(nextButton)

    expect(mockMutateAsync.mock.calls.length - callsBefore).toBeLessThanOrEqual(1)

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
