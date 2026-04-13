/**
 * Patches @medusajs/promotion@2.13.4 bug where raw() SQL for empty-context
 * promotion prefiltering generates malformed dot-notation that PostgreSQL rejects:
 *   "improper qualified name (too many dotted names)"
 *
 * Root cause: MikroORM 6.4.16's raw() incorrectly quotes alias-qualified
 * identifiers in the noRulesSubquery when attributeValueMap.size === 0.
 *
 * Fix: Return null instead of the broken raw SQL filter. This makes the caller
 * fall through to the simpler { is_automatic: true } filter which works fine.
 *
 * Remove this patch when upgrading to @medusajs/promotion >= 2.13.6.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

import { readdirSync } from "fs";

// Search multiple possible locations (regular node_modules + pnpm store + pruned deploy)
const FILENAME = "build-promotion-rule-query-filter-from-context.js";
const SEARCH_DIRS = [
  resolve(import.meta.dirname, "../node_modules"),
  resolve(import.meta.dirname, "../../node_modules"),
  "/app/pruned/node_modules",
  "/app/server/node_modules",
];

function findFile(dir) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true, recursive: true });
    for (const e of entries) {
      if (e.name === FILENAME && e.isFile()) {
        const full = resolve(e.parentPath ?? e.path, e.name);
        if (full.includes("@medusajs/promotion")) return full;
      }
    }
  } catch { /* dir doesn't exist */ }
  return null;
}

let TARGET = null;
for (const dir of SEARCH_DIRS) {
  TARGET = findFile(dir);
  if (TARGET) break;
}

if (!TARGET) {
  console.log("[patch-promotion] File not found in any search path, skipping");
  process.exit(0);
}

console.log(`[patch-promotion] Found: ${TARGET}`);

const src = readFileSync(TARGET, "utf8");

// Already patched?
if (src.includes("// PATCHED: return null")) {
  console.log("[patch-promotion] Already patched, skipping");
  process.exit(0);
}

// The buggy block: when attributeValueMap.size === 0, it returns a raw() filter
// that MikroORM mangles. Replace it with returning null.
const BUGGY = `    if (attributeValueMap.size === 0) {
        // If context has no attributes, exclude all promotions that have any rules (promotion rules, target rules, or buy rules)
        const noRulesSubquery = (alias) => \`
      \${alias}.id NOT IN (
        SELECT DISTINCT ppr.promotion_id
        FROM promotion_promotion_rule ppr
        UNION
        SELECT DISTINCT am.promotion_id
        FROM promotion_application_method am
        JOIN application_method_target_rules amtr ON am.id = amtr.application_method_id
        UNION
        SELECT DISTINCT am2.promotion_id
        FROM promotion_application_method am2
        JOIN application_method_buy_rules ambr ON am2.id = ambr.application_method_id
      )
    \`.trim();
        return {
            [(0, postgresql_1.raw)((alias) => noRulesSubquery(alias))]: true,
        };
    }`;

const FIXED = `    if (attributeValueMap.size === 0) {
        // PATCHED: return null to avoid MikroORM raw() quoting bug (improper qualified name)
        // This makes the caller fall back to { is_automatic: true } which works correctly.
        // See: https://github.com/medusajs/medusa/issues — fixed in @medusajs/promotion >= 2.13.6
        return null;
    }`;

if (!src.includes("noRulesSubquery")) {
  console.log("[patch-promotion] Cannot find buggy code block, skipping (may already be fixed)");
  process.exit(0);
}

const patched = src.replace(BUGGY, FIXED);

if (patched === src) {
  console.log("[patch-promotion] Exact match failed, trying line-by-line replacement");
  // Fallback: simpler replacement targeting just the return statement
  const simpleOld = `        return {
            [(0, postgresql_1.raw)((alias) => noRulesSubquery(alias))]: true,
        };`;
  const simpleNew = `        // PATCHED: return null to avoid MikroORM raw() quoting bug
        return null;`;
  const patched2 = src.replace(simpleOld, simpleNew);
  if (patched2 !== src) {
    writeFileSync(TARGET, patched2);
    console.log("[patch-promotion] Patched (simple mode) — noRulesSubquery return null");
    process.exit(0);
  }
  console.error("[patch-promotion] Could not patch — manual intervention needed");
  process.exit(1);
}

writeFileSync(TARGET, patched);
console.log("[patch-promotion] Patched — empty-context returns null instead of broken raw SQL");
