import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---- Mocks must be declared before imports ----

const mockMutateAsync = vi.fn()
const mockPaymentProviders = [{ id: "pp_system_default" }]

vi.mock("@/lib/hooks/use-checkout", () => ({
  useCartPaymentMethods: () => ({ data: mockPaymentProviders }),
  useInitiateCartPaymentSession: () => ({
    isPending: false,
    mutateAsync: mockMutateAsync,
  }),
}))

vi.mock("@/lib/utils/checkout", () => ({
  isStripe: (id?: string) => id?.startsWith("pp_stripe_"),
  getActivePaymentSession: vi.fn(),
  isPaidWithGiftCard: () => false,
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

import PaymentStep from "@/components/checkout-payment-step"
import { getActivePaymentSession } from "@/lib/utils/checkout"
import { makeCart } from "@/test/mocks"

describe("PaymentStep", () => {
  const onNext = vi.fn()
  const onBack = vi.fn()
  const cart = makeCart()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(getActivePaymentSession as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
  })

  it("renders available payment methods", () => {
    render(<PaymentStep cart={cart} onNext={onNext} onBack={onBack} />)
    expect(screen.getByTestId("payment-container-pp_system_default")).toBeInTheDocument()
  })

  it("shows loading text when no payment methods yet", () => {
    mockPaymentProviders.length = 0
    render(<PaymentStep cart={cart} onNext={onNext} onBack={onBack} />)
    expect(screen.getByText("Loading payment methods…")).toBeInTheDocument()
    mockPaymentProviders.push({ id: "pp_system_default" })
  })

  it("awaits mutateAsync before calling onNext", async () => {
    let resolveMutation: () => void
    mockMutateAsync.mockImplementation(
      () => new Promise<void>((resolve) => { resolveMutation = resolve })
    )

    render(<PaymentStep cart={cart} onNext={onNext} onBack={onBack} />)

    const nextButton = screen.getByTestId("submit-payment-button")
    await userEvent.click(nextButton)

    // onNext should NOT have been called yet — mutation still pending
    expect(onNext).not.toHaveBeenCalled()
    expect(screen.getByText("Setting up payment…")).toBeInTheDocument()

    // Now resolve the mutation
    resolveMutation!()

    await waitFor(() => {
      expect(onNext).toHaveBeenCalledTimes(1)
    })
  })

  it("shows error when payment session initiation fails", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("Session creation failed"))

    render(<PaymentStep cart={cart} onNext={onNext} onBack={onBack} />)

    const nextButton = screen.getByTestId("submit-payment-button")
    await userEvent.click(nextButton)

    await waitFor(() => {
      expect(screen.getByText("Session creation failed")).toBeInTheDocument()
    })
  })

  it("skips initiation when activeSession already exists", async () => {
    ;(getActivePaymentSession as ReturnType<typeof vi.fn>).mockReturnValue({
      id: "ps_1",
      provider_id: "pp_system_default",
      status: "pending",
    })
    mockMutateAsync.mockClear()

    render(<PaymentStep cart={cart} onNext={onNext} onBack={onBack} />)

    const nextButton = screen.getByTestId("submit-payment-button")
    await userEvent.click(nextButton)

    // Should not call mutateAsync since session already exists
    expect(mockMutateAsync).not.toHaveBeenCalled()
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it("prevents double-click on Next", async () => {
    let resolveMutation: () => void
    mockMutateAsync.mockImplementation(
      () => new Promise<void>((resolve) => { resolveMutation = resolve })
    )

    render(<PaymentStep cart={cart} onNext={onNext} onBack={onBack} />)

    // The auto-init useEffect may have already called mutateAsync once
    const callsBefore = mockMutateAsync.mock.calls.length

    const nextButton = screen.getByTestId("submit-payment-button")
    await userEvent.click(nextButton)
    await userEvent.click(nextButton) // second click should be blocked

    // Should only add ONE call from user clicks (the second is guarded)
    expect(mockMutateAsync).toHaveBeenCalledTimes(callsBefore + 1)

    resolveMutation!()
    await waitFor(() => {
      expect(onNext).toHaveBeenCalledTimes(1)
    })
  })

  it("Back button calls onBack", async () => {
    render(<PaymentStep cart={cart} onNext={onNext} onBack={onBack} />)
    const backBtn = screen.getByText("Back")
    await userEvent.click(backBtn)
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
