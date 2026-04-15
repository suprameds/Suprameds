/**
 * Patch: @medusajs/core-flows create-shipment.js
 *
 * Fixes "Cannot read properties of undefined (reading 'required_quantity')"
 * when creating a shipment for order items with manage_inventory=false.
 *
 * Root cause: prepareRegisterShipmentData() assumes inventory_item_id is
 * always set on fulfillment items, but it's null when manage_inventory=false.
 * The iitems.find() returns undefined, then .required_quantity crashes.
 *
 * Fix: add a null guard — if iitem is not found, skip the quantity division
 * and use the fulfillment item quantity as-is.
 */

import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { execSync } from "child_process"

const MARKER = "/* patched:shipment-null-guard */"

try {
  // Find the file since package.json exports don't allow direct require.resolve
  const candidates = [
    resolve("node_modules/@medusajs/core-flows/dist/order/workflows/create-shipment.js"),
    // pnpm hoisted path
    ...(() => {
      try {
        const out = execSync('find node_modules -path "*/core-flows/dist/order/workflows/create-shipment.js" -type f 2>/dev/null', { encoding: 'utf8', timeout: 5000 })
        return out.trim().split('\n').filter(Boolean)
      } catch { return [] }
    })()
  ]

  const modPath = candidates.find(p => existsSync(p))
  if (!modPath) {
    console.log("[patch-shipment] File not found — skipping (may be in pruned deps)")
    process.exit(0)
  }

  console.log("[patch-shipment] Found:", modPath)

  let src = readFileSync(modPath, "utf8")

  if (src.includes(MARKER)) {
    console.log("[patch-shipment] Already patched, skipping")
    process.exit(0)
  }

  // The buggy code:
  //   const iitem = iitems.find((i) => i.inventory.id === fitem.inventory_item_id);
  //   quantity = utils_1.MathBN.div(quantity, iitem.required_quantity);
  //
  // Replace with null-safe version:
  const buggy = `const iitem = iitems.find((i) => i.inventory.id === fitem.inventory_item_id);
                quantity = utils_1.MathBN.div(quantity, iitem.required_quantity);`

  const fixed = `${MARKER}
                const iitem = fitem.inventory_item_id ? iitems.find((i) => i.inventory.id === fitem.inventory_item_id) : null;
                if (iitem) { quantity = utils_1.MathBN.div(quantity, iitem.required_quantity); }`

  if (!src.includes("iitem.required_quantity")) {
    // Try alternate whitespace patterns
    const buggyAlt = src.match(
      /const iitem = iitems\.find\(\(i\) => i\.inventory\.id === fitem\.inventory_item_id\);\s*quantity = utils_1\.MathBN\.div\(quantity, iitem\.required_quantity\);/
    )
    if (buggyAlt) {
      src = src.replace(
        buggyAlt[0],
        `${MARKER}\n                const iitem = fitem.inventory_item_id ? iitems.find((i) => i.inventory.id === fitem.inventory_item_id) : null;\n                if (iitem) { quantity = utils_1.MathBN.div(quantity, iitem.required_quantity); }`
      )
      writeFileSync(modPath, src)
      console.log("[patch-shipment] Patched (regex match)")
      process.exit(0)
    }

    console.log("[patch-shipment] Could not find buggy pattern — manual check needed")
    process.exit(0)
  }

  src = src.replace(buggy, fixed)
  writeFileSync(modPath, src)
  console.log("[patch-shipment] Patched — null guard added for inventory_item_id")
} catch (err) {
  console.error("[patch-shipment] Error:", err.message)
  process.exit(1)
}
