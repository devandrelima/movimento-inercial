import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DUMMY_HASH, LoginLimiter, hashPassword, passwordVersion, signToken, verifyPassword, verifyToken } from './auth.mjs'
import { openStore } from './store.mjs'
import { cleanName, cleanRoom } from './validate.mjs'

const MAX_BODY = 64 * 1024
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000
const ID = /^[0-9a-f-]{36}$/
const normalizeUser = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '')

async function loadSecret(dataDir, fromEnv) {
  if (fromEnv) return fromEnv
  const path = join(dataDir, 'secret')
  try {
    return (await readFile(path, 'utf8')).trim()
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    const secret = randomBytes(32).toString('hex')
    await writeFile(path, secret, { mode: 0o600 })
    return secret
  }
}

/** Cria o usuário inicial a partir do ambiente, apenas quando ainda não há usuários. */
async function seedUsers(store, seed) {
  if (store.users.length || !seed?.user || !seed?.password) return false
  store.users.push({ username: normalizeUser(seed.user), hash: await hashPassword(seed.password), createdAt: new Date().toISOString() })
  await store.saveUsers()
  return true
}

function clientKey(request) {
  const forwarded = String(request.headers['x-forwarded-for'] ?? '').split(',').map((part) => part.trim()).filter(Boolean)
  return forwarded.at(-1) ?? request.socket.remoteAddress ?? 'unknown'
}

class HttpError extends Error {
  constructor(status, code, message, headers = {}) {
    super(message)
    Object.assign(this, { status, code, headers })
  }
}

async function readJson(request) {
  if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) throw new HttpError(415, 'content_type', 'Envie o corpo como JSON.')
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY) throw new HttpError(413, 'too_large', 'Requisição grande demais.')
    chunks.push(chunk)
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (value && typeof value === 'object' && !Array.isArray(value)) return value
  } catch {
    // cai no erro abaixo
  }
  throw new HttpError(400, 'bad_json', 'JSON inválido.')
}

export async function createApp({ dataDir, secret: secretFromEnv, seed, limiter = new LoginLimiter(), now = () => Date.now(), log = () => {} }) {
  const store = await openStore(dataDir)
  const secret = await loadSecret(dataDir, secretFromEnv)
  if (await seedUsers(store, seed)) log('usuário inicial criado')

  async function authenticate(request) {
    await store.reloadUsers()
    const header = String(request.headers.authorization ?? '')
    const payload = header.startsWith('Bearer ') ? verifyToken(header.slice(7), secret, now()) : null
    const user = payload && store.users.find((item) => item.username === payload.u)
    if (!user || passwordVersion(user.hash) !== payload.pv) throw new HttpError(401, 'unauthorized', 'Faça login para continuar.')
    return user.username
  }

  async function login(request) {
    const key = clientKey(request)
    const wait = limiter.retryAfter(key, now())
    if (wait) throw new HttpError(429, 'rate_limited', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.', { 'Retry-After': String(wait) })
    const body = await readJson(request)
    await store.reloadUsers()
    const username = normalizeUser(body.username)
    const password = typeof body.password === 'string' ? body.password : ''
    const user = username && password.length <= 200 ? store.users.find((item) => item.username === username) : null
    const ok = await verifyPassword(password.slice(0, 200), user?.hash ?? DUMMY_HASH)
    if (!user || !ok) {
      limiter.fail(key, now())
      throw new HttpError(401, 'invalid_credentials', 'Usuário ou senha incorretos.')
    }
    limiter.succeed(key)
    const expiresAt = now() + TOKEN_TTL_MS
    return { token: signToken({ u: user.username, pv: passwordVersion(user.hash), exp: expiresAt }, secret), username: user.username, expiresAt }
  }

  const publicMap = ({ id, name, owner, createdAt, updatedAt, updatedBy, room }) => ({ id, name, owner, createdAt, updatedAt, updatedBy, room })

  function mapInput(body) {
    const name = cleanName(body.name)
    if (!name) throw new HttpError(400, 'bad_name', 'Informe um nome de 1 a 60 caracteres.')
    const room = cleanRoom(body.room)
    if (!room) throw new HttpError(400, 'bad_room', 'A sala é inválida: confira as medidas, os obstáculos e o ponto inicial.')
    return { name, room }
  }

  async function route(request, url) {
    const { pathname } = url
    const method = request.method
    if (pathname === '/api/health' && method === 'GET') return [200, { ok: true }]
    if (pathname === '/api/login' && method === 'POST') return [200, await login(request)]
    if (pathname === '/api/maps' && method === 'GET') return [200, { maps: store.list() }]
    if (pathname === '/api/maps' && method === 'POST') {
      const owner = await authenticate(request)
      try {
        return [201, { map: publicMap(await store.create({ ...mapInput(await readJson(request)), owner })) }]
      } catch (error) {
        if (error.code === 'limit') throw new HttpError(409, 'limit', 'Limite de mapas públicos atingido.')
        throw error
      }
    }
    const match = /^\/api\/maps\/([^/]+)$/.exec(pathname)
    if (match) {
      const id = match[1]
      if (!ID.test(id)) throw new HttpError(404, 'not_found', 'Mapa não encontrado.')
      if (method === 'GET') {
        const map = store.get(id)
        if (!map) throw new HttpError(404, 'not_found', 'Mapa não encontrado.')
        return [200, { map: publicMap(map) }]
      }
      if (method === 'PUT') {
        const owner = await authenticate(request)
        const map = await store.update(id, { ...mapInput(await readJson(request)), owner })
        if (!map) throw new HttpError(404, 'not_found', 'Mapa não encontrado.')
        return [200, { map: publicMap(map) }]
      }
      if (method === 'DELETE') {
        await authenticate(request)
        if (!(await store.destroy(id))) throw new HttpError(404, 'not_found', 'Mapa não encontrado.')
        return [200, { ok: true }]
      }
      throw new HttpError(405, 'method', 'Método não permitido.', { Allow: 'GET, PUT, DELETE' })
    }
    throw new HttpError(404, 'not_found', 'Rota não encontrada.')
  }

  const server = createServer(async (request, response) => {
    let status = 500
    let payload = { error: 'internal', message: 'Erro interno.' }
    let headers = {}
    try {
      ;[status, payload] = await route(request, new URL(request.url ?? '/', 'http://localhost'))
    } catch (error) {
      if (error instanceof HttpError) {
        status = error.status
        payload = { error: error.code, message: error.message }
        headers = error.headers
      } else {
        log(`erro: ${error?.stack ?? error}`)
      }
    }
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers })
    response.end(JSON.stringify(payload))
    log(`${request.method} ${request.url?.split('?')[0]} ${status}`)
  })
  return { server, store }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`)
  const { server } = await createApp({
    dataDir: process.env.DATA_DIR ?? '/data',
    secret: process.env.TOKEN_SECRET || undefined,
    seed: { user: process.env.SEED_USER, password: process.env.SEED_PASSWORD },
    log,
  })
  const port = Number(process.env.PORT ?? 3000)
  server.listen(port, '0.0.0.0', () => log(`API de mapas públicos em :${port}`))
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)))
}
