# Mapas públicos

Um **mapa público** é uma sala (dimensões, obstáculos, ponto e direção iniciais) publicada no servidor para que qualquer pessoa a carregue. Os mapas locais, salvos só no navegador, continuam funcionando como antes.

## Quem pode o quê

| Ação | Login |
| --- | --- |
| Ver a lista e carregar um mapa público | não |
| Criar e editar uma sala localmente | não |
| Publicar uma sala como mapa público | **sim** |
| Atualizar (editar) um mapa público | **sim** |
| Excluir um mapa público | **sim** |

Todo usuário autenticado pode atualizar ou excluir qualquer mapa público; o nome de quem criou e de quem editou por último é exibido na lista.

## Uso

- **Carregar:** no mapa, toque em *Mapas públicos* e em *Carregar*. A sala passa a ser a sala local deste aparelho (é preciso que não haja sessão em andamento, como na edição).
- **Editar:** em *Mapas públicos*, *Editar* abre o editor com o mapa. As alterações são locais até você tocar em *Publicar…* e escolher *Atualizar o mapa público “…”*, o que pede login.
- **Publicar:** no editor, *Publicar…* pede usuário e senha, depois o nome do mapa. A sala também é salva localmente. Para publicar um mapa derivado como novo, escolha *Publicar como um novo mapa*.
- **Excluir:** na lista (*Excluir*) ou na janela de publicação. Pede login e confirmação.

O login vale por 12 horas e fica apenas na aba do navegador (`sessionStorage`); *Sair* na lista o encerra antes.

## Usuários

A API não tem cadastro público. O primeiro usuário é criado **no primeiro start**, a partir das variáveis `SEED_USER` e `SEED_PASSWORD` do `.env` (ignorado pelo Git; o repositório é público, então a senha nunca entra no código). Depois de criado, o `.env` não é mais consultado para usuários.

Para criar ou trocar a senha de um usuário (a senha vem da entrada padrão, nunca de argumentos; mínimo de 8 caracteres) e listar ou remover usuários:

```bash
printf '%s' 'nova-senha-longa' | docker compose exec -T norte-api node users.mjs set <usuario>
docker compose exec -T norte-api node users.mjs list
docker compose exec -T norte-api node users.mjs delete outro-usuario
```

Trocar a senha invalida os logins anteriores daquele usuário. **Use uma senha forte e não óbvia**: quem adivinhar a senha de um usuário consegue alterar ou apagar os mapas públicos (o limite de tentativas só atrasa quem tenta adivinhar).

## Arquitetura

- Serviço `norte-api` (Node 22, sem dependências externas) no mesmo Compose. Roda apenas na rede interna do projeto (`internal`, alias `norte-inercial-api`), sem porta publicada e sem entrar na rede compartilhada `automacao-net`. Usa sistema de arquivos somente leitura, usuário sem privilégios, `cap_drop: ALL` e o volume nomeado `maps-data` (em `/data`) para `maps.json`, `users.json` e `secret`.
- O Nginx do serviço `web` encaminha `/api/` para `norte-inercial-api:3000`. O resto do site continua estático.
- Senhas com scrypt (sal por usuário); tokens assinados com HMAC-SHA256 (segredo em `/data/secret` ou `TOKEN_SECRET`), com validade de 12 h e invalidados quando a senha muda. Tentativas de login falhas são limitadas por origem (8 em 10 minutos, depois HTTP 429).
- O servidor valida de novo toda sala recebida (mesmas regras do editor: 1–30 m, até 20 obstáculos dentro da sala, ponto inicial livre), normaliza os campos, limita o corpo a 64 KB, o nome a 60 caracteres e o total a 200 mapas.

### Endpoints

`GET /api/health` · `GET /api/maps` · `GET /api/maps/:id` · `POST /api/login` · `POST /api/maps` · `PUT /api/maps/:id` · `DELETE /api/maps/:id`. Os três últimos exigem `Authorization: Bearer <token>`.

### Backup

Os dados ficam no volume `<projeto>_maps-data`. Exemplo de cópia: `docker run --rm -v navegacao-inercial_maps-data:/data:ro -v "$PWD":/backup alpine tar czf /backup/mapas.tgz -C /data .`. O arquivo contém os hashes de senha e o segredo dos tokens: guarde-o com cuidado.

## Testes

`npx vitest run` cobre o validador, a autenticação e a API (`server/server.test.mjs`). O roteiro `tests/browser-public-maps.js` percorre o fluxo no navegador (exige `TEST_USER` e `TEST_PASSWORD`) e `tests/browser-public-maps-fit.js` confere o layout das telas novas.
