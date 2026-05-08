import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useAddToCart, AuthRequiredError } from "./use-cart"

// useCustomer must resolve to null/anonymous for the gate to fire.
vi.mock("@/lib/hooks/use-customer", () => ({
  useCustomer: () => ({ data: null, isLoading: false }),
}))

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe("useAddToCart auth gate", () => {
  it("rejects anonymous add with AuthRequiredError carrying the variant id", async () => {
    const { result } = renderHook(() => useAddToCart(), { wrapper })
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          variant_id: "variant_test",
          quantity: 1,
          country_code: "in",
        })
      ).rejects.toMatchObject({
        name: "AuthRequiredError",
        pendingAction: "add_to_cart:variant_test",
      })
    })
  })

  it("AuthRequiredError exposes pendingAction property", () => {
    const err = new AuthRequiredError("add_to_cart:variant_xyz")
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("AuthRequiredError")
    expect(err.pendingAction).toBe("add_to_cart:variant_xyz")
  })
})
