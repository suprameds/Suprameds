/**
 * Unit tests for the custom /store/customers/me overrides.
 *
 *   POST /store/customers/me        — main metadata patch route
 *   POST /store/customers/me/email  — dedicated email-upgrade endpoint
 *
 * We mock `req.scope.resolve(Modules.CUSTOMER)` and exercise the route
 * handlers directly — no HTTP layer needed.
 *
 * The metadata route delegates the actual write to `updateCustomersWorkflow`
 * from `@medusajs/core-flows`. We mock that module so the workflow's `run()`
 * resolves synchronously and we can assert it was invoked (proves the
 * `customer.updated` event path is preserved).
 */

// Mock the core-flows workflow BEFORE importing the route handler.
jest.mock("@medusajs/core-flows", () => {
  const run = jest.fn(async ({ input }: any) => ({
    result: [{ id: input.selector.id, ...input.update }],
  }))
  const workflowFactory = jest.fn(() => ({ run }))
  return {
    updateCustomersWorkflow: workflowFactory,
    __mockRun: run,
  }
})

import { POST as updateMe } from "../me/route"
import { POST as updateEmail } from "../me/email/route"
import * as coreFlows from "@medusajs/core-flows"

const mockedWorkflow = coreFlows.updateCustomersWorkflow as unknown as jest.Mock
const mockedWorkflowRun = (coreFlows as unknown as { __mockRun: jest.Mock })
  .__mockRun

// ── Helpers ──────────────────────────────────────────────────────────

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

