import { authorize, enforceSsd } from "../rbac-authorize"

// ── Helpers to build fake req / res / next ──────────────────────────

function makeReq(overrides: Record<string, any> = {}) {
  const resolvers: Record<string, any> = {
    logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
    ...overrides._resolvers,
  }
  return {
    auth_context: overrides.auth_context,
    scope: { resolve: jest.fn((key: string) => resolvers[key]) },
    ...overrides,
  } as any
}

function makeRes() {
  const res: any = {
    _status: 0,
    _body: null,
    status(code: number) {
      res._status = code
      return res
    },
    json(body: any) {
      res._body = body
      return res
    },
  }
  return res
}

// ── authorize() ─────────────────────────────────────────────────────

describe("authorize()", () => {
  it("returns 401 when no auth_context.actor_id", async () => {
    const middleware = authorize("prescription", "approve")
    const req = makeReq({ auth_context: undefined })
    const res = makeRes()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(res._status).toBe(401)
    expect(res._body.type).toBe("unauthorized")
    expect(next).not.toHaveBeenCalled()
  })

  it("returns 403 when permission denied", async () => {
    const rbacService = { checkPermission: jest.fn().mockResolvedValue(false) }
    const middleware = authorize("prescription", "approve")
    const req = makeReq({ auth_context: { actor_id: "user_1" } })
    req.scope.resolve = jest.fn(() => rbacService)
    const res = makeRes()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(rbacService.checkPermission).toHaveBeenCalledWith("user_1", "prescription", "approve")
    expect(res._status).toBe(403)
    expect(res._body.type).toBe("forbidden")
    expect(next).not.toHaveBeenCalled()
  })

  it("calls next() when permission granted", async () => {
    const rbacService = { checkPermission: jest.fn().mockResolvedValue(true) }
    const middleware = authorize("prescription", "approve")
    const req = makeReq({ auth_context: { actor_id: "user_1" } })
    req.scope.resolve = jest.fn(() => rbacService)
    const res = makeRes()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res._status).toBe(0) // no status set
  })

  it("returns 503 (fail-closed) when RBAC module throws", async () => {
    const middleware = authorize("prescription", "approve")
    const req = makeReq({ auth_context: { actor_id: "user_1" } })
    const logger = { error: jest.fn(), warn: jest.fn() }
    req.scope.resolve = jest.fn((key: string) => {
      if (key === "logger") return logger
      throw new Error("Module not found")
    })
    const res = makeRes()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(res._status).toBe(503)
    expect(res._body.type).toBe("service_unavailable")
    expect(next).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalled()
  })

  it("returns 503 when checkPermission rejects", async () => {
    const rbacService = {
      checkPermission: jest.fn().mockRejectedValue(new Error("DB down")),
    }
    const logger = { error: jest.fn(), warn: jest.fn() }
    const middleware = authorize("order", "update")
    const req = makeReq({ auth_context: { actor_id: "user_1" } })
    req.scope.resolve = jest.fn((key: string) => {
      if (key === "logger") return logger
      return rbacService
    })
    const res = makeRes()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(res._status).toBe(503)
    expect(next).not.toHaveBeenCalled()
  })
})

// ── enforceSsd() ────────────────────────────────────────────────────

describe("enforceSsd()", () => {
  it("calls next() when no authenticated user", async () => {
    const middleware = enforceSsd("SSD-01", jest.fn())
    const req = makeReq({ auth_context: undefined })
    const res = makeRes()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it("calls next() when related user cannot be resolved", async () => {
    const getRelated = jest.fn().mockRejectedValue(new Error("not found"))
    const middleware = enforceSsd("SSD-01", getRelated)
    const logger = { warn: jest.fn(), error: jest.fn() }
    const req = makeReq({ auth_context: { actor_id: "user_1" } })
    req.scope.resolve = jest.fn(() => logger)
    const res = makeRes()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it("calls next() when related user is null", async () => {
    const getRelated = jest.fn().mockResolvedValue(null)
    const middleware = enforceSsd("SSD-01", getRelated)
    const req = makeReq({ auth_context: { actor_id: "user_1" } })
    const res = makeRes()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it("calls next() when users are different (no SSD conflict)", async () => {
    const getRelated = jest.fn().mockResolvedValue("user_2")
    const middleware = enforceSsd("SSD-01", getRelated)
    const req = makeReq({ auth_context: { actor_id: "user_1" } })
    const res = makeRes()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it("returns 403 when same user and SSD validation fails", async () => {
    const getRelated = jest.fn().mockResolvedValue("user_1")
    const rbacService = {
      validateSsd: jest.fn().mockResolvedValue({
        valid: false,
        message: "Cannot approve your own prescription",
      }),
    }
    const middleware = enforceSsd("SSD-01", getRelated)
    const req = makeReq({ auth_context: { actor_id: "user_1" } })
    req.scope.resolve = jest.fn(() => rbacService)
    const res = makeRes()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(rbacService.validateSsd).toHaveBeenCalledWith("SSD-01", "user_1", "user_1")
    expect(res._status).toBe(403)
    expect(res._body.message).toBe("Cannot approve your own prescription")
    expect(next).not.toHaveBeenCalled()
  })

  it("calls next() when same user but SSD validation passes", async () => {
    const getRelated = jest.fn().mockResolvedValue("user_1")
    const rbacService = {
      validateSsd: jest.fn().mockResolvedValue({ valid: true }),
    }
    const middleware = enforceSsd("SSD-01", getRelated)
    const req = makeReq({ auth_context: { actor_id: "user_1" } })
    req.scope.resolve = jest.fn(() => rbacService)
    const res = makeRes()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it("returns 503 (fail-closed) when RBAC module throws during SSD check", async () => {
    const getRelated = jest.fn().mockResolvedValue("user_1")
    const logger = { error: jest.fn(), warn: jest.fn() }
    const middleware = enforceSsd("SSD-01", getRelated)
    const req = makeReq({ auth_context: { actor_id: "user_1" } })
    req.scope.resolve = jest.fn((key: string) => {
      if (key === "logger") return logger
      throw new Error("RBAC unavailable")
    })
    const res = makeRes()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(res._status).toBe(503)
    expect(res._body.type).toBe("service_unavailable")
    expect(next).not.toHaveBeenCalled()
  })
})
