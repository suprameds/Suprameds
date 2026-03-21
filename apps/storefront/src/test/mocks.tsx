import { vi } from "vitest"
import type { HttpTypes } from "@medusajs/types"

// ---- Cart factory ----

export function makeCart(overrides: Partial<HttpTypes.StoreCart> = {}): HttpTypes.StoreCart {
  return {
    id: "cart_test_123",
    email: "test@example.com",
    currency_code: "inr",
    subtotal: 500,
    total: 550,
    shipping_total: 50,
    discount_total: 0,
    tax_total: 0,
    item_subtotal: 500,
    items: [],
    promotions: [],
    shipping_methods: [{ id: "sm_1", shipping_option_id: "so_1", name: "Standard", amount: 50 }],
    shipping_address: {
      id: "addr_1",
      first_name: "Test",
      last_name: "User",
      address_1: "123 Street",
      city: "Mumbai",
      postal_code: "400001",
      country_code: "in",
      phone: "+919999999999",
    },
    billing_address: {
      id: "addr_2",
      first_name: "Test",
      last_name: "User",
      address_1: "123 Street",
      city: "Mumbai",
      postal_code: "400001",
      country_code: "in",
      phone: "+919999999999",
    },
    region: {
      id: "reg_india",
      name: "India",
      currency_code: "inr",
      countries: [{ iso_2: "in", display_name: "India" }],
    },
    payment_collection: {
      id: "pc_1",
      payment_sessions: [
        { id: "ps_1", provider_id: "pp_system_default", status: "pending", amount: 550 },
      ],
    },
    ...overrides,
  } as unknown as HttpTypes.StoreCart
}

// ---- Mutation mock factory ----

type MutationState = {
  isPending: boolean
  mutate: ReturnType<typeof vi.fn>
  mutateAsync: ReturnType<typeof vi.fn>
}

export function makeMutation(overrides: Partial<MutationState> = {}): MutationState {
  return {
    isPending: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
}

// ---- Router mock ----

export const mockNavigate = vi.fn()
export const mockLocation = { pathname: "/in/checkout", search: "", hash: "" }

export function mockRouter() {
  return {
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
    Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  }
}
