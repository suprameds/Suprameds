/**
 * Tests for the sync-aftership-status job.
 *
 * We test the job function directly by mocking:
 * - container.resolve() for logger, shipmentService, eventBus
 * - getTrackingStatus() from the aftership lib
 */

// Mock the aftership lib before importing
jest.mock("../../lib/aftership", () => ({
  getTrackingStatus: jest.fn(),
  normalizeAfterShipStatus: jest.requireActual("../../lib/aftership").normalizeAfterShipStatus,
}))

import SyncAftershipStatusJob from "../sync-aftership-status"
import { getTrackingStatus } from "../../lib/aftership"

const mockGetTrackingStatus = getTrackingStatus as jest.MockedFunction<typeof getTrackingStatus>

function makeContainer(shipments: any[] = []) {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const shipmentService = {
    listShipments: jest.fn().mockResolvedValue(shipments),
    updateShipments: jest.fn().mockResolvedValue(undefined),
  }
  const eventBus = { emit: jest.fn().mockResolvedValue(undefined) }

  return {
    resolve: jest.fn((key: string) => {
      if (key === "logger") return logger
      // Modules.EVENT_BUS = "event_bus"
      if (key === "event_bus") return eventBus
      // SHIPMENT_MODULE = "pharmaShipment"
      if (key === "pharmaShipment") return shipmentService
      return shipmentService
    }),
    logger,
    shipmentService,
    eventBus,
  }
}

describe("SyncAftershipStatusJob", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("skips shipments without awb_number", async () => {
    const container = makeContainer([
      { id: "ship_1", awb_number: null, status: "label_created" },
    ])

    await SyncAftershipStatusJob(container as any)

    expect(mockGetTrackingStatus).not.toHaveBeenCalled()
    expect(container.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("0 shipments")
    )
  })

  it("skips shipments with terminal status (delivered)", async () => {
    const container = makeContainer([
      { id: "ship_1", awb_number: "AWB001", status: "delivered" },
    ])

    await SyncAftershipStatusJob(container as any)

    expect(mockGetTrackingStatus).not.toHaveBeenCalled()
  })

  it("skips shipments with terminal status (rto_delivered)", async () => {
    const container = makeContainer([
      { id: "ship_1", awb_number: "AWB001", status: "rto_delivered" },
    ])

    await SyncAftershipStatusJob(container as any)

    expect(mockGetTrackingStatus).not.toHaveBeenCalled()
  })

  it("updates shipment when status changes", async () => {
    const container = makeContainer([
      { id: "ship_1", awb_number: "AWB001", status: "in_transit", carrier: "bluedart" },
    ])

    mockGetTrackingStatus.mockResolvedValue({
      tag: "OutForDelivery" as any,
      checkpoints: [
        { tag: "OutForDelivery", message: "Out for delivery", location: "Hyderabad", checkpoint_time: "2026-03-27T10:00:00Z" },
      ],
    })

    await SyncAftershipStatusJob(container as any)

    expect(mockGetTrackingStatus).toHaveBeenCalledWith("bluedart", "AWB001")
    expect(container.shipmentService.updateShipments).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ship_1",
        status: "out_for_delivery",
        last_location: "Hyderabad",
      })
    )
  })

  it("does not update when status has not changed", async () => {
    const container = makeContainer([
      { id: "ship_1", awb_number: "AWB001", status: "in_transit", carrier: "india-post" },
    ])

    mockGetTrackingStatus.mockResolvedValue({
      tag: "InTransit" as any,
      checkpoints: [],
    })

    await SyncAftershipStatusJob(container as any)

    expect(container.shipmentService.updateShipments).not.toHaveBeenCalled()
  })

  it("emits order.delivered event when shipment is delivered", async () => {
    const container = makeContainer([
      { id: "ship_1", awb_number: "AWB001", status: "in_transit", order_id: "order_1" },
    ])

    mockGetTrackingStatus.mockResolvedValue({
      tag: "Delivered" as any,
      signed_by: "John",
      checkpoints: [],
    })

    await SyncAftershipStatusJob(container as any)

    expect(container.eventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "order.delivered",
        data: { id: "order_1" },
      })
    )
  })

  it("emits shipment.ndr_reported event on NDR", async () => {
    const container = makeContainer([
      { id: "ship_1", awb_number: "AWB001", status: "in_transit", order_id: "order_1" },
    ])

    mockGetTrackingStatus.mockResolvedValue({
      tag: "Exception" as any,
      subtag: "address_issue",
      checkpoints: [],
    })

    await SyncAftershipStatusJob(container as any)

    expect(container.eventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "shipment.ndr_reported",
      })
    )
  })

  it("continues processing other shipments when one fails", async () => {
    const container = makeContainer([
      { id: "ship_1", awb_number: "AWB001", status: "in_transit" },
      { id: "ship_2", awb_number: "AWB002", status: "in_transit" },
    ])

    // First shipment fails, second succeeds
    mockGetTrackingStatus
      .mockRejectedValueOnce(new Error("API timeout"))
      .mockResolvedValueOnce({
        tag: "Delivered" as any,
        checkpoints: [],
      })

    await SyncAftershipStatusJob(container as any)

    // Should have attempted both
    expect(mockGetTrackingStatus).toHaveBeenCalledTimes(2)
    // Should have updated the second shipment
    expect(container.shipmentService.updateShipments).toHaveBeenCalledTimes(1)
    // Should have logged the error for the first
    expect(container.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("ship_1")
    )
    // Summary should show errors
    expect(container.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("errors")
    )
  })

  it("handles null response from getTrackingStatus gracefully", async () => {
    const container = makeContainer([
      { id: "ship_1", awb_number: "AWB001", status: "in_transit" },
    ])

    mockGetTrackingStatus.mockResolvedValue(null)

    await SyncAftershipStatusJob(container as any)

    expect(container.shipmentService.updateShipments).not.toHaveBeenCalled()
  })

  it("defaults carrier to india-post when not specified", async () => {
    const container = makeContainer([
      { id: "ship_1", awb_number: "AWB001", status: "label_created", carrier: null },
    ])

    mockGetTrackingStatus.mockResolvedValue(null)

    await SyncAftershipStatusJob(container as any)

    expect(mockGetTrackingStatus).toHaveBeenCalledWith("india-post", "AWB001")
  })
})
