/**
 * PHI (Protected Health Information) encryption at rest using AES-256-GCM.
 *
 * All PHI fields (patient names, addresses, doctor details, phone numbers)
 * are encrypted before database storage and decrypted on read.
 *
 * Env: PHI_ENCRYPTION_KEY — 64-char hex string (32 bytes)
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const TAG_LENGTH = 16
const ENCODING: BufferEncoding = "base64"
const ENCRYPTED_PREFIX = "enc::"

let _keyBuffer: Buffer | null = null

function getKey(): Buffer {
  if (_keyBuffer) return _keyBuffer

  const hex = process.env.PHI_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      "PHI_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    )
  }
  _keyBuffer = Buffer.from(hex, "hex")
  return _keyBuffer
}

/**
 * Encrypt a plaintext value. Returns a prefixed string: `enc::{iv}:{ciphertext}:{tag}`
 * Returns null/undefined inputs unchanged.
 */
export function encryptPhi(plaintext: string | null | undefined): string | null | undefined {
  if (plaintext == null || plaintext === "") return plaintext
  if (plaintext.startsWith(ENCRYPTED_PREFIX)) return plaintext // already encrypted

  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return `${ENCRYPTED_PREFIX}${iv.toString(ENCODING)}:${encrypted.toString(ENCODING)}:${tag.toString(ENCODING)}`
}

/**
 * Decrypt an encrypted PHI value. Returns the original plaintext.
 * Returns non-encrypted inputs unchanged (graceful fallback for migration).
 */
export function decryptPhi(ciphertext: string | null | undefined): string | null | undefined {
  if (ciphertext == null || ciphertext === "") return ciphertext
  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) return ciphertext // not encrypted, return as-is

  const key = getKey()
  const payload = ciphertext.slice(ENCRYPTED_PREFIX.length)
  const [ivB64, dataB64, tagB64] = payload.split(":")

  if (!ivB64 || !dataB64 || !tagB64) {
    throw new Error("Malformed encrypted PHI value")
  }

  const iv = Buffer.from(ivB64, ENCODING)
  const encrypted = Buffer.from(dataB64, ENCODING)
  const tag = Buffer.from(tagB64, ENCODING)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}

/** PHI field names in the Prescription model that require encryption */
export const PRESCRIPTION_PHI_FIELDS = [
  "patient_name",
  "doctor_name",
  "doctor_reg_no",
  "guest_phone",
  "pharmacist_notes",
] as const

/** PHI field names in the H1RegisterEntry model that require encryption */
export const H1_REGISTER_PHI_FIELDS = [
  "patient_name",
  "patient_address",
  "prescriber_name",
  "prescriber_reg_no",
] as const

/** PHI field names in SupplyMemo that require encryption */
export const SUPPLY_MEMO_PHI_FIELDS = [
  "customer_name",
  "customer_address",
] as const

/** PHI field names in GuestSession that require encryption */
export const GUEST_SESSION_PHI_FIELDS = [
  "phone",
  "email",
] as const

/**
 * Encrypt all PHI fields in an object. Mutates the object in place.
 */
export function encryptPhiFields(
  obj: Record<string, any>,
  fields: readonly string[]
): Record<string, any> {
  for (const field of fields) {
    if (field in obj && obj[field] != null) {
      obj[field] = encryptPhi(obj[field])
    }
  }
  return obj
}

/**
 * Decrypt all PHI fields in an object. Returns a new object.
 */
export function decryptPhiFields(
  obj: Record<string, any>,
  fields: readonly string[]
): Record<string, any> {
  const result = { ...obj }
  for (const field of fields) {
    if (field in result && result[field] != null) {
      result[field] = decryptPhi(result[field])
    }
  }
  return result
}

/**
 * Decrypt PHI fields in an array of objects.
 */
export function decryptPhiArray(
  arr: Record<string, any>[],
  fields: readonly string[]
): Record<string, any>[] {
  return arr.map((obj) => decryptPhiFields(obj, fields))
}

/**
 * Check if encryption is configured (PHI_ENCRYPTION_KEY is set).
 */
export function isPhiEncryptionEnabled(): boolean {
  const hex = process.env.PHI_ENCRYPTION_KEY
  return !!hex && hex.length === 64
}
