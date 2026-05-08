/**
 * Unit tests for the custom /store/customers/me overrides.
 *
 *   POST /store/customers/me        — main metadata patch route
 *   POST /store/customers/me/email  — dedicated email-upgrade endpoint
 *
 * We mock `req.scope.resolve(Modules.CUSTOMER)` and exercise the route
 * handlers directly — no HTTP layer needed.
 */

import { POST as updateMe } from "../me/route"
import { POST as updateEmail } from "../me/email/route"

// ── Helpers ──────────────────────────────────────────────────────────

interface FakeCustomer {
  id: string
  email?: string
  first_name?: string
  last_name?: string
  phone?: string
  metadata?: Record<string, unknown>
}

function makeReq(overrides: {
  authActorId?: string | null
  body?: Record<string, unknown>
  customerService?: any
} = {}) {
  const customerService = overrides.customerService ?? {
    retrieveCustomer: jest.fn(),
    updateCustomers: jest.fn(),
    listCustomers: jest.fn(),
  }
  const auth_context =
    overrides.authActorId === null
      ? undefined
      : { actor_id: overrides.authActorId ?? "cus_test_1" }
  return {
    auth_context,
    body: overrides.body ?? {},
    scope: { resolve: jest.fn(() => customerService) },
    _customerService: customerService,
  } as any
}

