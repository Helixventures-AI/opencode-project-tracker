/**
 * ai-project-tracker PRO — SELLER-side keygen.
 * Usage:
 *   node pro/keygen.mjs gen <email> <tier> <days>          → issue a license key
 *   node pro/keygen.mjs keypair                              → (re)generate signing keys + print public PEM
 *   node pro/keygen.mjs verify <key> [email]                 → test a key against the public key
 *
 * Private key is written to pro/.license-secret.key (gitignored). Keep it secret and back it up.
 */
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const SECRET = path.join(here, ".license-secret.key")

function ensureKeypair() {
  if (fs.existsSync(SECRET)) {
    const pem = fs.readFileSync(SECRET, "utf8")
    const priv = crypto.createPrivateKey(pem)
    const pub = crypto.createPublicKey(priv).export({ type: "spki", format: "pem" })
    return { priv, pub }
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519")
  const pubPem = publicKey.export({ type: "spki", format: "pem" })
  const privPem = privateKey.export({ type: "pkcs8", format: "pem" })
  fs.writeFileSync(SECRET, privPem)
  return { priv: privateKey, pub: pubPem }
}

function issue(email, tier, days) {
  const { priv } = ensureKeypair()
  const payload = {
    email,
    tier,
    exp: new Date(Date.now() + days * 86400000).toISOString(),
    lic: "aipt-pro-" + crypto.randomBytes(4).toString("hex"),
  }
  const data = Buffer.from(JSON.stringify(payload), "utf8")
  const sig = crypto.sign(null, data, priv) // Ed25519
  const key = Buffer.from(JSON.stringify(payload)).toString("base64url") + "." + sig.toString("base64url")
  return { payload, key }
}

const [cmd, a, b, c] = process.argv.slice(2)
if (cmd === "gen") {
  const { key, payload } = issue(a, b || "pro", Number(c) || 365)
  console.log("KEY : " + key)
  console.log("INFO: " + JSON.stringify(payload))
} else if (cmd === "keypair") {
  const { pub } = ensureKeypair()
  console.log(pub)
} else if (cmd === "verify") {
  const { verifyKey } = await import("./license.mjs")
  console.log(verifyKey(a, { email: b }))
} else {
  console.log("Usage: node pro/keygen.mjs gen <email> <tier> <days> | keypair | verify <key> [email]")
}