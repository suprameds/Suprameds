declare module "@medusajs/framework/types" {
  /**
   * Medusa v2's runtime container is an Awilix-style resolver.
   *
   * Some upstream types have changed across Medusa versions; we keep this
   * intentionally minimal so jobs/subscribers can compile without binding
   * tightly to internal type exports.
   */
  export type MedusaContainer = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolve: (key: string) => any
  }

  // Notification module service type name varies across versions.
  // We only rely on the runtime shape in this codebase.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type INotificationModuleService = any
}

