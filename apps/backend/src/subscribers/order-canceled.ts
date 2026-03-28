import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"
import { INVENTORY_BATCH_MODULE } from "../modules/inventoryBatch"

const LOG = "[subscriber:order-canceled]"

type OrderCanceledData = {
  id?: string
}

/**
 * Reverses FEFO batch deductions that were created during fulfillment.
 * Restores available_quantity on each affected batch and marks
 * "depleted" batches back to "active" when stock is returned.
 */
async function reverseBatchDeductions(
  container: any,
  orderId: string
): Promise<number> {
  const batchService = container.resolve(INVENTORY_BATCH_MODULE) as any

  let deductions: any[]
  try {
    deductions = await batchService.listBatchDeductions(
      { order_id: orderId, deduction_type: "sale" },
      { take: null }
    )
  } catch (err: any) {
    console.warn(
      `${LOG} Could not list batch deductions for order ${orderId}: ${err?.message}`
    )
    return 0
  }

  if (!deductions?.length) return 0

  let reversed = 0

  for (const deduction of deductions) {
    try {
      const batch = await batchService.retrieveBatch(deduction.batch_id)
      if (!batch) continue

      const restoredQty = Number(batch.available_quantity) + Number(deduction.quantity)
      const updatePayload: Record<string, any> = {
        id: batch.id,
        available_quantity: restoredQty,
      }
      // If batch was depleted, restore to active now that stock is back
      if (batch.status === "depleted") {
        updatePayload.status = "active"
      }
      await batchService.updateBatches(updatePayload)

      // Delete the sale deduction (it's no longer valid)
      await batchService.deleteBatchDeductions(deduction.id)

      // Audit trail
      try {
        await batchService.createBatchAuditLogs({
          batch_id: batch.id,
          action: "deduction_reversed",
          field_name: "available_quantity",
          old_value: String(batch.available_quantity),
          new_value: String(restoredQty),
          actor_id: "order-canceled",
          actor_type: "workflow",
          order_id: orderId,
          reason: `Order cancelled — reversed ${deduction.quantity} units`,
        })
      } catch {
        // Best-effort audit
      }

      reversed++
      console.info(
        `${LOG} Reversed ${deduction.quantity} units on batch ${batch.lot_number} ` +
          `(${batch.id}) for order ${orderId}`
      )
    } catch (err: any) {
      console.warn(
        `${LOG} Failed to reverse deduction ${deduction.id}: ${err?.message}`
      )
    }
  }

  return reversed
}

export default async function handler({
  event: { data },
  container,
}: SubscriberArgs<OrderCanceledData>) {
  const orderId = data?.id
  if (!orderId) {
    console.warn(`${LOG} Missing order id in event payload`)
    return
  }

  // 1. Reverse FEFO batch deductions so stock is restored
  try {
    const reversed = await reverseBatchDeductions(container, orderId)
    if (reversed > 0) {
      console.info(
        `${LOG} Reversed ${reversed} batch deduction(s) for order ${orderId}`
      )
    }
  } catch (err) {
    console.error(
      `${LOG} Batch reversal failed for order ${orderId}: ${(err as Error).message}`
    )
  }

  // 2. Send push notification to customer
  try {
    const orderService = container.resolve(Modules.ORDER) as any
    const order = await orderService.retrieveOrder(orderId, {
      relations: ["items"],
    })

    if (!order?.customer_id) {
      console.info(`${LOG} Order ${orderId} has no customer_id, skipping push`)
      return
    }

    const result = await sendPushToCustomerTopic(order.customer_id, {
      title: "Order Cancelled",
      body: `Your order #${order.display_id ?? orderId} has been cancelled. If this was unexpected, please contact us.`,
      data: {
        type: "order_cancelled",
        order_id: orderId,
        url: `/in/order/${orderId}/confirmed`,
      },
    })

    if (result.ok) {
      console.info(`${LOG} Push sent for order ${orderId}`)
    } else {
      console.warn(`${LOG} Push skipped for order ${orderId} (${result.reason})`)
    }

    // 3. Send email notification to customer
    try {
      const customerEmail = order.email ?? null
      let emailTo = customerEmail

      // If no email on order, look up customer
      if (!emailTo && order.customer_id) {
        try {
          const customerService = container.resolve(Modules.CUSTOMER) as any
          const customer = await customerService.retrieveCustomer(order.customer_id)
          emailTo = customer?.email ?? null
        } catch {
          // Fall through
        }
      }

      if (emailTo) {
        const items = order.items?.map((item: any) => ({
          title: item.title,
          quantity: item.quantity,
        })) ?? []

        // Attempt to determine cancellation reason and refund amount
        const cancellationReason =
          (order.metadata as any)?.cancellation_reason ?? "Cancelled as requested"
        const refundAmount = order.total != null
          ? `₹${order.total}`
          : null

        const notificationService = container.resolve(Modules.NOTIFICATION) as any
        await notificationService.createNotifications({
          to: emailTo,
          channel: "email",
          template: "order-canceled",
          data: {
            order_id: orderId,
            display_id: order.display_id ?? orderId,
            cancellation_reason: cancellationReason,
            refund_amount: refundAmount,
            items,
          },
        })
        console.info(`${LOG} Cancellation email sent to ${emailTo} for order ${orderId}`)
      } else {
        console.warn(`${LOG} No email found for order ${orderId} — skipping cancellation email`)
      }
    } catch (emailErr) {
      console.warn(
        `${LOG} Cancellation email failed for order ${orderId}: ${(emailErr as Error).message}`
      )
    }
  } catch (err) {
    console.error(`${LOG} Push failed for order ${orderId}: ${(err as Error).message}`)
  }
}

export const config: SubscriberConfig = { event: "order.canceled" }