function makeRes() {
  const res: any = {
    _status: 200,
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

// ── POST /store/customers/me ─────────────────────────────────────────

describe("POST /store/customers/me — metadata override", () => {
  it("returns 401 when no auth_context.actor_id", async () => {
    const req = makeReq({ authActorId: null })
    const res = makeRes()
    await updateMe(req, res)
    expect(res._status).toBe(401)
    expect(res._body.message).toBe("Unauthorized")
  })

  it("rejects email writes with 400 pointing at /email endpoint", async () => {
    const req = makeReq({ body: { email: "new@example.com" } })
    const res = makeRes()
    await updateMe(req, res)
    expect(res._status).toBe(400)
    expect(res._body.message).toMatch(/POST \/store\/customers\/me\/email/)
    expect(req._customerService.updateCustomers).not.toHaveBeenCalled()
  })

  it("rejects metadata.kyc_status with 400", async () => {
    const req = makeReq({
      body: { metadata: { kyc_status: "approved" } },
    })
    const res = makeRes()
    await updateMe(req, res)
    expect(res._status).toBe(400)
    expect(res._body.message).toMatch(/kyc_status/)
    expect(req._customerService.updateCustomers).not.toHaveBeenCalled()
  })

  it("rejects metadata.verified_phone with 400", async () => {
    const req = makeReq({
      body: { metadata: { verified_phone: true } },
    })
    const res = makeRes()
    await updateMe(req, res)
    expect(res._status).toBe(400)
    expect(res._body.message).toMatch(/verified_phone/)
    expect(req._customerService.updateCustomers).not.toHaveBeenCalled()
  })

  it("allows metadata.dob and metadata.gender — partial merge with existing", async () => {
    const customerService = {
      retrieveCustomer: jest.fn().mockResolvedValue({
        id: "cus_test_1",
        metadata: { existing_field: "keep_me", referred_by: "REF42" },
      }),
      updateCustomers: jest.fn().mockResolvedValue({
        id: "cus_test_1",
        metadata: {
          existing_field: "keep_me",
          referred_by: "REF42",
          dob: "1990-05-12",
          gender: "M",
        },
      }),
      listCustomers: jest.fn(),
    }
    const req = makeReq({
      body: { metadata: { dob: "1990-05-12", gender: "M" } },
      customerService,
    })
    const res = makeRes()
    await updateMe(req, res)
    expect(res._status).toBe(200)
    expect(customerService.updateCustomers).toHaveBeenCalledWith({
      id: "cus_test_1",
      metadata: {
        existing_field: "keep_me",
        referred_by: "REF42",
        dob: "1990-05-12",
        gender: "M",
      },
    })
    expect(res._body.customer.metadata.dob).toBe("1990-05-12")
  })

  it("allows first_name / last_name / phone updates without metadata", async () => {
    const customerService = {
      retrieveCustomer: jest.fn(),
      updateCustomers: jest.fn().mockResolvedValue({
        id: "cus_test_1",
        first_name: "Jane",
        last_name: "Doe",
        phone: "9876543210",
      }),
      listCustomers: jest.fn(),
    }
    const req = makeReq({
      body: { first_name: "Jane", last_name: "Doe", phone: "9876543210" },
      customerService,
    })
    const res = makeRes()
    await updateMe(req, res)
    expect(res._status).toBe(200)
    // Should not have called retrieveCustomer (no metadata merge needed)
    expect(customerService.retrieveCustomer).not.toHaveBeenCalled()
    expect(customerService.updateCustomers).toHaveBeenCalledWith({
      id: "cus_test_1",
      first_name: "Jane",
      last_name: "Doe",
      phone: "9876543210",
    })
  })

  it("allows referred_by metadata write (open-list policy — referral flow)", async () => {
    const customerService = {
      retrieveCustomer: jest.fn().mockResolvedValue({
        id: "cus_test_1",
        metadata: {},
      }),
      updateCustomers: jest.fn().mockResolvedValue({
        id: "cus_test_1",
        metadata: { referred_by: "REF42" },
      }),
      listCustomers: jest.fn(),
    }
    const req = makeReq({
      body: { metadata: { referred_by: "REF42" } },
      customerService,
    })
    const res = makeRes()
    await updateMe(req, res)
    expect(res._status).toBe(200)
    expect(customerService.updateCustomers).toHaveBeenCalledWith({
      id: "cus_test_1",
      metadata: { referred_by: "REF42" },
    })
  })

  it("treats missing metadata in existing customer as empty object", async () => {
    const customerService = {
      retrieveCustomer: jest.fn().mockResolvedValue({
        id: "cus_test_1",
        // no metadata field at all
      }),
      updateCustomers: jest.fn().mockResolvedValue({
        id: "cus_test_1",
        metadata: { dob: "2000-01-01" },
      }),
      listCustomers: jest.fn(),
    }
    const req = makeReq({
      body: { metadata: { dob: "2000-01-01" } },
      customerService,
    })
    const res = makeRes()
    await updateMe(req, res)
    expect(res._status).toBe(200)
    expect(customerService.updateCustomers).toHaveBeenCalledWith({
      id: "cus_test_1",
      metadata: { dob: "2000-01-01" },
    })
  })
})

// ── POST /store/customers/me/email ──────────────────────────────────

describe("POST /store/customers/me/email — dedicated email-update endpoint", () => {
  it("returns 401 when no auth_context.actor_id", async () => {
    const req = makeReq({ authActorId: null, body: { email: "new@example.com" } })
    const res = makeRes()
    await updateEmail(req, res)
    expect(res._status).toBe(401)
  })

  it("rejects missing email", async () => {
    const req = makeReq({ body: {} })
    const res = makeRes()
    await updateEmail(req, res)
    expect(res._status).toBe(400)
    expect(res._body.message).toBe("Invalid email address")
  })

  it("rejects malformed email", async () => {
    const req = makeReq({ body: { email: "not-an-email" } })
    const res = makeRes()
    await updateEmail(req, res)
    expect(res._status).toBe(400)
    expect(res._body.message).toBe("Invalid email address")
  })

  it("rejects the @phone.suprameds.in placeholder", async () => {
    const req = makeReq({ body: { email: "919876543210@phone.suprameds.in" } })
    const res = makeRes()
    await updateEmail(req, res)
    expect(res._status).toBe(400)
    expect(res._body.message).toMatch(/real email/)
  })

  it("returns 409 when email belongs to a different customer", async () => {
    const customerService = {
      listCustomers: jest.fn().mockResolvedValue([
        { id: "cus_other", email: "taken@example.com" },
      ]),
      updateCustomers: jest.fn(),
    }
    const req = makeReq({
      body: { email: "taken@example.com" },
      customerService,
    })
    const res = makeRes()
    await updateEmail(req, res)
    expect(res._status).toBe(409)
    expect(res._body.message).toMatch(/already in use/)
    expect(customerService.updateCustomers).not.toHaveBeenCalled()
  })

  it("allows an email that's already on the same customer (idempotent)", async () => {
    const customerService = {
      listCustomers: jest.fn().mockResolvedValue([
        { id: "cus_test_1", email: "already-mine@example.com" },
      ]),
      updateCustomers: jest.fn().mockResolvedValue({
        id: "cus_test_1",
        email: "already-mine@example.com",
      }),
    }
    const req = makeReq({
      body: { email: "already-mine@example.com" },
      customerService,
    })
    const res = makeRes()
    await updateEmail(req, res)
    expect(res._status).toBe(200)
    expect(customerService.updateCustomers).toHaveBeenCalledWith({
      id: "cus_test_1",
      email: "already-mine@example.com",
    })
  })

  it("normalises email to lowercase + trims whitespace", async () => {
    const customerService = {
      listCustomers: jest.fn().mockResolvedValue([]),
      updateCustomers: jest.fn().mockResolvedValue({
        id: "cus_test_1",
        email: "user@example.com",
      }),
    }
    const req = makeReq({
      body: { email: "  USER@Example.com  " },
      customerService,
    })
    const res = makeRes()
    await updateEmail(req, res)
    expect(res._status).toBe(200)
    expect(customerService.listCustomers).toHaveBeenCalledWith({
      email: "user@example.com",
    })
    expect(customerService.updateCustomers).toHaveBeenCalledWith({
      id: "cus_test_1",
      email: "user@example.com",
    })
  })

  it("succeeds with a fresh email no other customer holds", async () => {
    const customerService = {
      listCustomers: jest.fn().mockResolvedValue([]),
      updateCustomers: jest.fn().mockResolvedValue({
        id: "cus_test_1",
        email: "fresh@example.com",
      }),
    }
    const req = makeReq({
      body: { email: "fresh@example.com" },
      customerService,
    })
    const res = makeRes()
    await updateEmail(req, res)
    expect(res._status).toBe(200)
    expect(res._body.customer.email).toBe("fresh@example.com")
  })
})
