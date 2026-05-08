import { describe, it, expect, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useAddToCart, AuthRequiredError } from "./use-cart"
import { queryKeys } from "@/lib/utils/query-keys"

const makeWrapper = (qc: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }

describe("useAddToCart auth gate", () => {
  let qc: QueryClient
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    // Seed the customer cache as anonymous so the gate fires synchronously.
    qc.setQueryData(queryKeys.customer.current(), null)
  })

  it("rejects anonymous add with AuthRequiredError carrying the variant id", async () => {
    const { result } = renderHook(() => useAddToCart(), { wrapper: makeWrapper(qc) })
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
