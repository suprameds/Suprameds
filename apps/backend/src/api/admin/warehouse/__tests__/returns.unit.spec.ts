/**
 * Unit tests for GET + POST /admin/warehouse/returns
 *
 * The InspectReturnWorkflow is mocked so we test only the route handler
 * logic: validation, request mapping, and response shape.
 */

import { GET, POST } from "../returns/route"
import { MedusaError } from "@medusajs/framework/utils"

// ── Mock the workflow module ──────────────────────────────────────────────────

const mockWorkflowRun = jest.fn()

jest.mock("../../../../workflows/warehouse/inspect-return", () => ({
  InspectReturnWorkflow: jest.fn(() => ({
    run: mockWorkflowRun,
  })),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildReq(overrides: {
  body?: Record<string, any>
  query?: Record<string, string>
  inspections?: any[]
  actorId?: string
}) {
  const inspections = overrides.inspections ?? []

  const warehouseService = {
    listReturnsInspections: jest.fn().mockResolvedValue(inspections),
  }

  return {
    req: {
      scope: {
        resolve: jest.fn(() => warehouseService),
      },
      query: overrides.query ?? {},
      body: overrides.body ?? {},
      auth_context: { actor_id: overrides.actorId ?? "warehouse_user_01" },
    } as any,
    warehouseService,
  }
}

function buildRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  } as any
  return res
}

// ── GET tests ─────────────────────────────────────────────────────────────────

describe("GET /admin/warehouse/returns", () => {
  beforeEach(() => jest.clearAllMocks())

  it("returns pending inspections from warehouse service", async () => {
    const pendingItems = [{ id: "ri_1", status: "pending" }, { id: "ri_2", status: "pending" }]
    const { req, warehouseService } = buildReq({ inspections: pendingItems })
    const res = buildRes()

    await GET(req, res)

    expect(warehouseService.listReturnsInspections).toHaveBeenCalledWith(
      { status: "pending" },
      expect.objectContaining({ take: 20, skip: 0 })
    )

    expect(res.json).toHaveBeenCalledWith({
      data: pendingItems,
      count: 2,
      limit: 20,
      offset: 0,
    })
  })

  it("returns empty data when no pending returns exist", async () => {
    const { req } = buildReq({ inspections: [] })
    const res = buildRes()

    await GET(req, res)

    expect(res.json).toHaveBeenCalledWith({
      data: [],
      count: 0,
      limit: 20,
      offset: 0,
    })
  })

  it("respects limit and offset query params", async () => {
    const { req, warehouseService } = buildReq({
      inspections: [],
      query: { limit: "5", offset: "10" },
    })
    const res = buildRes()

    await GET(req, res)

    expect(warehouseService.listReturnsInspections).toHaveBeenCalledWith(
      { status: "pending" },
      expect.objectContaining({ take: 5, skip: 10 })
    )
  })

  it("handles MedusaService [rows, count] tuple format", async () => {
    const { req } = buildReq({
      inspections: [[{ id: "ri_1" }, { id: "ri_2" }, { id: "ri_3" }], 3] as any,
    })
    const res = buildRes()

    await GET(req, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ count: 3 })
    )
  })

  it("returns 500 when warehouse service throws", async () => {
    const req = {
      scope: {
        resolve: jest.fn(() => ({
          listReturnsInspections: jest.fn().mockRejectedValue(new Error("DB error")),
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
})

// ── POST tests ────────────────────────────────────────────────────────────────

describe("POST /admin/warehouse/returns", () => {
  const validBody = {
    return_id: "ret_01",
    order_id: "order_01",
    inspection_lines: [
      { item_id: "item_01", condition: "sealed", accept: true },
      { item_id: "item_02", condition: "damaged", accept: true },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockWorkflowRun.mockResolvedValue({
      result: {
        return_id: "ret_01",
        inspection_result: "approved",
        accepted_count: 2,
        rejected_count: 0,
        refund_id: null,
        refund_amount: 0,
        items: [],
      },
      errors: [],
    })
  })

  it("calls InspectReturnWorkflow with mapped input and returns 201", async () => {
    const { req } = buildReq({ body: validBody })
    const res = buildRes()

    await POST(req, res)

    expect(mockWorkflowRun).toHaveBeenCalledWith({
      input: expect.objectContaining({
        return_id: "ret_01",
        order_id: "order_01",
        inspector_id: "warehouse_user_01",
        inspection_result: "approved",
        items: expect.arrayContaining([
          expect.objectContaining({ line_item_id: "item_01", condition: "sealed", accepted: true }),
          expect.objectContaining({ line_item_id: "item_02", condition: "damaged", accepted: true }),
        ]),
      }),
    })

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ inspection: expect.any(Object) })
    )
  })

  it("sets inspection_result to 'rejected' when all lines are not accepted", async () => {
    mockWorkflowRun.mockResolvedValue({
      result: { inspection_result: "rejected" },
      errors: [],
    })

    const { req } = buildReq({
      body: {
        ...validBody,
        inspection_lines: [
          { item_id: "item_01", condition: "sealed", accept: false },
          { item_id: "item_02", condition: "damaged", accept: false },
        ],
      },
    })
    const res = buildRes()

    await POST(req, res)

    expect(mockWorkflowRun).toHaveBeenCalledWith({
      input: expect.objectContaining({ inspection_result: "rejected" }),
    })
  })

  it("sets inspection_result to 'partial' when some lines are accepted", async () => {
    mockWorkflowRun.mockResolvedValue({
      result: { inspection_result: "partial" },
      errors: [],
    })

    const { req } = buildReq({
      body: {
        ...validBody,
        inspection_lines: [
          { item_id: "item_01", condition: "sealed", accept: true },
          { item_id: "item_02", condition: "damaged", accept: false },
        ],
      },
    })
    const res = buildRes()

    await POST(req, res)

    expect(mockWorkflowRun).toHaveBeenCalledWith({
      input: expect.objectContaining({ inspection_result: "partial" }),
    })
  })

  it("throws MedusaError when return_id is missing", async () => {
    const { req } = buildReq({
      body: { ...validBody, return_id: undefined },
    })
    const res = buildRes()

    await expect(POST(req, res)).rejects.toThrow(MedusaError)
    await expect(POST(req, res)).rejects.toThrow("return_id is required")
  })

  it("throws MedusaError when order_id is missing", async () => {
    const { req } = buildReq({
      body: { ...validBody, order_id: undefined },
    })
    const res = buildRes()

    await expect(POST(req, res)).rejects.toThrow(MedusaError)
  })

  it("throws MedusaError when inspection_lines is empty", async () => {
    const { req } = buildReq({
      body: { ...validBody, inspection_lines: [] },
    })
    const res = buildRes()

    await expect(POST(req, res)).rejects.toThrow(MedusaError)
  })

  it("throws MedusaError for invalid condition value", async () => {
    const { req } = buildReq({
      body: {
        ...validBody,
        inspection_lines: [{ item_id: "item_01", condition: "opened", accept: true }],
      },
    })
    const res = buildRes()

    await expect(POST(req, res)).rejects.toThrow(MedusaError)
  })

  it("throws MedusaError when accept field is missing", async () => {
    const { req } = buildReq({
      body: {
        ...validBody,
        inspection_lines: [{ item_id: "item_01", condition: "sealed" }],
      },
    })
    const res = buildRes()

    await expect(POST(req, res)).rejects.toThrow(MedusaError)
  })

  it("returns 400 when workflow reports errors", async () => {
    mockWorkflowRun.mockResolvedValue({
      result: null,
      errors: [{ error: { message: "Return not found" } }],
    })

    const { req } = buildReq({ body: validBody })
    const res = buildRes()

    await expect(POST(req, res)).rejects.toThrow("Return not found")
  })
})
