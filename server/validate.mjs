// Validação do formato de sala (versão 1). Espelha `validRoom` de src/room.ts; o teste de paridade
// em validate.test.mjs compara as duas implementações.
export const MAX_ROOM_SIZE = 500 // mesmo limite de src/room.ts
const HEADINGS = ['up', 'right', 'down', 'left']
const finite = (n) => typeof n === 'number' && Number.isFinite(n)
const round = (n) => Math.round(n * 1e6) / 1e6

export function validRoom(r) {
  if (!r || typeof r !== 'object') return false
  if (r.version !== 1 || !finite(r.width) || !finite(r.height) || r.width < 1 || r.height < 1 || r.width > MAX_ROOM_SIZE || r.height > MAX_ROOM_SIZE) return false
  if (!r.start || !finite(r.start.x) || !finite(r.start.y) || !HEADINGS.includes(r.heading) || !Array.isArray(r.obstacles) || r.obstacles.length > 20) return false
  if (r.start.x < 0 || r.start.x > r.width || r.start.y < 0 || r.start.y > r.height) return false
  if (r.angle !== undefined && (!finite(r.angle) || r.angle < 0 || r.angle >= 360)) return false
  const ids = new Set()
  for (const o of r.obstacles) {
    if (!o || typeof o.id !== 'string' || !o.id || o.id.length > 64 || ids.has(o.id)) return false
    if (![o.x, o.y, o.width, o.height].every(finite) || o.width < 0.1 || o.height < 0.1 || o.x < 0 || o.y < 0) return false
    if (o.x + o.width > r.width + 1e-9 || o.y + o.height > r.height + 1e-9) return false
    ids.add(o.id)
  }
  return !r.obstacles.some((o) => r.start.x >= o.x && r.start.x <= o.x + o.width && r.start.y >= o.y && r.start.y <= o.y + o.height)
}

/** Devolve uma cópia apenas com os campos conhecidos, ou null se a sala for inválida. */
export function cleanRoom(value) {
  if (!validRoom(value)) return null
  return {
    version: 1,
    width: round(value.width),
    height: round(value.height),
    start: { x: round(value.start.x), y: round(value.start.y) },
    heading: value.heading,
    ...(value.angle === undefined ? {} : { angle: Math.round(value.angle * 10) / 10 }),
    obstacles: value.obstacles.map((o) => ({ id: o.id, x: round(o.x), y: round(o.y), width: round(o.width), height: round(o.height) })),
  }
}

export const MAX_NAME = 60
export function cleanName(value) {
  if (typeof value !== 'string') return null
  const name = value.replace(/\s+/g, ' ').trim()
  return name.length >= 1 && name.length <= MAX_NAME ? name : null
}
