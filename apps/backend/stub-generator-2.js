const fs = require('fs');
const path = require('path');

const basePath = 'c:/Projects/Suprameds/apps/backend/src';

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

// API Routes
const apiRoutes = [
  "store/prescriptions/upload",
  "store/prescriptions",
  "store/prescriptions/[id]",
  "store/orders/guest",
  "store/orders/cod-confirm",
  "store/otp/send",
  "store/otp/verify",
  "admin/dispense/h1-register/export",
  "admin/dispense/decisions",
  "admin/warehouse/grn",
  "admin/warehouse/pick-lists",
  "admin/compliance/phi-logs",
  "admin/compliance/override-requests",
  "admin/orders/cs-place",
  "admin/reports/sales-tax"
];

const routeTemplate = (routePath) => `import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  // TODO: Implement GET
  res.json({ message: "${routePath} GET stub" })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  // TODO: Implement POST
  res.json({ message: "${routePath} POST stub" })
}
`;

for (const route of apiRoutes) {
  ensureDir(path.join(basePath, 'api', route));
  fs.writeFileSync(path.join(basePath, 'api', route, 'route.ts'), routeTemplate(route));
}

// Admin Widgets
const widgets = [
  "prescription-upload",
  "order-rx-review",
  "pharmacist-adjustment",
  "customer-loyalty",
  "batch-selector",
  "cod-verification-status"
];

const widgetTemplate = (name) => `import { defineWidgetConfig } from "@medusajs/admin-sdk"

const ${name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Widget = () => {
  return (
    <div className="bg-white p-4 border rounded-lg shadow-sm">
      <h2 className="text-large font-semibold">${name} Widget</h2>
      <p className="text-ui-fg-subtle">Placeholder for ${name} integration.</p>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.after", // TODO: Update zone based on specific widget
})

export default ${name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Widget
`;

ensureDir(path.join(basePath, 'admin', 'widgets'));
for (const widget of widgets) {
  fs.writeFileSync(path.join(basePath, 'admin', 'widgets', widget + '.tsx'), widgetTemplate(widget));
}

// Admin Pages
const pages = [
  "dispense",
  "h1-register",
  "warehouse",
  "grn",
  "compliance",
  "overrides",
  "loyalty"
];

const pageTemplate = (name) => `import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CommandLineSolid } from "@medusajs/icons"

const ${name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Page = () => {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4 text-[var(--suprameds-navy)]">
        Suprameds ${name}
      </h1>
      <p className="text-ui-fg-subtle">
        Custom admin page for ${name} management.
      </p>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "${name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}",
  icon: CommandLineSolid, // TODO: Update icon
})

export default ${name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Page
`;

for (const page of pages) {
  ensureDir(path.join(basePath, 'admin', 'routes', page));
  fs.writeFileSync(path.join(basePath, 'admin', 'routes', page, 'page.tsx'), pageTemplate(page));
}

console.log("API routes and Admin Ext stubs generated successfully.");
