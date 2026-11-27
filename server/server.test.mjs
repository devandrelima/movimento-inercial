import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { validRoom as clientValidRoom } from '../src/room'
import { LoginLimiter, hashPassword, signToken, verifyPassword, verifyToken } from './auth.mjs'
import { createApp } from './index.mjs'
import { cleanName, cleanRoom, validRoom } from './validate.mjs'

const room = { version: 1, width: 8, height: 6, start: { x: 1, y: 1 }, heading: 'up', obstacles: [{ id: 'a', x: 3, y: 2, width: 1, height: 1 }] }

describe('validador de sala do servidor', () => {
  const cases = [
    room,
    { ...room, obstacles: [] },
    { ...room, version: 2 },
    { ...room, width: 0.5 },
    { ...room, width: 31 },
    { ...room, width: 500, height: 500 },
    { ...room, width: 500.5 },
    { ...room, width: 501, height: 20 },
    { ...room, height: NaN },
    { ...room, heading: 'north' },
    { ...room, start: { x: 9, y: 1 } },
    { ...room, start: { x: 3.5, y: 2.5 } },
    { ...room, obstacles: [{ id: 'a', x: 7.5, y: 1, width: 1, height: 1 }] },
    { ...room, obstacles: [{ id: 'a', x: 1, y: 3, width: 0.05, height: 1 }] },
    { ...room, obstacles: [room.obstacles[0], room.obstacles[0]] },
    { ...room, obstacles: Array.from({ length: 21 }, (_, i) => ({ id: String(i), x: 0, y: 5, width: 0.1, height: 0.1 })) },
    { ...room, obstacles: [{ id: '', x: 1, y: 3, width: 1, height: 1 }] },
    { ...room, obstacles: 'x' },
    null,
    'sala',
  ]
  it('concorda com validRoom do cliente', () => {
    for (const value of cases) expect(validRoom(value), JSON.stringify(value)).toBe(clientValidRoom(value))
  })
  it('remove campos desconhecidos e normaliza a sala', () => {
    const cleaned = cleanRoom({ ...room, extra: 1, obstacles: [{ ...room.obstacles[0], note: 'x' }] })
    expect(cleaned).toEqual(room)
    expect(cleanRoom({ ...room, width: 0 })).toBeNull()
    expect(cleanRoom({ ...room, width: 500, height: 500 })).toMatchObject({ width: 500, height: 500 })
    expect(cleanRoom({ ...room, width: 501 })).toBeNull()
  })
  it('valida o nome', () => {
    expect(cleanName('  Sala   de  aula ')).toBe('Sala de aula')
    expect(cleanName('')).toBeNull()
    expect(cleanName('x'.repeat(61))).toBeNull()
    expect(cleanName(5)).toBeNull()
  })
})

describe('autenticação', () => {
  it('guarda a senha com scrypt e confere sem aceitar variações', async () => {
    const hash = await hashPassword('segredo-123')
    expect(hash.startsWith('scrypt$')).toBe(true)
    expect(hash).not.toContain('segredo')
    expect(await verifyPassword('segredo-123', hash)).toBe(true)
    expect(await verifyPassword('segredo-124', hash)).toBe(false)
    expect(await verifyPassword('', hash)).toBe(false)
    expect(await verifyPassword('x', 'lixo')).toBe(false)
  })
  it('assina tokens e rejeita adulterados ou vencidos', () => {
    const token = signToken({ u: 'ana', exp: 2000 }, 'segredo')
    expect(verifyToken(token, 'segredo', 1000)).toMatchObject({ u: 'ana' })
    expect(verifyToken(token, 'outro', 1000)).toBeNull()
    expect(verifyToken(token, 'segredo', 3000)).toBeNull()
    const [body, signature] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ u: 'root', exp: 2000 })).toString('base64url')
    expect(verifyToken(`${forged}.${signature}`, 'segredo', 1000)).toBeNull()
    expect(verifyToken(`${body}.`, 'segredo', 1000)).toBeNull()
    expect(verifyToken(undefined, 'segredo')).toBeNull()
  })
  it('bloqueia depois de várias falhas e libera após a janela ou um sucesso', () => {
    const limiter = new LoginLimiter({ max: 3, windowMs: 1000 })
    for (let i = 0; i < 3; i++) limiter.fail('ip', 0)
    expect(limiter.retryAfter('ip', 500)).toBe(1)
    expect(limiter.retryAfter('outro', 500)).toBe(0)
    expect(limiter.retryAfter('ip', 1001)).toBe(0)
    limiter.succeed('ip')
    expect(limiter.retryAfter('ip', 500)).toBe(0)
  })
})

