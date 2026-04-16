import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock fetch globally — pincode serviceability check calls fetch before mutation
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ serviceable: true }),
})
vi.stubGlobal("fetch", mockFetch)

const mockMutateAsync = vi.fn()

vi.mock("@/lib/hooks/use-checkout", () => ({
  useSetCartAddresses: () => ({
    isPending: false,
    mutateAsync: mockMutateAsync,
  }),
}))

vi.mock("@/lib/hooks/use-customer", () => ({
  useCustomerAddresses: () => ({ data: [] }),
  useCustomer: () => ({ data: { customer: { email: "test@example.com" } } }),
}))

vi.mock("@/lib/utils/region", () => ({
  getStoredCountryCode: () => "in",
}))

vi.mock("@/components/address-form", () => ({
  normalizeIndianPhone: (phone: string) => phone?.replace(/\D/g, "").slice(-10) || "",
  default: ({ setAddressFormData, setIsFormValid }: any) => {
    // Simulate a valid form by calling setIsFormValid(true)
    if (setIsFormValid) {
      setTimeout(() => setIsFormValid(true), 0)
    }
    return (
      <div data-testid="mock-address-form">
        <button
          type="button"
          data-testid="fill-address"
          onClick={() => {
            setAddressFormData({
              first_name: "Test",
              last_name: "User",
              company: "",
              address_1: "123 Street",
              address_2: "",
              city: "Mumbai",
              postal_code: "400001",
              province: "MH",
              country_code: "in",
              phone: "+919999999999",
            })
          }}
        >
          Fill
        </button>
      </div>
    )
  },
}))

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: (props: any) => <input type="checkbox" {...props} />,
}))

vi.mock("@/components/ui/input", () => ({
  Input: (props: any) => <input {...props} />,
}))

import AddressStep from "@/components/checkout-address-step"
import { makeCart } from "@/test/mocks"

describe("AddressStep", () => {
  const onNext = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockMutateAsync.mockResolvedValue({})
  })

  const cart = makeCart({
    region: {
      id: "reg_india",
      name: "India",
      currency_code: "inr",
      countries: [{ iso_2: "in", display_name: "India" }],
    } as any,
  })

  it("shows Saving… while submitting", async () => {
    let resolveMutation: () => void
    mockMutateAsync.mockImplementation(
      () => new Promise<void>((resolve) => { resolveMutation = resolve })
    )

    render(<AddressStep cart={cart} onNext={onNext} />)

    // Wait for form validation to settle
    await waitFor(() => {
      // Fill email
    })

    const emailInput = screen.getByPlaceholderText("your@email.com")
    await userEvent.clear(emailInput)
    await userEvent.type(emailInput, "test@example.com")

    // Click fill for shipping address
    const fillButtons = screen.getAllByTestId("fill-address")
    await userEvent.click(fillButtons[0])

    await waitFor(() => {
      const submitBtn = screen.getByRole("button", { name: /next|saving/i })
      expect(submitBtn).not.toBeDisabled()
    })

    const submitBtn = screen.getByRole("button", { name: /next/i })
    await userEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText("Saving…")).toBeInTheDocument()
    })

    resolveMutation!()
    await waitFor(() => {
      expect(onNext).toHaveBeenCalledTimes(1)
    })
  })

  it("displays error message when mutation fails", async () => {
    // Pincode check passes, but address mutation fails
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ serviceable: true }) })
    mockMutateAsync.mockRejectedValueOnce(new Error("Network error"))

    render(<AddressStep cart={cart} onNext={onNext} />)

    const emailInput = screen.getByPlaceholderText("your@email.com")
    await userEvent.clear(emailInput)
    await userEvent.type(emailInput, "test@example.com")

    const fillButtons = screen.getAllByTestId("fill-address")
    await userEvent.click(fillButtons[0])

    await waitFor(() => {
      const submitBtn = screen.getByRole("button", { name: /next/i })
      expect(submitBtn).not.toBeDisabled()
    })

    await userEvent.click(screen.getByRole("button", { name: /next/i }))

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument()
    })

    expect(onNext).not.toHaveBeenCalled()
  })
})
