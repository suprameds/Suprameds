import crypto from "crypto"

/**
 * Tests for webhook signature verification logic.
 *
 * These tests verify the HMAC/token verification patterns used in our
 * webhook handlers WITHOUT importing the route handlers directly
 * (which have Medusa framework dependencies that are hard to mock).
 * Instead, we test the verification logic in isolation.
 */

describe("AfterShip HMAC verification", () => {
  function verifyAfterShipHmac(
    rawBody: string,
    secret: string,
    signature: string | undefined
  ): boolean {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex")
    return !!signature && signature === expected
  }

  it("accepts valid HMAC signature", () => {
    const secret = "test-webhook-secret"
    const body = JSON.stringify({ event: "tracking_update", msg: { id: "123" } })
    const signature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex")

    expect(verifyAfterShipHmac(body, secret, signature)).toBe(true)
  })

  it("rejects invalid HMAC signature", () => {
    const secret = "test-webhook-secret"
    const body = JSON.stringify({ event: "tracking_update" })

    expect(verifyAfterShipHmac(body, secret, "bad-signature")).toBe(false)
  })

  it("rejects missing signature", () => {
    const secret = "test-webhook-secret"
    const body = JSON.stringify({ event: "tracking_update" })

    expect(verifyAfterShipHmac(body, secret, undefined)).toBe(false)
  })

  it("rejects tampered body", () => {
    const secret = "test-webhook-secret"
    const originalBody = JSON.stringify({ event: "tracking_update" })
    const tamperedBody = JSON.stringify({ event: "tracking_update", extra: true })
    const signature = crypto
      .createHmac("sha256", secret)
      .update(originalBody)
      .digest("hex")

    expect(verifyAfterShipHmac(tamperedBody, secret, signature)).toBe(false)
  })
})

describe("WhatsApp X-Hub-Signature-256 verification", () => {
  function verifyWhatsAppSignature(
    rawBody: string,
    appSecret: string,
    signature: string | undefined
  ): boolean {
    const expected =
      "sha256=" +
      crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")
    return !!signature && signature === expected
  }

  it("accepts valid sha256 signature", () => {
    const secret = "my-app-secret"
    const body = JSON.stringify({ object: "whatsapp_business_account" })
    const signature =
      "sha256=" +
      crypto.createHmac("sha256", secret).update(body).digest("hex")

    expect(verifyWhatsAppSignature(body, secret, signature)).toBe(true)
  })

  it("rejects signature without sha256= prefix", () => {
    const secret = "my-app-secret"
    const body = JSON.stringify({ object: "whatsapp_business_account" })
    // Valid hash but without prefix
    const hash = crypto.createHmac("sha256", secret).update(body).digest("hex")

    expect(verifyWhatsAppSignature(body, secret, hash)).toBe(false)
  })

  it("rejects invalid signature", () => {
    const secret = "my-app-secret"
    const body = JSON.stringify({ object: "whatsapp_business_account" })

    expect(verifyWhatsAppSignature(body, secret, "sha256=invalid")).toBe(false)
  })

  it("rejects missing signature", () => {
    const secret = "my-app-secret"
    const body = JSON.stringify({})

    expect(verifyWhatsAppSignature(body, secret, undefined)).toBe(false)
  })
})

describe("MSG91 token verification", () => {
  function verifyMsg91Token(
    queryToken: string | undefined,
    expectedToken: string
  ): boolean {
    return queryToken === expectedToken
  }

  it("accepts matching token", () => {
    expect(verifyMsg91Token("secret-123", "secret-123")).toBe(true)
  })

  it("rejects mismatched token", () => {
    expect(verifyMsg91Token("wrong", "secret-123")).toBe(false)
  })

  it("rejects undefined token", () => {
    expect(verifyMsg91Token(undefined, "secret-123")).toBe(false)
  })
})

describe("WhatsApp GET verification", () => {
  function verifyWhatsAppGetChallenge(
    mode: string | undefined,
    token: string | undefined,
    expectedToken: string
  ): boolean {
    return mode === "subscribe" && token === expectedToken
  }

  it("passes when mode is subscribe and token matches", () => {
    expect(verifyWhatsAppGetChallenge("subscribe", "my-token", "my-token")).toBe(true)
  })

  it("fails when mode is not subscribe", () => {
    expect(verifyWhatsAppGetChallenge("unsubscribe", "my-token", "my-token")).toBe(false)
  })

  it("fails when token does not match", () => {
    expect(verifyWhatsAppGetChallenge("subscribe", "wrong", "my-token")).toBe(false)
  })

  it("fails when mode is undefined", () => {
    expect(verifyWhatsAppGetChallenge(undefined, "my-token", "my-token")).toBe(false)
  })
})
