import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockSetShippingMutateAsync = vi.fn()
let mockShippingOptions: any[] | undefined = [
  { id: "so_standard", name: "Standard Shipping", amount: 50 },
  { id: "so_express", name: "Express Shipping", amount: 150 },
]

vi.mock("@/lib/hooks/use-checkout", () => ({
  useShippingOptions: () => ({ data: mockShippingOptions }),
  useSetCartShippingMethod: () => ({
    isPending: false,
    mutateAsync: mockSetShippingMutateAsync,
  }),
}))

vi.mock("@/components/shipping-item-selector", () => ({
  default: ({ shippingOption, isSelected, handleSelect }: any) => (
    <div
      data-testid={`shipping-option-${shippingOption.id}`}
      data-selected={isSelected}
      onClick={() => handleSelect(shippingOption.id)}
    >
      {shippingOption.name}
    </div>
  ),
}))

import DeliveryStep from "@/components/checkout-delivery-step"
import { makeCart } from "@/test/mocks"

describe("DeliveryStep", () => {
  const onNext = vi.fn()
  const onBack = vi.fn()
  const cart = makeCart()

  beforeEach(() => {
    vi.clearAllMocks()
    mockSetShippingMutateAsync.mockResolvedValue({})
    mockShippingOptions = [
      { id: "so_standard", name: "Standard Shipping", amount: 50 },
      { id: "so_express", name: "Express Shipping", amount: 150 },
    ]
  })

  it("renders shipping options", () => {
    render(<DeliveryStep cart={cart} onNext={onNext} onBack={onBack} />)
    expect(screen.getByTestId("shipping-option-so_standard")).toBeInTheDocument()
    expect(screen.getByTestId("shipping-option-so_express")).toBeInTheDocument()
  })

  it("shows loading message when shipping options are not yet available", () => {
    mockShippingOptions = undefined
    render(<DeliveryStep cart={cart} onNext={onNext} onBack={onBack} />)
    expect(screen.getByText("Loading shipping options…")).toBeInTheDocument()
  })

  it("shows empty state when no shipping options available", () => {
    mockShippingOptions = []
    render(<DeliveryStep cart={cart} onNext={onNext} onBack={onBack} />)
    expect(
      screen.getByText(/no shipping options available/i)
    ).toBeInTheDocument()
  })

  it("calls onNext after successful submission", async () => {
    render(<DeliveryStep cart={cart} onNext={onNext} onBack={onBack} />)

    // Select an option
    await userEvent.click(screen.getByTestId("shipping-option-so_standard"))

    const nextBtn = screen.getByRole("button", { name: /next/i })
    await userEvent.click(nextBtn)

    await waitFor(() => {
      expect(mockSetShippingMutateAsync).toHaveBeenCalledWith({
        shipping_option_id: "so_standard",
      })
      expect(onNext).toHaveBeenCalledTimes(1)
    })
  })

  it("shows Saving… during submission", async () => {
    let resolveMutation: () => void
    mockSetShippingMutateAsync.mockImplementation(
      () => new Promise<void>((resolve) => { resolveMutation = resolve })
    )

    render(<DeliveryStep cart={cart} onNext={onNext} onBack={onBack} />)
    await userEvent.click(screen.getByTestId("shipping-option-so_standard"))

    const nextBtn = screen.getByRole("button", { name: /next/i })
    await userEvent.click(nextBtn)

    expect(screen.getByText("Saving…")).toBeInTheDocument()

    resolveMutation!()
    await waitFor(() => expect(onNext).toHaveBeenCalled())
  })

  it("displays error when shipping method fails", async () => {
    mockSetShippingMutateAsync.mockRejectedValueOnce(
      new Error("Shipping option expired")
    )

    render(<DeliveryStep cart={cart} onNext={onNext} onBack={onBack} />)
    await userEvent.click(screen.getByTestId("shipping-option-so_standard"))

    await userEvent.click(screen.getByRole("button", { name: /next/i }))

    await waitFor(() => {
      expect(screen.getByText("Shipping option expired")).toBeInTheDocument()
    })
    expect(onNext).not.toHaveBeenCalled()
  })

  it("Back button calls onBack", async () => {
    render(<DeliveryStep cart={cart} onNext={onNext} onBack={onBack} />)
    await userEvent.click(screen.getByRole("button", { name: /back/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
