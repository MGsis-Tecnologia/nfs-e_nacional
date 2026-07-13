# 🚀 Deploy na VPS com Docker

Guia prático para fazer deployment do NFS-e na sua VPS usando Docker e Docker Compose.

## ✅ Pré-requisitos

- VPS com Linux (Ubuntu 20.04+ recomendado)
- Docker instalado
- Docker Compose instalado
- Git instalado

### Instalar Docker e Docker Compose na VPS

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Adicionar seu usuário ao grupo docker (para não precisar sudo)
sudo usermod -aG docker $USER
newgrp docker

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verificar instalação
docker --version
docker-compose --version
```

## 📋 Passo a Passo de Deployment

### 1. Clone o repositório na VPS

```bash
cd /opt
sudo git clone https://github.com/MGsis-Tecnologia/nfs-e.git
cd nfse
```

### 2. Configure o arquivo .env

```bash
# Copie e edite o arquivo de produção
sudo cp .env.production .env.production.local

# Edite as credenciais de banco de dados
sudo nano .env.production.local
```

**Variáveis importantes a configurar:**

```env
DB_USER=seu_usuario
DB_PASSWORD=sua_senha_forte_aqui  # Mude isso!
DB_NAME=nfse
JWT_SECRET=uma_chave_aleatoria_longa_e_complexa  # Gere uma nova!
CORS_ORIGIN=https://seu-dominio.com
```

### 3. Crie um arquivo .env para o Docker Compose

```bash
sudo cat > .env <<EOF
DB_USER=seu_usuario
DB_PASSWORD=sua_senha_forte_aqui
DB_NAME=nfse
DB_PORT=5432
JWT_SECRET=$(openssl rand -base64 32)
CORS_ORIGIN=https://seu-dominio.com
APP_PORT=3000
NODE_ENV=production
EOF
```

### 4. Build e inicie os containers

```bash
# Build da imagem (primeira vez)
sudo docker-compose build

# Inicie os serviços
sudo docker-compose up -d

# Verifique o status
sudo docker-compose ps

# Veja os logs
sudo docker-compose logs -f app
```

### 5. Aguarde a inicialização do banco de dados

```bash
# Aguarde ~30 segundos para o PostgreSQL ficar pronto
# Veja os logs da app para confirmar que está rodando
sudo docker-compose logs app
```

### 6. Configure o Nginx (Reverse Proxy)

```bash
# Instale o Nginx
sudo apt install nginx -y

# Crie o arquivo de configuração
sudo nano /etc/nginx/sites-available/nfse
```

**Conteúdo do arquivo nginx:**

```nginx
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;

    # Redirecionar HTTP para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seu-dominio.com www.seu-dominio.com;

    # Certificados SSL (gere com Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/seu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com/privkey.pem;

    # Proxy para a aplicação Docker
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Ative o site:**

```bash
sudo ln -s /etc/nginx/sites-available/nfse /etc/nginx/sites-enabled/
sudo nginx -t  # Teste a configuração
sudo systemctl restart nginx
```

### 7. Configurar SSL com Let's Encrypt

```bash
# Instale certbot
sudo apt install certbot python3-certbot-nginx -y

# Gere o certificado
sudo certbot certonly --nginx -d seu-dominio.com -d www.seu-dominio.com
```

## 🔧 Comandos Úteis

```bash
# Ver status dos containers
docker-compose ps

# Ver logs em tempo real
docker-compose logs -f

# Ver logs apenas da app
docker-compose logs -f app

# Parar os serviços
docker-compose down

# Reiniciar os serviços
docker-compose restart

# Executar comando dentro do container
docker-compose exec app node backend/server.js

# Remover volumes (⚠️ Deleta dados!)
docker-compose down -v
```

## 🐛 Troubleshooting

### Porta já em uso

```bash
# Encontre o processo usando a porta
lsof -i :3000
sudo kill -9 <PID>
```

### Erro de conexão com banco de dados

```bash
# Verifique se o PostgreSQL está rodando
docker-compose ps

# Veja os logs do postgres
docker-compose logs postgres

# Teste a conexão manualmente
docker-compose exec postgres psql -U seu_usuario -d nfse -c "SELECT 1"
```

### Erro de permissão no Docker

```bash
# Adicione seu usuário ao grupo docker
sudo usermod -aG docker $USER
newgrp docker
```

### Aplicação não inicia

```bash
# Verifique os logs detalhados
docker-compose logs app

# Recrie os containers
docker-compose down
docker-compose up -d --build
```

## 📊 Monitoramento

### Ver uso de recursos

```bash
docker stats
```

### Backup do banco de dados

```bash
# Backup simples
docker-compose exec postgres pg_dump -U seu_usuario nfse > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore de um backup
docker-compose exec -T postgres psql -U seu_usuario nfse < backup_20240101_120000.sql
```

## 🔐 Segurança

- [ ] Mude as credenciais padrão do banco de dados
- [ ] Gere um JWT_SECRET seguro: `openssl rand -base64 32`
- [ ] Configure HTTPS/SSL
- [ ] Configure firewall para aceitar apenas portas 80 e 443
- [ ] Configure backups automáticos
- [ ] Atualize regulamente as imagens Docker

## 📝 Notas Importantes

1. **Primeiro acesso**: Na primeira vez que a app rodar, abra `https://seu-dominio.com` e siga o wizard de setup
2. **Banco de dados**: O PostgreSQL é iniciado automaticamente via Docker Compose
3. **Logs**: Sempre verifique os logs com `docker-compose logs` se algo der errado
4. **Atualizações**: Para atualizar o código, faça `git pull` e `docker-compose up -d --build`

## ❓ Precisa de Ajuda?

Se encontrar problemas:
1. Verifique os logs: `docker-compose logs -f`
2. Teste a conexão do banco: `docker-compose exec postgres psql -U seu_usuario -d nfse -c "SELECT 1"`
3. Reinicie os containers: `docker-compose restart`
