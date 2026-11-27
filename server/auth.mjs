import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 32
const PARAMS = { N: 16384, r: 8, p: 1 }
const derive = (password, salt) => new Promise((resolve, reject) => scrypt(password, salt, KEY_LENGTH, PARAMS, (error, key) => (error ? reject(error) : resolve(key))))

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const key = await derive(password, salt)
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`
}

export async function verifyPassword(password, stored) {
  const [kind, saltHex, keyHex] = typeof stored === 'string' ? stored.split('$') : []
  if (kind !== 'scrypt' || !saltHex || !keyHex) return false
  const expected = Buffer.from(keyHex, 'hex')
  const actual = await derive(password, Buffer.from(saltHex, 'hex'))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

// Hash fixo usado para gastar o mesmo tempo quando o usuário não existe.
export const DUMMY_HASH = `scrypt$${'00'.repeat(16)}$${'00'.repeat(KEY_LENGTH)}`

/** Parte do hash que invalida tokens antigos quando a senha muda. */
export const passwordVersion = (stored) => createHash('sha256').update(String(stored)).digest('hex').slice(0, 12)

const b64 = (value) => Buffer.from(value).toString('base64url')
export function signToken(payload, secret) {
  const body = b64(JSON.stringify(payload))
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}
export function verifyToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string') return null
  const [body, signature] = token.split('.')
  if (!body || !signature) return null
  const expected = createHmac('sha256', secret).update(body).digest()
  const given = Buffer.from(signature, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    return typeof payload.u === 'string' && typeof payload.exp === 'number' && payload.exp > now ? payload : null
  } catch {
    return null
  }
}

/** Limita tentativas de login malsucedidas por origem. */
export class LoginLimiter {
  constructor({ max = 8, windowMs = 10 * 60 * 1000 } = {}) {
    this.max = max
    this.windowMs = windowMs
    this.entries = new Map()
  }
  retryAfter(key, now = Date.now()) {
    const entry = this.entries.get(key)
    if (!entry || entry.reset <= now) return 0
    return entry.count >= this.max ? Math.ceil((entry.reset - now) / 1000) : 0
  }
  fail(key, now = Date.now()) {
    const entry = this.entries.get(key)
    if (!entry || entry.reset <= now) this.entries.set(key, { count: 1, reset: now + this.windowMs })
    else entry.count++
    if (this.entries.size > 5000) for (const [k, v] of this.entries) if (v.reset <= now) this.entries.delete(k)
  }
  succeed(key) {
    this.entries.delete(key)
  }
}
