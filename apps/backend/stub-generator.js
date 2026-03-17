const fs = require('fs');
const path = require('path');

const basePath = 'c:/Projects/Suprameds/apps/backend/src';

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

// Subscribers
const subscribers = {
  "order-placed": "order.placed",
  "order-updated": "order.updated",
  "order-canceled": "order.canceled",
  "order-payment-captured": "order.payment_captured",
  "payment-failed": "payment.payment_failed",
  "order-dispatched": "order.dispatched",
  "order-delivered": "order.delivered",
  "order-return-requested": "order.return_requested",
  "return-received": "return.received",
  "customer-created": "customer.created",
  "customer-password-reset": "customer.password_reset",
  "dispense-decision-made": "dispense.decision_made",
  "h1-register-updated": "h1.register_updated",
  "warehouse-grn-approved": "warehouse.grn_approved",
  "inventory-low-stock": "inventory.low_stock",
  "shipment-ndr-reported": "shipment.ndr_reported",
  "shipment-rto-initiated": "shipment.rto_initiated",
  "loyalty-points-earned": "loyalty.points_earned",
  "loyalty-points-redeemed": "loyalty.points_redeemed",
  "cod-unconfirmed-timeout": "cod.unconfirmed_timeout"
};

const subscriberTemplate = (eventName) => `import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

export default async function handler({ event }: SubscriberArgs<Record<string, unknown>>) {
  console.info("[subscriber] ${eventName}", event.data)
  // TODO: Implement subscriber logic
}

export const config: SubscriberConfig = { event: "${eventName}" }
`;

ensureDir(path.join(basePath, 'subscribers'));
for (const [file, event] of Object.entries(subscribers)) {
  fs.writeFileSync(path.join(basePath, 'subscribers', file + '.ts'), subscriberTemplate(event));
}

// Jobs
const jobs = {
  "sync-aftership-status": { name: "sync-aftership", schedule: "*/30 * * * *" },
  "cancel-unconfirmed-cod": { name: "cancel-cod", schedule: "*/15 * * * *" },
  "release-expired-guest-sessions": { name: "release-guest-sessions", schedule: "0 2 * * *" },
  "purge-expired-prescriptions": { name: "purge-prescriptions", schedule: "0 1 * * *" },
  "auto-allocate-fefo": { name: "auto-allocate-fefo", schedule: "*/5 * * * *" },
  "generate-h1-report": { name: "generate-h1", schedule: "0 0 * * *" },
  "identify-chronic-reorders": { name: "identify-reorders", schedule: "0 3 * * *" },
  "expire-loyalty-points": { name: "expire-loyalty", schedule: "0 4 * * *" },
  "sync-inventory-to-storefront": { name: "sync-inventory", schedule: "*/5 * * * *" },
  "flag-near-expiry-batches": { name: "flag-expiry", schedule: "0 5 * * 1" },
  "remind-abandoned-carts": { name: "remind-carts", schedule: "0 * * * *" },
  "generate-sales-tax-report": { name: "sales-tax", schedule: "0 6 1 * *" },
  "update-delivery-days": { name: "update-delivery-days", schedule: "0 2 * * 0" },
  "clear-phi-audit-logs": { name: "clear-phi-logs", schedule: "0 0 1 1 *" },
  "send-chronic-refill-reminders": { name: "chronic-reminders", schedule: "0 9 * * *" },
  "verify-dlt-templates": { name: "verify-dlt", schedule: "0 8 * * *" }
};

const jobTemplate = (jobInfo, fileName) => {
  const funcName = fileName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  return `import { MedusaContainer } from "@medusajs/framework/types"

export default async function ${funcName}Job(container: MedusaContainer) {
  const logger = container.resolve("logger")
  logger.info("[job] Executing ${jobInfo.name}")
  // TODO: Implement job logic
}

export const config = {
  name: "${jobInfo.name}",
  schedule: "${jobInfo.schedule}",
}
`;
};

ensureDir(path.join(basePath, 'jobs'));
for (const [file, info] of Object.entries(jobs)) {
  fs.writeFileSync(path.join(basePath, 'jobs', file + '.ts'), jobTemplate(info, file));
}

// Workflows
const workflowsList = [
  { file: "checkout/complete-cart", id: "complete-cart-workflow" },
  { file: "prescription/upload-rx", id: "upload-rx-workflow" },
  { file: "prescription/review-rx", id: "review-rx-workflow" },
  { file: "dispense/pharmacist-decision", id: "pharmacist-decision-workflow" },
  { file: "dispense/pre-dispatch-check", id: "pre-dispatch-check-workflow" },
  { file: "order/confirm-cod", id: "confirm-cod-workflow" },
  { file: "fulfillment/fefo-allocation", id: "fefo-allocation-workflow" },
  { file: "fulfillment/create-shipment", id: "create-shipment-workflow" },
  { file: "warehouse/approve-grn", id: "approve-grn-workflow" },
  { file: "warehouse/inspect-return", id: "inspect-return-workflow" },
  { file: "loyalty/award-points", id: "award-points-workflow" },
  { file: "customer/merge-guest-cart", id: "merge-guest-cart-workflow" },
  { file: "compliance/request-override", id: "request-override-workflow" }
];

const workflowTemplate = (id) => {
  const name = id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('').replace('Workflow', '');
  return `import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

export const ${name}Workflow = createWorkflow(
  "${id}",
  (input: any) => {
    // TODO: Implement workflow steps
    return new WorkflowResponse({ success: true, input })
  }
)
`;
};

for (const wf of workflowsList) {
  const dir = path.dirname(wf.file);
  ensureDir(path.join(basePath, 'workflows', dir));
  fs.writeFileSync(path.join(basePath, 'workflows', wf.file + '.ts'), workflowTemplate(wf.id));
}

console.log("Stubs generated successfully.");
