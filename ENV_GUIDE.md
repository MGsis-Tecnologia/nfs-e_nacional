# 📋 Guia Completo de Variáveis de Ambiente

## 🗄️ Banco de Dados (PostgreSQL)

```env
DB_USER=postgres
DB_PASSWORD=mgsispostgres
DB_NAME=nfse
DB_PORT=5432
```

**O que é?**
- `DB_USER` - Usuário para conectar ao PostgreSQL (padrão: `postgres`)
- `DB_PASSWORD` - Senha do usuário (escolha uma forte!)
- `DB_NAME` - Nome do banco de dados a criar (recomendado: `nfse`)
- `DB_PORT` - Porta do PostgreSQL (padrão: 5432)

**⚠️ Importante:** Se está rodando Docker Compose, use `postgres` como HOST (não localhost)

---

## ⚙️ Aplicação Node.js

```env
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
```

**O que é?**
- `NODE_ENV` - Modo de execução
  - `production` = otimizado, sem debug
  - `development` = com logs detalhados
- `PORT` - Porta interna da aplicação (padrão: 3001)
- `HOST` - Interface de rede
  - `0.0.0.0` = aceita conexões de qualquer origem (recomendado para Docker)
  - `127.0.0.1` = apenas local (não use em VPS)

---

## 🔐 Autenticação Admin

```env
JWT_SECRET=gere_uma_chave_aleatoria_longa_e_segura_aqui
```

**O que é?**
- Chave secreta para assinar tokens de sessão do admin
- **MUDE ISSO!** Use uma chave aleatória forte

**Como gerar uma chave segura:**

```bash
# Opção 1: OpenSSL (Linux/Mac)
openssl rand -base64 32

# Opção 2: Node.js (qualquer SO)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Opção 3: Online (último recurso)
# Copie daqui: https://generate-random.org/encryption-key-generator?count=1&bytes=32&uppercase=false
```

**Exemplo de saída:**
```
X9zK2m8pL4qR7vB3nJ6sF1wC5dE8hJ2mN7tQ9uW3xY6z
```

---

## 🌐 CORS (Compartilhamento de Origem)

```env
CORS_ORIGIN=https://seu-dominio.com
```

**O que é?**
- Define qual(is) domínio(s) podem acessar a API
- Segurança para evitar requisições maliciosas

**Exemplos:**

```env
# Um domínio único
CORS_ORIGIN=https://nfse.sua-empresa.com

# Múltiplos domínios (separados por vírgula)
CORS_ORIGIN=https://nfse.sua-empresa.com,https://app.sua-empresa.com

# Desenvolvimento local
CORS_ORIGIN=http://localhost:3000

# Aceitar tudo (⚠️ APENAS TESTE)
CORS_ORIGIN=*
```

---

## 🐳 Docker Compose

```env
APP_PORT=3000
```

**O que é?**
- Porta **externa** que a aplicação vai responder
- A aplicação internamente roda na porta 3001 (PORT)

**Mapeamento:**
```
APP_PORT=3000  → Acessa em http://seu-dominio.com:3000
APP_PORT=80    → Acessa em http://seu-dominio.com (HTTP puro)
APP_PORT=443   → Acessa em https://seu-dominio.com (HTTPS - use Nginx)
```

**Recomendado:** Use 3000 ou 8000, e coloque Nginx na frente como proxy

---

## 📝 Exemplo Completo para Produção

```env
# ============ BANCO DE DADOS ============
DB_USER=nfse_user
DB_PASSWORD=Sua$enha#Forte@123!
DB_NAME=nfse_production
DB_PORT=5432

# ============ APLICAÇÃO ============
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# ============ SEGURANÇA ============
JWT_SECRET=X9zK2m8pL4qR7vB3nJ6sF1wC5dE8hJ2mN7tQ9uW3xY6z

# ============ CORS ============
CORS_ORIGIN=https://nfse.sua-empresa.com

# ============ DOCKER ============
APP_PORT=3000
```

---

## 🔒 Recomendações de Segurança

1. **Senhas fortes:**
   - Mínimo 12 caracteres
   - Misture MAIÚSCULAS, minúsculas, números e símbolos
   - Não use palavras do dicionário

2. **JWT_SECRET:**
   - Gere aleatoriamente
   - Mínimo 32 caracteres
   - Nunca compartilhe

3. **CORS_ORIGIN:**
   - Especifique apenas seus domínios
   - Nunca use `*` em produção

4. **Credenciais do Banco:**
   - Use um usuário específico (não `postgres`)
   - Senhas diferentes por ambiente (dev/prod)

---

## ✅ Checklist Final

- [ ] DB_USER e DB_PASSWORD preenchidos
- [ ] JWT_SECRET é uma chave aleatória forte
- [ ] CORS_ORIGIN aponta para seu domínio real
- [ ] NODE_ENV=production
- [ ] HOST=0.0.0.0 (para Docker)
- [ ] APP_PORT está livre na VPS

---

## 🆘 Exemplo Passo a Passo

Na sua VPS:

```bash
# Gerar JWT_SECRET
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=$JWT_SECRET"

# Copiar template
cp .env.production .env

# Editar o arquivo
nano .env

# Preencher com:
DB_USER=postgres
DB_PASSWORD=mgsispostgres
DB_NAME=nfse
DB_PORT=5432

NODE_ENV=production
PORT=3001
HOST=0.0.0.0

JWT_SECRET=X9zK2m8pL4qR7vB3nJ6sF1wC5dE8hJ2mN7tQ9uW3xY6z

CORS_ORIGIN=https://seu-dominio.com

APP_PORT=3000
```

Pronto! 🎉
