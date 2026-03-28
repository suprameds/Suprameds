import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockMutateAsync = vi.fn()
const mockNavigate = vi.fn()

vi.mock("@/lib/hooks/use-checkout", () => ({
  useCompleteCartOrder: () => ({
    isPending: false,
    mutateAsync: mockMutateAsync,
  }),
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/in/checkout" }),
}))

vi.mock("@/lib/utils/checkout", () => ({
  getActivePaymentSession: (cart: any) =>
    cart?.payment_collection?.payment_sessions?.find(
      (s: any) => s.status === "pending"
    ),
  isStripe: (id?: string) => id?.startsWith("pp_stripe_"),
  isManual: (id?: string) => id?.startsWith("pp_system_default") || id === "manual",
  isRazorpay: (id?: string) => id?.startsWith("pp_razorpay_"),
}))

vi.mock("@/lib/utils/region", () => ({
  getCountryCodeFromPath: () => "in",
}))

vi.mock("./razorpay-payment-button", () => ({
  RazorpayPaymentButton: () => <button>Razorpay Pay</button>,
}))

import PaymentButton from "@/components/payment-button"
import { makeCart } from "@/test/mocks"

describe("PaymentButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("COD (ManualPaymentButton)", () => {
    const codCart = makeCart({
      payment_collection: {
        id: "pc_1",
        payment_sessions: [
          { id: "ps_1", provider_id: "pp_system_default", status: "pending", amount: 550 },
        ],
      } as any,
    })

    it("renders COD info and Place COD Order button", () => {
      render(<PaymentButton cart={codCart} />)
      expect(screen.getByText("Cash on Delivery")).toBeInTheDocument()
      expect(screen.getByTestId("place-order-button")).toHaveTextContent("Place COD Order")
    })

    it("completes order and navigates on click", async () => {
      mockMutateAsync.mockResolvedValueOnce({ id: "order_123" })

      render(<PaymentButton cart={codCart} />)
      await userEvent.click(screen.getByTestId("place-order-button"))

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledTimes(1)
        expect(mockNavigate).toHaveBeenCalledWith(
          expect.objectContaining({
            to: "/in/order/order_123/confirmed",
            replace: true,
          })
        )
      })
    })

    it("shows Processing… while submitting", async () => {
      let resolveMutation: (val: any) => void
      mockMutateAsync.mockImplementation(
        () => new Promise((r) => { resolveMutation = r })
      )

      render(<PaymentButton cart={codCart} />)
      await userEvent.click(screen.getByTestId("place-order-button"))

      expect(screen.getByText("Processing…")).toBeInTheDocument()
      expect(screen.getByTestId("place-order-button")).toBeDisabled()

      resolveMutation!({ id: "order_123" })
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled()
      })
    })

    it("prevents double-click (guard in handler)", async () => {
      let resolveMutation: (val: any) => void
      mockMutateAsync.mockImplementation(
        () => new Promise((r) => { resolveMutation = r })
      )

      render(<PaymentButton cart={codCart} />)
      const btn = screen.getByTestId("place-order-button")

      await userEvent.click(btn)
      await userEvent.click(btn)

      expect(mockMutateAsync).toHaveBeenCalledTimes(1)

      resolveMutation!({ id: "order_123" })
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledTimes(1)
      })
    })

    it("shows error on failure", async () => {
      mockMutateAsync.mockRejectedValueOnce(new Error("Server unavailable"))

      render(<PaymentButton cart={codCart} />)
      await userEvent.click(screen.getByTestId("place-order-button"))

      await waitFor(() => {
        expect(screen.getByText("Server unavailable")).toBeInTheDocument()
      })
    })

    it("button is disabled when cart is not ready", () => {
      const incompleteCart = makeCart({
        shipping_address: undefined as any,
      })
      // Override to still have the manual session
      ;(incompleteCart as any).payment_collection = codCart.payment_collection

      render(<PaymentButton cart={incompleteCart} />)
      expect(screen.getByTestId("place-order-button")).toBeDisabled()
    })
  })

  describe("Stripe (StripePaymentButton)", () => {
    const stripeCart = makeCart({
      payment_collection: {
        id: "pc_1",
        payment_sessions: [
          { id: "ps_1", provider_id: "pp_stripe_card", status: "pending", amount: 550 },
        ],
      } as any,
    })

    it("renders 'Card payments coming soon' message for Stripe", () => {
      render(<PaymentButton cart={stripeCart} />)
      expect(screen.getByText(/Card payments are coming soon/i)).toBeInTheDocument()
    })

    it("renders a disabled button for Stripe", () => {
      render(<PaymentButton cart={stripeCart} />)
      expect(screen.getByText("Card payments coming soon")).toBeDisabled()
    })
  })

  describe("No active session", () => {
    it("renders disabled 'Select a payment method' when no session", () => {
      const noSessionCart = makeCart({
        payment_collection: {
          id: "pc_1",
          payment_sessions: [],
        } as any,
      })

      render(<PaymentButton cart={noSessionCart} />)
      expect(screen.getByText("Select a payment method")).toBeDisabled()
    })
  })
})