describe('API dos mapas públicos', () => {
  let dir, app, base
  const call = async (path, { method = 'GET', body, token, headers } = {}) => {
    const response = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    })
    return { status: response.status, headers: response.headers, json: await response.json() }
  }
  const login = async (password = 'senha-de-teste') => call('/api/login', { method: 'POST', body: { username: 'Ana', password } })

  async function start(options = {}) {
    dir = await mkdtemp(join(tmpdir(), 'norte-api-'))
    app = await createApp({ dataDir: dir, seed: { user: 'ana', password: 'senha-de-teste' }, limiter: new LoginLimiter({ max: 3 }), ...options })
    await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${app.server.address().port}`
  }
  beforeEach(() => start())
  afterEach(async () => {
    await new Promise((resolve) => app.server.close(resolve))
    await rm(dir, { recursive: true, force: true })
  })

  it('cria o usuário inicial só a partir do ambiente e sem guardar a senha em texto', async () => {
    expect((await login()).status).toBe(200)
    expect(await readFile(join(dir, 'users.json'), 'utf8')).not.toContain('senha-de-teste')
    await new Promise((resolve) => app.server.close(resolve))
    const other = await mkdtemp(join(tmpdir(), 'norte-api-'))
    const bare = await createApp({ dataDir: other })
    expect(bare.store.users).toHaveLength(0)
    await rm(other, { recursive: true, force: true })
    app.server = (await createApp({ dataDir: dir })).server
    await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${app.server.address().port}`
  })

  it('lista e abre mapas sem login, mas exige login para publicar, editar e excluir', async () => {
    expect((await call('/api/maps')).json).toEqual({ maps: [] })
    expect((await call('/api/maps', { method: 'POST', body: { name: 'A', room } })).status).toBe(401)
    expect((await call('/api/maps', { method: 'POST', body: { name: 'A', room }, token: 'falso' })).status).toBe(401)
    const { json } = await login()
    const created = await call('/api/maps', { method: 'POST', body: { name: ' Laboratório ', room }, token: json.token })
    expect(created.status).toBe(201)
    const id = created.json.map.id
    expect(created.json.map).toMatchObject({ name: 'Laboratório', owner: 'ana' })

    const list = (await call('/api/maps')).json.maps
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id, name: 'Laboratório', width: 8, height: 6, obstacles: 1, rects: [[3, 2, 1, 1]] })
    expect(list[0].room).toBeUndefined()
    expect((await call(`/api/maps/${id}`)).json.map.room).toEqual(room)

    expect((await call(`/api/maps/${id}`, { method: 'PUT', body: { name: 'B', room } })).status).toBe(401)
    expect((await call(`/api/maps/${id}`, { method: 'DELETE' })).status).toBe(401)
    const updated = await call(`/api/maps/${id}`, { method: 'PUT', body: { name: 'Novo nome', room: { ...room, obstacles: [] } }, token: json.token })
    expect(updated.status).toBe(200)
    expect(updated.json.map).toMatchObject({ name: 'Novo nome', owner: 'ana', updatedBy: 'ana' })
    expect((await call(`/api/maps/${id}`)).json.map.room.obstacles).toEqual([])
    expect((await call(`/api/maps/${id}`, { method: 'DELETE', token: json.token })).status).toBe(200)
    expect((await call(`/api/maps/${id}`)).status).toBe(404)
    expect((await call(`/api/maps/${id}`, { method: 'DELETE', token: json.token })).status).toBe(404)
  })

  it('persiste os mapas entre reinícios', async () => {
    const { json } = await login()
    const { json: created } = await call('/api/maps', { method: 'POST', body: { name: 'Persistente', room }, token: json.token })
    await new Promise((resolve) => app.server.close(resolve))
    const again = await createApp({ dataDir: dir })
    await new Promise((resolve) => again.server.listen(0, '127.0.0.1', resolve))
    app.server = again.server
    base = `http://127.0.0.1:${again.server.address().port}`
    expect((await call(`/api/maps/${created.map.id}`)).json.map.name).toBe('Persistente')
    expect((await call('/api/maps', { method: 'POST', body: { name: 'x', room }, token: json.token })).status).toBe(201)
  })

  it('rejeita nome ou sala inválidos e corpos problemáticos', async () => {
    const { json } = await login()
    const post = (body, headers) => call('/api/maps', { method: 'POST', body, token: json.token, headers })
    expect((await post({ name: '', room })).json.error).toBe('bad_name')
    expect((await post({ name: 'ok', room: { ...room, width: 501 } })).json.error).toBe('bad_room')
    expect((await post({ name: 'ok', room: { ...room, start: { x: 3.5, y: 2.5 } } })).json.error).toBe('bad_room')
    expect((await post('{quebrado')).json.error).toBe('bad_json')
    expect((await post('[]')).json.error).toBe('bad_json')
    expect((await post({ name: 'ok', room, lixo: 'x'.repeat(70000) })).status).toBe(413)
    expect((await call('/api/maps', { method: 'POST', body: 'x', token: json.token, headers: { 'Content-Type': 'text/plain' } })).status).toBe(415)
    expect((await call('/api/maps/nao-e-id')).status).toBe(404)
    expect((await call('/api/desconhecida')).status).toBe(404)
    expect((await call('/api/maps')).headers.get('cache-control')).toBe('no-store')
  })

  it('não distingue usuário inexistente de senha errada e limita tentativas por origem', async () => {
    const wrongPassword = await login('errada')
    const wrongUser = await call('/api/login', { method: 'POST', body: { username: 'ninguem', password: 'errada' } })
    expect(wrongPassword.status).toBe(401)
    expect(wrongUser.json).toEqual(wrongPassword.json)
    expect((await call('/api/login', { method: 'POST', body: { username: 'ana' } })).status).toBe(401)
    const blocked = await login()
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0)
    // outra origem (último valor de X-Forwarded-For) não é afetada
    const other = await call('/api/login', { method: 'POST', body: { username: 'ana', password: 'senha-de-teste' }, headers: { 'X-Forwarded-For': '203.0.113.9' } })
    expect(other.status).toBe(200)
  })

  it('invalida tokens quando a senha é trocada', async () => {
    const { json } = await login()
    expect((await call('/api/maps', { method: 'POST', body: { name: 'a', room }, token: json.token })).status).toBe(201)
    app.store.users[0].hash = await hashPassword('outra-senha-123')
    await app.store.saveUsers()
    expect((await call('/api/maps', { method: 'POST', body: { name: 'b', room }, token: json.token })).status).toBe(401)
    expect((await call('/api/login', { method: 'POST', body: { username: 'ana', password: 'outra-senha-123' } })).status).toBe(200)
  })
})
