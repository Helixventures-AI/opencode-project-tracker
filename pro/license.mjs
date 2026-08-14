/**
 * ai-project-tracker PRO — license key tooling (offline, Ed25519-signed).
 * - keygen.mjs  : generates the signing keypair + issues license keys (SELLER side).
 * - license.mjs : verifies a license key against the embedded PUBLIC key (runs in the shipped package).
 *
 * License key format: base64url(payload JSON) + "." + base64url(ed25519 signature of payload).
 * payload = { email, tier, exp (ISO date), lic (license id) }
 */
import crypto from "node:crypto"

export function verifyKey(key, { email } = {}) {
  if (typeof key !== "string" || !key.includes(".")) return { ok: false, reason: "bad_format" }
  const [b64Payload, b64Sig] = key.split(".")
  let payload
  try {
    payload = JSON.parse(Buffer.from(b64Payload, "base64url").toString("utf8"))
  } catch {
    return { ok: false, reason: "bad_payload" }
  }
  if (email && payload.email && payload.email !== email) return { ok: false, reason: "email_mismatch" }
  const data = Buffer.from(JSON.stringify(payload), "utf8")
  const sig = Buffer.from(b64Sig, "base64url")
  const ok = crypto.verify(null, data, PUBLIC_KEY, sig) // Ed25519: null algorithm
  if (!ok) return { ok: false, reason: "bad_signature" }
  if (payload.exp && new Date(payload.exp).getTime() < Date.now()) return { ok: false, reason: "expired", payload }
  return { ok: true, payload }
}

/* The PUBLIC half of the keypair. Private key stays with the seller (never shipped). */
let PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAwKxZvOcGdqqYQDaVF0V8wCodHa2RSZr7KTxSE6WWn0c=
-----END PUBLIC KEY-----`

export function setPublicKey(pem) {
  PUBLIC_KEY = pem
}

export const VERSION = "1.0.0-pro"