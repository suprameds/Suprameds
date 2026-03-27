import { normalizeAfterShipStatus } from "../aftership"

describe("normalizeAfterShipStatus()", () => {
  it("maps Pending to label_created", () => {
    expect(normalizeAfterShipStatus("Pending")).toBe("label_created")
  })

  it("maps InfoReceived to label_created", () => {
    expect(normalizeAfterShipStatus("InfoReceived")).toBe("label_created")
  })

  it("maps InTransit to in_transit", () => {
    expect(normalizeAfterShipStatus("InTransit")).toBe("in_transit")
  })

  it("maps OutForDelivery to out_for_delivery", () => {
    expect(normalizeAfterShipStatus("OutForDelivery")).toBe("out_for_delivery")
  })

  it("maps AttemptFail to delivery_attempted", () => {
    expect(normalizeAfterShipStatus("AttemptFail")).toBe("delivery_attempted")
  })

  it("maps Delivered to delivered", () => {
    expect(normalizeAfterShipStatus("Delivered")).toBe("delivered")
  })

  it("maps AvailableForPickup to delivered", () => {
    expect(normalizeAfterShipStatus("AvailableForPickup")).toBe("delivered")
  })

  it("maps Exception to ndr", () => {
    expect(normalizeAfterShipStatus("Exception")).toBe("ndr")
  })

  it("maps Expired to ndr", () => {
    expect(normalizeAfterShipStatus("Expired")).toBe("ndr")
  })

  it("defaults unknown tags to in_transit", () => {
    expect(normalizeAfterShipStatus("SomeNewTag")).toBe("in_transit")
  })

  // RTO subtag overrides
  it("maps to rto_initiated when subtag contains RTO and tag is not Delivered", () => {
    expect(normalizeAfterShipStatus("Exception", "Exception_011_RTO")).toBe("rto_initiated")
  })

  it("maps to rto_delivered when subtag contains RTO and tag is Delivered", () => {
    expect(normalizeAfterShipStatus("Delivered", "RTO_Delivered")).toBe("rto_delivered")
  })

  it("handles lowercase RTO subtag", () => {
    expect(normalizeAfterShipStatus("InTransit", "returning_rto")).toBe("rto_initiated")
  })

  it("ignores subtag without RTO", () => {
    expect(normalizeAfterShipStatus("InTransit", "delay_weather")).toBe("in_transit")
  })
})
