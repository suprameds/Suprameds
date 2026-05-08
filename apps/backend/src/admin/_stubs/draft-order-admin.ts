/**
 * Empty stub for @medusajs/draft-order/admin.
 *
 * The medusa-cli's generated admin entry.jsx unconditionally imports this
 * subpath for plugin auto-discovery. We don't use the draft-order plugin,
 * but we can't simply mark it `external` in Vite — that leaves a bare
 * module specifier in the bundle, which crashes the browser on load
 * ("Failed to resolve module specifier '@medusajs/draft-order/admin'.").
 *
 * Medusa's admin auto-discovery imports extensions as NAMED exports
 * (`import { widgets, routes, customFields } from "..."`) and iterates
 * each. If `widgets` is undefined, populateWidgets crashes with
 * "Cannot read properties of undefined (reading 'widgets')".
 *
 * So we expose both named exports AND a default object so any import
 * shape Medusa or its plugins use resolves to safe empty values.
 *
 * Aliased to this stub via medusa-config.ts vite.resolve.alias.
 */
export const widgets: unknown[] = []
export const routes: unknown[] = []
export const customFields: Record<string, unknown> = {}
export const menuItems: unknown[] = []
export const config: Record<string, unknown> = {}

export default {
  widgets,
  routes,
  customFields,
  menuItems,
  config,
}
