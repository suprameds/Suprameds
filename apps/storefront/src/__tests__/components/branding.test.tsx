import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { resolve } from "path"

const SRC = resolve(__dirname, "../..")

function readSource(relativePath: string): string {
  return readFileSync(resolve(SRC, relativePath), "utf-8")
}

describe("Branding – No 'Medusa Store' references", () => {
  const filesToCheck = [
    "routes/$countryCode/products/$handle.tsx",
    "routes/$countryCode/categories/$handle.tsx",
  ]

  filesToCheck.forEach((file) => {
    it(`${file} should not contain 'Medusa Store'`, () => {
      const content = readSource(file)
      expect(content).not.toContain("Medusa Store")
    })

    it(`${file} should use 'Suprameds' instead`, () => {
      const content = readSource(file)
      expect(content).toContain("Suprameds")
    })
  })
})

describe("Default country code", () => {
  it("product-actions.tsx uses 'in' as fallback, not 'dk'", () => {
    const content = readSource("components/product-actions.tsx")
    expect(content).not.toContain('"dk"')
    expect(content).toContain('"in"')
  })
})

describe("Security – .env.example files have no real secrets", () => {
  it("backend .env.example has placeholder Firebase key", () => {
    const content = readFileSync(
      resolve(SRC, "../../backend/.env.example"),
      "utf-8"
    )
    expect(content).not.toMatch(/MIIEv[A-Za-z0-9+/=\n\\]{100,}/)
    expect(content).toContain("YOUR_PRIVATE_KEY_HERE")
  })

  it("storefront .env.example has placeholder publishable key", () => {
    const content = readFileSync(
      resolve(SRC, "../.env.example"),
      "utf-8"
    )
    expect(content).toContain("pk_your_publishable_key_here")
    expect(content).not.toMatch(/pk_[a-f0-9]{40,}/)
  })

  it("backend medusa-config.ts has no 'supersecret' fallback", () => {
    const content = readFileSync(
      resolve(SRC, "../../backend/medusa-config.ts"),
      "utf-8"
    )
    expect(content).not.toContain("supersecret")
  })
})
