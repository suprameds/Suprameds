import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { sendPushToCustomerTopic } from "../lib/firebase-messaging"
import { INVENTORY_BATCH_MODULE } from "../modules/inventoryBatch"
import { LOYALTY_MODULE } from "../modules/loyalty"
import { WALLET_MODULE } from "../modules/wallet"
import { captureException } from "../lib/sentry"
import { createLogger } from "../lib/logger"

const logger = createLogger("subscriber:order-canceled")

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
    logger.warn(
      `Could not list batch deductions for order ${orderId}: ${err?.message}`
    )
    captureException(err, { subscriber: "order-canceled", orderId, step: "list-deductions" })
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
      logger.info(
        `Reversed ${deduction.quantity} units on batch ${batch.lot_number} ` +
          `(${batch.id}) for order ${orderId}`
      )
    } catch (err: any) {
      logger.warn(
        `Failed to reverse deduction ${deduction.id}: ${err?.message}`
      )
      captureException(err, { subscriber: "order-canceled", orderId, deductionId: deduction.id, step: "reverse-deduction" })
    }
  }

  return reversed
}

export default async function orderCanceledHandler({
  event: { data },
  container,
}: SubscriberArgs<OrderCanceledData>) {
  const orderId = data?.id
  if (!orderId) {
    logger.warn(`Missing order id in event payload`)
    return
  }

  // 1. Reverse FEFO batch deductions so stock is restored
  try {
    const reversed = await reverseBatchDeductions(container, orderId)
    if (reversed > 0) {
      logger.info(
        `Reversed ${reversed} batch deduction(s) for order ${orderId}`
      )
    }
  } catch (err) {
    logger.error(
      `Batch reversal failed for order ${orderId}: ${(err as Error).message}`
    )
    captureException(err, { subscriber: "order-canceled", orderId, step: "batch-reversal" })
  }

  // 2. Reverse loyalty points earned from this order
  try {
    const loyaltyService = container.resolve(LOYALTY_MODULE) as any

    // Find earn transactions linked to this order
    const earnTxns = await loyaltyService.listLoyaltyTransactions(
      { reference_type: "order", reference_id: orderId, type: "earn" },
      { take: null }
    )

    if (earnTxns?.length) {
      for (const txn of earnTxns) {
        const pointsToReverse = Math.abs(txn.points)
        if (pointsToReverse <= 0) continue

        const [account] = await loyaltyService.listLoyaltyAccounts(
          { id: txn.account_id },
          { take: 1 }
        )
        if (!account) continue

        // Create a burn transaction to reverse the earned points
        await loyaltyService.createLoyaltyTransactions({
          account_id: account.id,
          type: "burn",
          points: -pointsToReverse,
          reference_type: "order",
          reference_id: orderId,
          reason: `Reversed: order ${orderId} cancelled`,
        })

        const newBalance = Math.max(0, account.points_balance - pointsToReverse)
        await loyaltyService.updateLoyaltyAccounts({
          id: account.id,
          points_balance: newBalance,
        })

        logger.info(
          `Reversed ${pointsToReverse} loyalty points for order ${orderId} ` +
            `(account ${account.id}, new balance: ${newBalance})`
        )
      }
    }
  } catch (err) {
    logger.warn(
      `Loyalty reversal failed for order ${orderId}: ${(err as Error).message}`
    )
    captureException(err, { subscriber: "order-canceled", orderId, step: "loyalty-reversal" })
  }

  // 3. Auto-refund prepaid (Paytm/Razorpay) payments on cancellation
  //    (renumbered from step 2 after adding loyalty reversal)
  try {
    const orderService = container.resolve(Modules.ORDER) as any
    const paymentModule = container.resolve(Modules.PAYMENT) as any

    const order = await orderService.retrieveOrder(orderId, {
      relations: ["payment_collections", "payment_collections.payments"],
    })

    const payments = order.payment_collections
      ?.flatMap((pc: any) => pc.payments ?? [])
      ?.filter((p: any) => p.captured_at && !p.canceled_at) ?? []

    for (const payment of payments) {
      try {
        await paymentModule.refundPayment({
          payment_id: payment.id,
          amount: payment.amount,
        })
        logger.info(
          `Auto-refunded ₹${payment.amount} for payment ${payment.id} on cancelled order ${orderId}`
        )
      } catch (refundErr: any) {
        logger.warn(
          `Auto-refund failed for payment ${payment.id}: ${refundErr?.message}. Manual refund required.`
        )
        captureException(refundErr, { subscriber: "order-canceled", orderId, paymentId: payment.id, step: "auto-refund" })
      }
    }
  } catch (refundErr) {
    logger.warn(
      `Payment refund check failed for order ${orderId}: ${(refundErr as Error).message}`
    )
    captureException(refundErr, { subscriber: "order-canceled", orderId, step: "auto-refund-check" })
  }

  // 4. Credit wallet with COD order amount (or any non-refundable-to-gateway amount)
  try {
    const orderService = container.resolve(Modules.ORDER) as any
    const order = await orderService.retrieveOrder(orderId, {
      relations: ["payment_collections", "payment_collections.payments"],
    })

    if (order?.customer_id && order.total > 0) {
      // Check if this was a prepaid order that was already gateway-refunded
      const capturedPayments = order.payment_collections
        ?.flatMap((pc: any) => pc.payments ?? [])
        ?.filter((p: any) => p.captured_at && !p.canceled_at) ?? []
      const isGatewayRefunded = capturedPayments.length > 0

      // For COD orders or orders where gateway refund failed, credit wallet
      if (!isGatewayRefunded) {
        const walletService = container.resolve(WALLET_MODULE) as any
        const result = await walletService.creditWallet(
          order.customer_id,
          order.total,
          "cancellation",
          orderId,
          `Refund for cancelled order #${order.display_id ?? orderId}`
        )
        logger.info(
          `Credited ₹${order.total} to wallet for cancelled order ${orderId} ` +
            `(new balance: ₹${result.new_balance})`
        )
      }
    }
  } catch (err) {
    logger.warn(
      `Wallet credit failed for cancelled order ${orderId}: ${(err as Error).message}`
    )
    captureException(err, { subscriber: "order-canceled", orderId, step: "wallet-credit" })
  }

  // 5. Send push notification to customer
  try {
    const orderService = container.resolve(Modules.ORDER) as any
    const order = await orderService.retrieveOrder(orderId, {
      relations: ["items"],
    })

    if (!order?.customer_id) {
      logger.info(`Order ${orderId} has no customer_id, skipping push`)
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
      logger.info(`Push sent for order ${orderId}`)
    } else {
      logger.warn(`Push skipped for order ${orderId} (${result.reason})`)
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
        logger.info(`Cancellation email sent to ${emailTo} for order ${orderId}`)
      } else {
        logger.warn(`No email found for order ${orderId} — skipping cancellation email`)
      }
    } catch (emailErr) {
      logger.warn(
        `Cancellation email failed for order ${orderId}: ${(emailErr as Error).message}`
      )
      captureException(emailErr, { subscriber: "order-canceled", orderId, step: "send-email" })
    }
  } catch (err) {
    logger.error(`Push failed for order ${orderId}: ${(err as Error).message}`)
    captureException(err, { subscriber: "order-canceled", orderId })
  }
}

export const config: SubscriberConfig = { event: "order.canceled" }
