import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { SHIPMENT_MODULE } from "../../modules/shipment"
import { ORDERS_MODULE } from "../../modules/orders"

type CreateShipmentInput = {
  order_id: string
  awb_number: string
  carrier?: string
  pharmacist_id: string
}

/**
 * Validate order is ready for shipment (pre-dispatch approved).
 */
const validateOrderStep = createStep(
  "create-shipment-validate-order",
  async (input: { order_id: string }, { container }) => {
    const pharmaOrderService = container.resolve(ORDERS_MODULE) as any

    const [ext] = await pharmaOrderService.listOrderExtensions(
      { order_id: input.order_id },
      { take: 1 }
    )

    if (!ext) {
      throw new Error(`No order extension found for ${input.order_id}`)
    }

    if (ext.status !== "ready_for_dispatch" && ext.status !== "payment_captured") {
      throw new Error(
        `Order ${input.order_id} is in status "${ext.status}" — must be ready_for_dispatch`
      )
    }

    return new StepResponse(ext)
  }
)

/**
 * Create shipment record with AWB number and carrier.
 */
const createShipmentRecordStep = createStep(
  "create-shipment-record",
  async (
    input: {
      order_id: string
      awb_number: string
      carrier: string
      pharmacist_id: string
    },
    { container }
  ) => {
    const shipmentService = container.resolve(SHIPMENT_MODULE) as any
    const orderService = container.resolve(Modules.ORDER) as any

    const order = await orderService.retrieveOrder(input.order_id, {
      relations: ["items", "shipping_address"],
    })

    const shipment = await shipmentService.createShipments({
      order_id: input.order_id,
      awb_number: input.awb_number,
      carrier: input.carrier,
      status: "booked",
      booked_by: input.pharmacist_id,
      booked_at: new Date(),
      origin_pincode: process.env.WAREHOUSE_PINCODE || "500001",
      destination_pincode: order.shipping_address?.postal_code || "",
      destination_city: order.shipping_address?.city || "",
      destination_state: order.shipping_address?.province || "",
    })

    return new StepResponse(shipment, shipment.id)
  },
  async (shipmentId, { container }) => {
    if (!shipmentId) return
    const shipmentService = container.resolve(SHIPMENT_MODULE) as any
    try {
      await shipmentService.deleteShipments(shipmentId)
    } catch {
      // best-effort compensation
    }
  }
)

/**
 * Update order extension status to dispatched.
 */
const updateOrderStatusStep = createStep(
  "create-shipment-update-order-status",
  async (
    input: { order_id: string; pharmacist_id: string; awb_number: string },
    { container }
  ) => {
    const pharmaOrderService = container.resolve(ORDERS_MODULE) as any

    const [ext] = await pharmaOrderService.listOrderExtensions(
      { order_id: input.order_id },
      { take: 1 }
    )

    if (!ext) return new StepResponse(null)

    const prevStatus = ext.status
    await pharmaOrderService.updateOrderExtensions(ext.id, {
      status: "dispatched",
    })

    await pharmaOrderService.createOrderStateHistorys({
      order_id: input.order_id,
      from_status: prevStatus,
      to_status: "dispatched",
      changed_by: input.pharmacist_id,
      reason: `Shipped via AWB ${input.awb_number}`,
    })

    return new StepResponse({ prev: prevStatus, new: "dispatched" })
  }
)

/**
 * Emit order.dispatched event for push notifications.
 */
const emitDispatchEventStep = createStep(
  "create-shipment-emit-event",
  async (input: { order_id: string }, { container }) => {
    const eventBus = container.resolve(Modules.EVENT_BUS) as any
    await eventBus.emit({
      name: "order.dispatched",
      data: { order_id: input.order_id },
    })
    return new StepResponse(null)
  }
)

/**
 * CreateShipmentWorkflow — books a shipment with AWB, updates order
 * status, and notifies the customer.
 */
export const CreateShipmentWorkflow = createWorkflow(
  "suprameds-create-shipment-workflow",
  (input: CreateShipmentInput) => {
    validateOrderStep({ order_id: input.order_id })

    const shipment = createShipmentRecordStep({
      order_id: input.order_id,
      awb_number: input.awb_number,
      carrier: input.carrier || "India Post Speed Post",
      pharmacist_id: input.pharmacist_id,
    }) as any

    updateOrderStatusStep({
      order_id: input.order_id,
      pharmacist_id: input.pharmacist_id,
      awb_number: input.awb_number,
    })

    emitDispatchEventStep({ order_id: input.order_id })

    return new WorkflowResponse({
      shipment,
      dispatched: true,
    })
  }
)
