import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---- Mocks ----

const mockUpdateMutate = vi.fn()
const mockDeleteMutate = vi.fn()
const mockApplyMutate = vi.fn()
const mockRemoveMutate = vi.fn()
let mockUpdateIsPending = false
let mockDeleteIsPending = false
let mockApplyIsPending = false

vi.mock("@/lib/hooks/use-cart", () => ({
  useCart: () => ({ data: null, isLoading: false }),
  useUpdateLineItem: () => ({ isPending: mockUpdateIsPending, mutate: mockUpdateMutate }),
  useDeleteLineItem: () => ({ isPending: mockDeleteIsPending, mutate: mockDeleteMutate }),
  useApplyPromoCode: () => ({ isPending: mockApplyIsPending, mutate: mockApplyMutate }),
  useRemovePromoCode: () => ({ isPending: false, mutate: mockRemoveMutate }),
}))

vi.mock("@/lib/utils/region", () => ({
  getCountryCodeFromPath: () => "in",
}))

vi.mock("@/lib/utils/price", () => ({
  getPricePercentageDiff: () => 0,
}))

vi.mock("@/lib/context/cart", () => ({
  useCartDrawer: () => ({ isOpen: false, openCart: vi.fn(), closeCart: vi.fn() }),
}))

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/in/cart" }),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}))

vi.mock("@/components/ui/thumbnail", () => ({
  Thumbnail: ({ alt }: any) => <div data-testid="thumbnail">{alt}</div>,
}))

vi.mock("@/components/ui/price", () => ({
  Price: ({ price }: any) => <span data-testid="price">₹{price}</span>,
}))

vi.mock("@/components/ui/loading", () => ({
  Loading: () => <div data-testid="loading">Loading</div>,
}))

vi.mock("@medusajs/icons", () => ({
  Minus: () => <span>−</span>,
  Plus: () => <span>+</span>,
  Trash: () => <span>🗑</span>,
  XMark: (props: any) => <span {...props}>✕</span>,
}))

import { CartItemQuantitySelector, CartPromo } from "@/components/cart"
import { makeCart } from "@/test/mocks"

describe("CartItemQuantitySelector", () => {
  const item = {
    id: "li_1",
    quantity: 3,
    thumbnail: "/img.jpg",
    product_title: "Paracetamol",
    title: "Paracetamol",
    variant_title: "500mg",
    total: 100,
  } as any

  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateIsPending = false
    mockDeleteIsPending = false
  })

  it("renders the current quantity", () => {
    render(<CartItemQuantitySelector item={item} />)
    const input = screen.getByRole("spinbutton") as HTMLInputElement
    expect(input.value).toBe("3")
  })

  it("calls update with quantity + 1 when + is clicked", async () => {
    render(<CartItemQuantitySelector item={item} />)
    const plusBtn = screen.getByText("+").closest("button")!
    await userEvent.click(plusBtn)
    expect(mockUpdateMutate).toHaveBeenCalledWith({
      line_id: "li_1",
      quantity: 4,
    })
  })

  it("calls update with quantity - 1 when minus is clicked", async () => {
    render(<CartItemQuantitySelector item={item} />)
    const buttons = screen.getAllByRole("button")
    const minusBtn = buttons[0] // first button is minus/decrease
    await userEvent.click(minusBtn)
    expect(mockUpdateMutate).toHaveBeenCalledWith({
      line_id: "li_1",
      quantity: 2,
    })
  })

  it("calls delete when quantity would become 0", async () => {
    const singleItem = { ...item, quantity: 1 }
    render(<CartItemQuantitySelector item={singleItem} />)
    const buttons = screen.getAllByRole("button")
    const minusBtn = buttons[0] // first button is minus/delete
    await userEvent.click(minusBtn)
    expect(mockDeleteMutate).toHaveBeenCalledWith({ line_id: "li_1" })
  })

  it("disables buttons when update is pending", () => {
    mockUpdateIsPending = true
    render(<CartItemQuantitySelector item={item} />)
    const buttons = screen.getAllByRole("button")
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })

  it("disables buttons when delete is pending", () => {
    mockDeleteIsPending = true
    render(<CartItemQuantitySelector item={item} />)
    const buttons = screen.getAllByRole("button")
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })

  it("applies opacity class when mutating", () => {
    mockUpdateIsPending = true
    const { container } = render(<CartItemQuantitySelector item={item} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain("opacity-50")
  })
})

describe("CartPromo", () => {
  const cart = makeCart({ promotions: [] })

  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyIsPending = false
  })

  it("shows 'Add promo code' button initially", () => {
    render(<CartPromo cart={cart} />)
    expect(screen.getByText("Add promo code")).toBeInTheDocument()
  })

  it("shows input after clicking Add promo code", async () => {
    render(<CartPromo cart={cart} />)
    await userEvent.click(screen.getByText("Add promo code"))
    expect(screen.getByPlaceholderText("Enter promo code")).toBeInTheDocument()
  })

  it("shows error message when apply fails", async () => {
    mockApplyMutate.mockImplementation((_data: any, opts: any) => {
      opts.onError(new Error("Code not valid"))
    })

    render(<CartPromo cart={cart} />)
    await userEvent.click(screen.getByText("Add promo code"))

    const input = screen.getByPlaceholderText("Enter promo code")
    await userEvent.type(input, "BADCODE")
    await userEvent.click(screen.getByText("Apply"))

    await waitFor(() => {
      expect(screen.getByText("Code not valid")).toBeInTheDocument()
    })
  })

  it("clears error when user types new code", async () => {
    mockApplyMutate.mockImplementation((_data: any, opts: any) => {
      opts.onError(new Error("Code not valid"))
    })

    render(<CartPromo cart={cart} />)
    await userEvent.click(screen.getByText("Add promo code"))

    const input = screen.getByPlaceholderText("Enter promo code")
    await userEvent.type(input, "BAD")
    await userEvent.click(screen.getByText("Apply"))

    await waitFor(() => {
      expect(screen.getByText("Code not valid")).toBeInTheDocument()
    })

    await userEvent.type(input, "X")

    await waitFor(() => {
      expect(screen.queryByText("Code not valid")).not.toBeInTheDocument()
    })
  })

  it("Apply button is disabled when input is empty", async () => {
    render(<CartPromo cart={cart} />)
    await userEvent.click(screen.getByText("Add promo code"))
    const applyBtn = screen.getByText("Apply")
    expect(applyBtn).toBeDisabled()
  })

  it("hides input and clears error on Cancel", async () => {
    render(<CartPromo cart={cart} />)
    await userEvent.click(screen.getByText("Add promo code"))

    expect(screen.getByPlaceholderText("Enter promo code")).toBeInTheDocument()

    await userEvent.click(screen.getByText("Cancel"))

    expect(screen.queryByPlaceholderText("Enter promo code")).not.toBeInTheDocument()
    expect(screen.getByText("Add promo code")).toBeInTheDocument()
  })

  it("shows existing promotions with remove button", () => {
    const cartWithPromo = makeCart({
      promotions: [{ code: "SAVE10" }] as any,
    })
    render(<CartPromo cart={cartWithPromo} />)
    expect(screen.getByText("SAVE10")).toBeInTheDocument()
  })
})
