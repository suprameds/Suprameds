import { describe, it, expect, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useAuthGuard } from "./use-auth-guard"

const mockNavigate = vi.fn()
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/products/atorcyn-10", search: "" }),
}))

vi.mock("./use-customer", () => ({
  useCustomer: () => ({ data: null, isLoading: false }),
}))

describe("useAuthGuard", () => {
  it("redirects anonymous users to login with redirectTo + pendingAction", () => {
    const { result } = renderHook(() => useAuthGuard())
    const allowed = result.current.requireAuth("add_to_cart:variant_123")
    expect(allowed).toBe(false)
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/account/login",
      search: { redirectTo: "/products/atorcyn-10", pendingAction: "add_to_cart:variant_123" },
    })
  })
})
