/**
 * Unit tests for the cache-invalidation subscriber.
 */

import cacheInvalidationHandler from "../cache-invalidation"

describe("cacheInvalidationHandler (unit)", () => {
  let mockCacheService: {
    get: jest.Mock
    set: jest.Mock
    invalidate: jest.Mock
  }

  let mockContainer: { resolve: jest.Mock }

  beforeEach(() => {
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn().mockResolvedValue(undefined),
    }
    mockContainer = {
      resolve: jest.fn().mockReturnValue(mockCacheService),
    }
  })

  it("invalidates all product-related cache keys", async () => {
    await cacheInvalidationHandler({
      container: mockContainer as any,
      event: { name: "product.updated", data: { id: "prod_123" } } as any,
      data: { id: "prod_123" },
    } as any)

    expect(mockCacheService.invalidate).toHaveBeenCalledWith("store:products:*")
    expect(mockCacheService.invalidate).toHaveBeenCalledWith("store:categories:*")
    expect(mockCacheService.invalidate).toHaveBeenCalledWith("store:regions:*")
    expect(mockCacheService.invalidate).toHaveBeenCalledTimes(3)
  })

  it("does not throw when cache invalidation fails", async () => {
    mockCacheService.invalidate.mockRejectedValue(new Error("Redis down"))

    await expect(
      cacheInvalidationHandler({
        container: mockContainer as any,
        event: { name: "product.deleted", data: { id: "prod_456" } } as any,
        data: { id: "prod_456" },
      } as any)
    ).resolves.not.toThrow()
  })

  it("continues invalidating remaining keys when one fails", async () => {
    mockCacheService.invalidate
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)

    await cacheInvalidationHandler({
      container: mockContainer as any,
      event: { name: "product.updated", data: { id: "prod_789" } } as any,
      data: { id: "prod_789" },
    } as any)

    expect(mockCacheService.invalidate).toHaveBeenCalledTimes(3)
  })
})