beforeEach(() => {
  mockedWorkflow.mockClear()
  mockedWorkflowRun.mockClear()
})

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
    expect(mockedWorkflow).not.toHaveBeenCalled()
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
    expect(mockedWorkflow).not.toHaveBeenCalled()
  })

  it("rejects metadata.verified_phone with 400", async () => {
    const req = makeReq({
      body: { metadata: { verified_phone: true } },
    })
    const res = makeRes()
    await updateMe(req, res)
    expect(res._status).toBe(400)
    expect(res._body.message).toMatch(/verified_phone/)
    expect(mockedWorkflow).not.toHaveBeenCalled()
  })

  it("allows metadata.dob and metadata.gender — partial merge with existing", async () => {
    const customerService = {
      retrieveCustomer: jest
        .fn()
        // 1st call: metadata merge read (no relations)
        .mockResolvedValueOnce({
          id: "cus_test_1",
          metadata: { existing_field: "keep_me", referred_by: "REF42" },
        })
        // 2nd call: hydrated re-fetch with addresses
        .mockResolvedValueOnce({
          id: "cus_test_1",
          metadata: {
            existing_field: "keep_me",
            referred_by: "REF42",
            dob: "1990-05-12",
            gender: "M",
          },
          addresses: [],
        }),
      updateCustomers: jest.fn(),
      listCustomers: jest.fn(),
    }
    const req = makeReq({
      body: { metadata: { dob: "1990-05-12", gender: "M" } },
      customerService,
    })
    const res = makeRes()
    await updateMe(req, res)
    expect(res._status).toBe(200)
    expect(mockedWorkflowRun).toHaveBeenCalledWith({
      input: {
        selector: { id: "cus_test_1" },
        update: {
          metadata: {
            existing_field: "keep_me",
            referred_by: "REF42",
            dob: "1990-05-12",
            gender: "M",
          },
        },
      },
    })
    expect(res._body.customer.metadata.dob).toBe("1990-05-12")
    // Hydrated response includes addresses relation
    expect(res._body.customer.addresses).toEqual([])
  })

  it("allows first_name / last_name / phone updates without metadata", async () => {
    const customerService = {
      retrieveCustomer: jest.fn().mockResolvedValue({
        id: "cus_test_1",
        first_name: "Jane",
        last_name: "Doe",
        phone: "9876543210",
        addresses: [],
      }),
      updateCustomers: jest.fn(),
      listCustomers: jest.fn(),
    }
    const req = makeReq({
      body: { first_name: "Jane", last_name: "Doe", phone: "9876543210" },
      customerService,
    })
    const res = makeRes()
    await updateMe(req, res)
    expect(res._status).toBe(200)
    // retrieveCustomer should be called ONCE (only for the hydrated re-fetch
    // — no metadata merge needed).
    expect(customerService.retrieveCustomer).toHaveBeenCalledTimes(1)
    expect(customerService.retrieveCustomer).toHaveBeenCalledWith(
      "cus_test_1",
      { relations: ["addresses"] }
    )
    expect(mockedWorkflowRun).toHaveBeenCalledWith({
      input: {
        selector: { id: "cus_test_1" },
        update: {
          first_name: "Jane",
          last_name: "Doe",
          phone: "9876543210",
        },
      },
    })
  })

  it("allows referred_by metadata write (open-list policy — referral flow)", async () => {
    const customerService = {
      retrieveCustomer: jest
        .fn()
        .mockResolvedValueOnce({ id: "cus_test_1", metadata: {} })
        .mockResolvedValueOnce({
          id: "cus_test_1",
          metadata: { referred_by: "REF42" },
          addresses: [],
        }),
      updateCustomers: jest.fn(),
      listCustomers: jest.fn(),
    }
    const req = makeReq({
      body: { metadata: { referred_by: "REF42" } },
      customerService,
    })
    const res = makeRes()
    await updateMe(req, res)
    expect(res._status).toBe(200)
    expect(mockedWorkflowRun).toHaveBeenCalledWith({
      input: {
        selector: { id: "cus_test_1" },
        update: { metadata: { referred_by: "REF42" } },
      },
    })
  })

  it("treats missing metadata in existing customer as empty object", async () => {
    const customerService = {
      retrieveCustomer: jest
        .fn()
        .mockResolvedValueOnce({
          id: "cus_test_1",
          // no metadata field at all
        })
        .mockResolvedValueOnce({
          id: "cus_test_1",
          metadata: { dob: "2000-01-01" },
          addresses: [],
        }),
      updateCustomers: jest.fn(),
      listCustomers: jest.fn(),
    }
    const req = makeReq({
      body: { metadata: { dob: "2000-01-01" } },
      customerService,
    })
    const res = makeRes()
    await updateMe(req, res)
    expect(res._status).toBe(200)
    expect(mockedWorkflowRun).toHaveBeenCalledWith({
      input: {
        selector: { id: "cus_test_1" },
        update: { metadata: { dob: "2000-01-01" } },
      },
    })
  })

  it("dispatches updateCustomersWorkflow (so customer.updated event fires)", async () => {
    const customerService = {
      retrieveCustomer: jest.fn().mockResolvedValue({
        id: "cus_test_1",
        first_name: "Jane",
        addresses: [],
      }),
      updateCustomers: jest.fn(),
      listCustomers: jest.fn(),
    }
    const req = makeReq({
      body: { first_name: "Jane" },
      customerService,
    })
    const res = makeRes()
    await updateMe(req, res)
    expect(res._status).toBe(200)
    expect(mockedWorkflow).toHaveBeenCalledWith(req.scope)
    expect(mockedWorkflowRun).toHaveBeenCalledTimes(1)
  })

  it("re-fetches the customer with addresses relation after the workflow", async () => {
    const customerService = {
      retrieveCustomer: jest.fn().mockResolvedValue({
        id: "cus_test_1",
        first_name: "Jane",
        addresses: [
          { id: "addr_1", is_default_shipping: true, is_default_billing: false },
        ],
      }),
      updateCustomers: jest.fn(),
      listCustomers: jest.fn(),
    }
    const req = makeReq({
      body: { first_name: "Jane" },
      customerService,
    })
    const res = makeRes()
    await updateMe(req, res)
    expect(res._status).toBe(200)
    expect(customerService.retrieveCustomer).toHaveBeenCalledWith(
      "cus_test_1",
      { relations: ["addresses"] }
    )
    expect(res._body.customer.addresses).toHaveLength(1)
    expect(res._body.customer.addresses[0].is_default_shipping).toBe(true)
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

  it("returns 409 when a conflicting customer is at a non-zero index (find vs [0])", async () => {
    // Multi-row scenario: requesting customer is index 0, but a different
    // customer also holds the same email at index 1. The old code that
    // checked only `existing[0]` would have missed this conflict.
    const customerService = {
      listCustomers: jest.fn().mockResolvedValue([
        { id: "cus_test_1", email: "shared@example.com" },
        { id: "cus_other", email: "shared@example.com" },
      ]),
      updateCustomers: jest.fn(),
    }
    const req = makeReq({
      body: { email: "shared@example.com" },
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

  it("maps DB unique-constraint errors (23505) to 409 on the email endpoint", async () => {
    // Legacy email/password registration could have written a mixed-case
    // email that our lowercase listCustomers query misses; the DB unique
    // index still trips at write time. We catch + remap to 409.
    const dbErr: any = new Error("duplicate key value violates unique constraint")
    dbErr.code = "23505"
    const customerService = {
      listCustomers: jest.fn().mockResolvedValue([]),
      updateCustomers: jest.fn().mockRejectedValue(dbErr),
    }
    const req = makeReq({
      body: { email: "alice@gmail.com" },
      customerService,
    })
    const res = makeRes()
    await updateEmail(req, res)
    expect(res._status).toBe(409)
    expect(res._body.message).toMatch(/already in use/)
  })

  it("re-throws non-uniqueness errors from updateCustomers", async () => {
    const dbErr: any = new Error("connection refused")
    dbErr.code = "ECONNREFUSED"
    const customerService = {
      listCustomers: jest.fn().mockResolvedValue([]),
      updateCustomers: jest.fn().mockRejectedValue(dbErr),
    }
    const req = makeReq({
      body: { email: "fresh@example.com" },
      customerService,
    })
    const res = makeRes()
    await expect(updateEmail(req, res)).rejects.toThrow("connection refused")
  })
})
