import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename as moveFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const MAX_MAPS = 200

/** Persistência em arquivos JSON com escrita atômica e serializada. */
export class JsonFile {
  constructor(path, fallback) {
    this.path = path
    this.fallback = fallback
    this.queue = Promise.resolve()
  }
  async read() {
    try {
      return JSON.parse(await readFile(this.path, 'utf8'))
    } catch (error) {
      if (error.code === 'ENOENT') return structuredClone(this.fallback)
      throw error
    }
  }
  write(data) {
    const run = async () => {
      const temp = `${this.path}.${process.pid}.tmp`
      await writeFile(temp, JSON.stringify(data), { mode: 0o600 })
      await moveFile(temp, this.path)
    }
    const next = this.queue.then(run, run)
    this.queue = next.catch(() => {})
    return next
  }
}

export async function openStore(dataDir) {
  await mkdir(dataDir, { recursive: true })
  const mapsFile = new JsonFile(join(dataDir, 'maps.json'), { maps: [] })
  const usersFile = new JsonFile(join(dataDir, 'users.json'), { users: [] })
  const maps = (await mapsFile.read()).maps
  const users = (await usersFile.read()).users
  return {
    users,
    saveUsers: () => usersFile.write({ users }),
    /** Relê users.json (o CLI users.mjs pode ter alterado o arquivo com o servidor rodando). */
    async reloadUsers() {
      users.splice(0, users.length, ...(await usersFile.read()).users)
    },
    list: () =>
      maps
        .map(({ room, ...summary }) => ({ ...summary, width: room.width, height: room.height, obstacles: room.obstacles.length, rects: room.obstacles.map((o) => [o.x, o.y, o.width, o.height]) }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    get: (id) => maps.find((m) => m.id === id) ?? null,
    async create({ name, room, owner }) {
      if (maps.length >= MAX_MAPS) throw Object.assign(new Error('limit'), { code: 'limit' })
      const now = new Date().toISOString()
      const map = { id: randomUUID(), name, owner, createdAt: now, updatedAt: now, room }
      maps.push(map)
      try {
        await mapsFile.write({ maps })
      } catch (error) {
        maps.pop()
        throw error
      }
      return map
    },
    async update(id, { name, room, owner }) {
      const map = maps.find((m) => m.id === id)
      if (!map) return null
      const before = { ...map }
      Object.assign(map, { name, room, updatedBy: owner, updatedAt: new Date().toISOString() })
      try {
        await mapsFile.write({ maps })
      } catch (error) {
        Object.assign(map, before)
        throw error
      }
      return map
    },
    async destroy(id) {
      const index = maps.findIndex((m) => m.id === id)
      if (index < 0) return false
      const [dropped] = maps.splice(index, 1)
      try {
        await mapsFile.write({ maps })
      } catch (error) {
        maps.splice(index, 0, dropped)
        throw error
      }
      return true
    },
  }
}
