#!/bin/bash

# ============================================
# Script de Instalação Docker + Docker Compose
# Para Ubuntu/Debian em VPS
# ============================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Instalando Docker + Docker Compose         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"

# Verificar se é root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Este script deve ser executado como root${NC}"
    echo "Use: sudo ./install-docker.sh"
    exit 1
fi

echo -e "${YELLOW}Atualizando sistema...${NC}"
apt-get update
apt-get upgrade -y

# Instalar dependências
echo -e "${YELLOW}Instalando dependências...${NC}"
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    software-properties-common

# Adicionar chave GPG Docker
echo -e "${YELLOW}Adicionando chave GPG do Docker...${NC}"
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Adicionar repositório Docker
echo -e "${YELLOW}Adicionando repositório Docker...${NC}"
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Atualizar índice de pacotes
apt-get update

# Instalar Docker
echo -e "${YELLOW}Instalando Docker CE...${NC}"
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Instalação alternativa do Docker Compose (standalone)
echo -e "${YELLOW}Instalando Docker Compose standalone...${NC}"
DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d'"' -f4)
curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Iniciar Docker
echo -e "${YELLOW}Iniciando Docker...${NC}"
systemctl start docker
systemctl enable docker

# Adicionar usuário ao grupo docker
echo -e "${YELLOW}Configurando permissões...${NC}"
usermod -aG docker $SUDO_USER || true

# Verificar instalação
echo -e "${BLUE}Verificando instalação...${NC}"
docker --version
docker-compose --version

echo -e "${GREEN}✅ Instalação concluída!${NC}"
echo ""
echo -e "${YELLOW}Próximos passos:${NC}"
echo "1. Se você adicionou seu usuário ao grupo docker, faça logout e login novamente"
echo "2. Ou use: newgrp docker"
echo "3. Clone o repositório:"
echo "   cd /opt && git clone https://github.com/MGsis-Tecnologia/nfs-e.git && cd nfs-e"
echo "4. Configure o .env:"
echo "   cp .env.production .env && nano .env"
echo "5. Execute o setup:"
echo "   ./deploy.sh setup"
echo ""
echo -e "${BLUE}Teste com:${NC}"
echo "  docker run hello-world"
