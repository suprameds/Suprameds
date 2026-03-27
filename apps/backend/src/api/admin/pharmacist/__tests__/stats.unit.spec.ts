/**
 * Unit tests for GET /admin/pharmacist/stats
 *
 * We test the aggregation logic directly by building a minimal fake request/response
 * and stubbing the three services injected via req.scope.resolve().
 */

import { GET } from "../stats/route"

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal MedusaRequest-shaped object with a stubbed scope */
function buildReq(overrides: {
  pendingRx?: any[]
  decisionsToday?: any[]
  h1Entries?: any[]
  preDispatch?: any[]
}) {
  const pendingRx = overrides.pendingRx ?? []
  const decisionsToday = overrides.decisionsToday ?? []
  const h1Entries = overrides.h1Entries ?? []
  const preDispatch = overrides.preDispatch ?? []

  const prescriptionService = {
    listPrescriptions: jest.fn().mockResolvedValue(pendingRx),
  }

  const dispenseService = {
    listDispenseDecisions: jest.fn().mockResolvedValue(decisionsToday),
    listPreDispatchSignOffs: jest.fn().mockResolvedValue(preDispatch),
  }

  const complianceService = {
    listH1RegisterEntries: jest.fn().mockResolvedValue(h1Entries),
  }

  const moduleMap: Record<string, any> = {
    pharmaPrescription: prescriptionService,
    pharmaDispense: dispenseService,
    pharmaCompliance: complianceService,
  }

  return {
    req: {
      scope: {
        resolve: jest.fn((key: string) => moduleMap[key]),
      },
      query: {},
      body: {},
      auth_context: { actor_id: "pharmacist_01" },
    } as any,
    mocks: { prescriptionService, dispenseService, complianceService },
  }
}

/** Build a minimal MedusaResponse-shaped object that captures the json payload */
function buildRes() {
  const captured: { status?: number; body?: any } = {}
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn((payload: any) => {
      captured.body = payload
      return res
    }),
    send: jest.fn(),
    _captured: captured,
  } as any
  return res
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /admin/pharmacist/stats", () => {
  beforeEach(() => jest.clearAllMocks())

  it("returns correct counts when all services return data", async () => {
    const { req, mocks } = buildReq({
      pendingRx: [{ id: "rx_1" }, { id: "rx_2" }, { id: "rx_3" }],
      decisionsToday: [{ id: "dec_1" }, { id: "dec_2" }],
      h1Entries: [{ id: "h1_1" }],
      preDispatch: [{ id: "pd_1" }, { id: "pd_2" }, { id: "pd_3" }, { id: "pd_4" }],
    })
    const res = buildRes()

    await GET(req, res)

    expect(res.json).toHaveBeenCalledWith({
      pending_rx_count: 3,
      decisions_today: 2,
      h1_entries_today: 1,
      pre_dispatch_pending: 4,
    })

    // Verify prescriptionService was queried with pending_review status
    expect(mocks.prescriptionService.listPrescriptions).toHaveBeenCalledWith({
      status: "pending_review",
    })

    // Verify dispenseService was queried for today's decisions
    expect(mocks.dispenseService.listDispenseDecisions).toHaveBeenCalledWith(
      expect.objectContaining({
        created_at: expect.objectContaining({ gte: expect.any(String) }),
      })
    )

    // Verify compliance service was queried for today's H1 entries
    expect(mocks.complianceService.listH1RegisterEntries).toHaveBeenCalledWith(
      expect.objectContaining({
        created_at: expect.objectContaining({ gte: expect.any(String) }),
      })
    )
  })

  it("returns zero counts when all services return empty arrays", async () => {
    const { req } = buildReq({
      pendingRx: [],
      decisionsToday: [],
      h1Entries: [],
      preDispatch: [],
    })
    const res = buildRes()

    await GET(req, res)

    expect(res.json).toHaveBeenCalledWith({
      pending_rx_count: 0,
      decisions_today: 0,
      h1_entries_today: 0,
      pre_dispatch_pending: 0,
    })
  })

  it("handles the [data, count] tuple format returned by MedusaService", async () => {
    // MedusaService list methods can return [rows, count] tuple
    const { req } = buildReq({
      pendingRx: [[{ id: "rx_1" }, { id: "rx_2" }], 2] as any,
      decisionsToday: [[{ id: "dec_1" }], 1] as any,
      h1Entries: [[], 0] as any,
      preDispatch: [[{ id: "pd_1" }], 1] as any,
    })
    const res = buildRes()

    await GET(req, res)

    expect(res.json).toHaveBeenCalledWith({
      pending_rx_count: 2,
      decisions_today: 1,
      h1_entries_today: 0,
      pre_dispatch_pending: 1,
    })
  })

  it("returns 500 when a service throws", async () => {
    const req = {
      scope: {
        resolve: jest.fn(() => ({
          listPrescriptions: jest.fn().mockRejectedValue(new Error("DB down")),
          listDispenseDecisions: jest.fn().mockResolvedValue([]),
          listPreDispatchSignOffs: jest.fn().mockResolvedValue([]),
          listH1RegisterEntries: jest.fn().mockResolvedValue([]),
        })),
      },
      query: {},
      body: {},
      auth_context: null,
    } as any

    const res = buildRes()

    await GET(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) })
    )
  })

  it("today_start is the beginning of the current UTC day", async () => {
    const { req, mocks } = buildReq({})
    const res = buildRes()

    await GET(req, res)

    // Extract the gte date string passed to listDispenseDecisions
    const callArg = mocks.dispenseService.listDispenseDecisions.mock.calls[0][0]
    const gteDate = new Date(callArg.created_at.gte)

    expect(gteDate.getUTCHours()).toBe(0)
    expect(gteDate.getUTCMinutes()).toBe(0)
    expect(gteDate.getUTCSeconds()).toBe(0)
    expect(gteDate.getUTCMilliseconds()).toBe(0)
  })
})
