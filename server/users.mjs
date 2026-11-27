// Gerencia usuários da API. Uso (a senha vem da entrada padrão, nunca de argumentos):
//   printf '%s' 'nova-senha' | docker compose exec -T norte-api node users.mjs set <usuario>
//   docker compose exec -T norte-api node users.mjs list
import { hashPassword } from './auth.mjs'
import { openStore } from './store.mjs'

const [command, name] = process.argv.slice(2)
const store = await openStore(process.env.DATA_DIR ?? '/data')
const username = String(name ?? '').trim().toLowerCase()

async function readStdin() {
  let text = ''
  for await (const chunk of process.stdin) text += chunk
  return text.replace(/\r?\n$/, '')
}

if (command === 'list') {
  for (const user of store.users) console.log(user.username)
} else if (command === 'set' && /^[a-z0-9._-]{3,32}$/.test(username)) {
  const password = await readStdin()
  if (password.length < 8) {
    console.error('A senha deve ter pelo menos 8 caracteres.')
    process.exit(1)
  }
  const hash = await hashPassword(password)
  const existing = store.users.find((user) => user.username === username)
  if (existing) existing.hash = hash
  else store.users.push({ username, hash, createdAt: new Date().toISOString() })
  await store.saveUsers()
  console.log(existing ? 'senha atualizada (sessões antigas deixam de valer)' : 'usuário criado')
} else if (command === 'delete' && username) {
  const index = store.users.findIndex((user) => user.username === username)
  if (index < 0) {
    console.error('usuário não encontrado')
    process.exit(1)
  }
  store.users.splice(index, 1)
  await store.saveUsers()
  console.log('usuário removido')
} else {
  console.error('uso: users.mjs list | set <usuario> (senha pela entrada padrão) | delete <usuario>')
  process.exit(1)
}
