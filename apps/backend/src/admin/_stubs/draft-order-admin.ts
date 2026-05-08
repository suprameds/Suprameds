/**
 * Empty stub for @medusajs/draft-order/admin.
 *
 * The medusa-cli's generated admin entry.jsx unconditionally imports this
 * subpath for plugin auto-discovery. We don't use the draft-order plugin,
 * but we can't simply mark it `external` in Vite — that leaves a bare
 * module specifier in the bundle, which crashes the browser on load
 * ("Failed to resolve module specifier '@medusajs/draft-order/admin'.").
 *
 * Aliasing to this empty stub (see medusa-config.ts vite.resolve.alias)
 * lets Rollup bundle a no-op, the import resolves cleanly, and the admin
 * mounts normally.
 */
export default {
  widgets: [],
  routes: [],
  customFields: {},
}
