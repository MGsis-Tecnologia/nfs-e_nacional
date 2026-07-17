# Deploy no Coolify

Este é o único fluxo de deploy usado neste projeto: **1 `Dockerfile`, 1 container**,
buildado e gerenciado pelo Coolify. Não usa `docker-compose`.

## Arquitetura

- O `Dockerfile` (multi-stage) builda o backend (Express) e o frontend (React/Vite)
  juntos, na mesma imagem.
- O container final serve os dois: a API responde em `/api/*`, e qualquer outra
  rota cai no build estático do frontend (`frontend/dist`, com fallback de SPA).
- `/health` é a única rota fora desse padrão — existe só para o healthcheck do
  Docker/Coolify.
- O Postgres roda **fora** da imagem, como recurso separado (Postgres do Coolify,
  ou qualquer Postgres acessível por `DATABASE_URL`).

## Passo a passo no Coolify

1. **Banco de dados**: `+ New Resource → Databases → PostgreSQL` → Deploy. Copia a
   *Internal Connection URL* gerada.
2. **Aplicação**: `+ New Resource → Application` → conecta o repositório GitHub,
   branch `master`.
3. **Build Pack**: `Dockerfile`.
4. **Ports Exposes**: a porta que o app escuta (default `3001`; se você setar a
   variável `PORT` com outro valor, use o mesmo valor aqui — os dois precisam bater).
5. **Environment Variables** — todas marcadas como **Runtime only** (desmarcar
   "Available at Buildtime"; motivo explicado no histórico de bugs, item 6):

   | Variável | Exemplo | Obrigatória |
   |---|---|---|
   | `DATABASE_URL` | `postgresql://user:senha@host:5432/nfse?schema=public` | Sim |
   | `JWT_SECRET` | `openssl rand -base64 32` | Sim |
   | `CORS_ORIGIN` | `https://seu-dominio.com` | Sim |
   | `NODE_ENV` | `production` | Sim |

   `PORT` e `HOST` não precisam ser setados — os defaults do `server.js`
   (`3001` / `0.0.0.0`) já servem, a menos que você precise mudar a porta.
6. **Domínio**: aba `Domains` — o Coolify emite SSL via Let's Encrypt sozinho.
7. **Deploy**.

## O que acontece sozinho no boot (`backend/server.js` → `boot()`)

- Gera um `JWT_SECRET` se nenhum estiver configurado.
- Roda `prisma db push` contra o `DATABASE_URL` — cria tabelas que ainda não
  existem (schema aditivo: tabela nova, campo novo). **Mudanças destrutivas**
  (remover/renomear coluna, mudar tipo de um campo com dado) não aplicam
  sozinhas — isso precisa de `prisma db push --accept-data-loss` manual.
- Conecta no banco e sobe o servidor Express.
- `/health` responde `200 {"status":"ok","databaseReachable":true}` quando
  tudo certo — é o que o Coolify usa pra saber que o deploy funcionou.

## Rotas

Tudo do backend fica sob `/api/*` (ex.: `POST /api/nfse/emitir`, `GET /api/rps`,
`POST /api/auth/login`). `/health` é a única exceção.

## Testando localmente antes de subir

Sem `docker-compose` — só `docker build`/`docker run` direto, do jeito que o
Coolify também builda:

```bash
docker build -t nfse-app .

docker network create nfse-net
docker run -d --name nfse-pg --network nfse-net \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=nfse \
  postgres:16-alpine

docker run -d --name nfse-app --network nfse-net -p 3000:3001 \
  -e DATABASE_URL="postgresql://test:test@nfse-pg:5432/nfse?schema=public" \
  -e JWT_SECRET="$(openssl rand -base64 32)" \
  -e CORS_ORIGIN="http://localhost:3000" \
  -e NODE_ENV=production \
  nfse-app

curl http://localhost:3000/health
```

Limpar depois: `docker rm -f nfse-app nfse-pg && docker network rm nfse-net`

## Bugs já encontrados e corrigidos (histórico — evita repetir o mesmo erro)

1. **Frontend não aparecia** — o backend nunca servia o build do React, só a
   API. Corrigido servindo `frontend/dist` com fallback de SPA direto no
   `server.js`.
2. **Healthcheck sempre falhava** — não existia rota `/health`. Criada.
3. **Prisma Client não gerado no container final** — `npm install
   --only=production` deixava só o pacote "cru", sem o client de verdade.
   Corrigido reaproveitando o `node_modules` do backend inteiro do estágio de
   build (que já tem tudo gerado certo).
4. **`.dockerignore` não excluía nada fora da raiz** — padrões como
   `node_modules`/`.env` só casavam na raiz do contexto, não em
   `backend/node_modules`. Isso deixava o `node_modules` do host (Windows)
   vazar pra dentro da imagem Linux e sobrescrever tudo. Corrigido com
   padrões `**/`.
5. **Build quebrava com `prisma: not found`** — o Coolify passa variáveis
   marcadas como "buildtime" (`NODE_ENV=production`) como `ARG` do Docker, e
   isso vira variável de ambiente real dentro do `RUN` — o `npm install`
   então pula `devDependencies` (onde mora a CLI do prisma), mesmo sem
   `--only=production` explícito. Corrigido fixando `ENV NODE_ENV=development`
   no estágio de build, independente do que a plataforma injete.
6. **Healthcheck com porta fixa (3001)** — se `PORT` for configurado com outro
   valor (ex.: `3000`), o healthcheck continuava batendo em `3001` e falhava
   com `ECONNREFUSED` mesmo com o app rodando normalmente. Corrigido pra usar
   `process.env.PORT` dinamicamente, igual o `server.js` faz.
7. **Tabelas nunca eram criadas** — `prisma db push` só rodava através do
   wizard de setup (`/api/setup/database`), que é pulado quando `DATABASE_URL`
   já vem pronto por variável de ambiente (caso do Coolify). Corrigido
   rodando `db push` automaticamente no boot sempre que `DATABASE_URL` já
   está configurado.

## Documentação removida

Os arquivos abaixo descreviam um modelo de deploy diferente (VPS crua +
`docker-compose` + Nginx/certbot manual) que não é mais usado neste projeto —
foram removidos para não confundir com o fluxo atual (Coolify + `Dockerfile`
puro):

- `DEPLOY.md`, `deploy.sh`, `install-docker.sh`, `docker-compose.yml`
- `.env.production`, `.env.vps-example`, `.env.coolify.example` (conteúdo
  consolidado neste arquivo)
- `ENV_GUIDE.md` (documentava variáveis do modelo `docker-compose`, como
  `DB_USER`/`DB_PASSWORD`/`APP_PORT`, que não são usadas no deploy atual)

Se um dia esse projeto precisar rodar numa VPS sem Coolify, esses arquivos
ainda existem no histórico do git (`git log --all --full-history -- DEPLOY.md`)
e podem ser recuperados.
