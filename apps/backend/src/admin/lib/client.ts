import Medusa from "@medusajs/js-sdk"

declare const __BACKEND_URL__: string | undefined

export const sdk = new Medusa({
  baseUrl: typeof __BACKEND_URL__ !== "undefined" ? __BACKEND_URL__ : "/",
  debug: process.env.NODE_ENV === "development",
  auth: {
    type: "session",
  },
})