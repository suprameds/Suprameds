import { createRateLimiter } from "../rate-limiter"

function makeReq(ip = "1.2.3.4", headers: Record<string, string> = {}) {
  return { ip, headers } as any
}

function makeRes() {
  const res: any = {
    _status: 0,
    _body: null,
    _headers: {} as Record<string, string>,
    status(code: number) {
      res._status = code
      return res
    },
    json(body: any) {
      res._body = body
      return res
    },
    setHeader(key: string, value: string) {
      res._headers[key] = value
    },
  }
  return res
}

describe("createRateLimiter()", () => {
  it("allows requests under the limit", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 3 })
    const req = makeReq()
    const res = makeRes()
    const next = jest.fn()

    limiter(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res._status).toBe(0)
  })

  it("allows exactly maxRequests within the window", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 3 })
    const next = jest.fn()

    for (let i = 0; i < 3; i++) {
      limiter(makeReq(), makeRes(), next)
    }

    expect(next).toHaveBeenCalledTimes(3)
  })

  it("returns 429 when limit is exceeded", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2 })
    const next = jest.fn()

    // Use up the limit
    limiter(makeReq(), makeRes(), next)
    limiter(makeReq(), makeRes(), next)

    // Third request should be rejected
    const res = makeRes()
    limiter(makeReq(), res, next)

    expect(next).toHaveBeenCalledTimes(2)
    expect(res._status).toBe(429)
    expect(res._body.message).toMatch(/Too many requests/)
    expect(res._headers["Retry-After"]).toBeDefined()
  })

  it("tracks different IPs independently", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1 })
    const next = jest.fn()

    limiter(makeReq("10.0.0.1"), makeRes(), next)
    limiter(makeReq("10.0.0.2"), makeRes(), next)

    expect(next).toHaveBeenCalledTimes(2)
  })

  it("uses X-Forwarded-For header when present", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1 })
    const next = jest.fn()

    // First request from proxy IP with X-Forwarded-For
    const req1 = makeReq("127.0.0.1", { "x-forwarded-for": "203.0.113.5" })
    limiter(req1, makeRes(), next)

    // Second request from same forwarded IP — should be blocked
    const req2 = makeReq("127.0.0.1", { "x-forwarded-for": "203.0.113.5" })
    const res2 = makeRes()
    limiter(req2, res2, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res2._status).toBe(429)
  })

  it("uses custom keyGenerator when provided", () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 1,
      keyGenerator: (req: any) => req.headers["x-api-key"] ?? "anon",
    })
    const next = jest.fn()

    const req1 = makeReq("10.0.0.1", { "x-api-key": "key-a" })
    limiter(req1, makeRes(), next)

    const req2 = makeReq("10.0.0.1", { "x-api-key": "key-b" })
    limiter(req2, makeRes(), next)

    // Different keys, both should pass even from same IP
    expect(next).toHaveBeenCalledTimes(2)
  })

  it("resets after the window expires", () => {
    jest.useFakeTimers()
    const limiter = createRateLimiter({ windowMs: 1_000, maxRequests: 1 })
    const next = jest.fn()

    limiter(makeReq(), makeRes(), next)
    expect(next).toHaveBeenCalledTimes(1)

    // Blocked immediately
    const res1 = makeRes()
    limiter(makeReq(), res1, next)
    expect(res1._status).toBe(429)

    // Advance past window
    jest.advanceTimersByTime(1_100)

    // Should be allowed again
    limiter(makeReq(), makeRes(), next)
    expect(next).toHaveBeenCalledTimes(2)

    jest.useRealTimers()
  })

  it("returns Retry-After header with correct value", () => {
    jest.useFakeTimers()
    const limiter = createRateLimiter({ windowMs: 10_000, maxRequests: 1 })
    const next = jest.fn()

    limiter(makeReq(), makeRes(), next)

    // Advance 3 seconds, then try again
    jest.advanceTimersByTime(3_000)
    const res = makeRes()
    limiter(makeReq(), res, next)

    // Should retry after ~7 seconds (10s window - 3s elapsed)
    const retryAfter = Number(res._headers["Retry-After"])
    expect(retryAfter).toBeGreaterThanOrEqual(6)
    expect(retryAfter).toBeLessThanOrEqual(8)

    jest.useRealTimers()
  })
})
