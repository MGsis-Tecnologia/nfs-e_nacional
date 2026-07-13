#!/bin/bash

# ============================================
# Script de Deploy Automático para VPS
# Uso: ./deploy.sh [setup|update|logs|stop|restart]
# ============================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_NAME="nfse"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
ENV_FILE="$SCRIPT_DIR/.env"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# Funções Helper
# ============================================

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker não está instalado!"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose não está instalado!"
        exit 1
    fi

    log_success "Docker e Docker Compose estão instalados"
}

check_env() {
    if [ ! -f "$ENV_FILE" ]; then
        log_warning "Arquivo .env não encontrado. Criando a partir do modelo..."
        cp "$SCRIPT_DIR/.env.production" "$ENV_FILE"
        log_warning "Edite o arquivo $ENV_FILE com suas credenciais antes de continuar!"
        exit 1
    fi
}

# ============================================
# Comandos de Deploy
# ============================================

setup() {
    log_info "Iniciando setup..."

    check_docker
    check_env

    log_info "Construindo imagens Docker..."
    docker-compose -f "$COMPOSE_FILE" build

    log_info "Iniciando containers..."
    docker-compose -f "$COMPOSE_FILE" up -d

    log_info "Aguardando PostgreSQL ficar pronto..."
    sleep 10

    log_success "Setup concluído!"
    log_info "Acessando em: http://localhost:3000"
    log_info "Verifique os logs com: ./deploy.sh logs"
}

update() {
    log_info "Atualizando código..."

    cd "$SCRIPT_DIR"
    git fetch origin
    git pull origin master

    log_info "Reconstruindo containers..."
    docker-compose -f "$COMPOSE_FILE" build --no-cache

    log_info "Reiniciando serviços..."
    docker-compose -f "$COMPOSE_FILE" up -d

    log_success "Atualização concluída!"
    log_info "Verifique os logs com: ./deploy.sh logs"
}

logs() {
    log_info "Mostrando logs em tempo real (Ctrl+C para sair)..."
    docker-compose -f "$COMPOSE_FILE" logs -f
}

logs_app() {
    log_info "Mostrando logs da aplicação..."
    docker-compose -f "$COMPOSE_FILE" logs -f app
}

logs_db() {
    log_info "Mostrando logs do banco de dados..."
    docker-compose -f "$COMPOSE_FILE" logs -f postgres
}

status() {
    log_info "Status dos containers:"
    docker-compose -f "$COMPOSE_FILE" ps
}

restart() {
    log_info "Reiniciando serviços..."
    docker-compose -f "$COMPOSE_FILE" restart
    log_success "Serviços reiniciados!"
}

stop() {
    log_warning "Parando containers..."
    docker-compose -f "$COMPOSE_FILE" down
    log_success "Containers parados!"
}

backup() {
    log_info "Criando backup do banco de dados..."

    BACKUP_DIR="$SCRIPT_DIR/backups"
    mkdir -p "$BACKUP_DIR"

    BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"

    docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U ${DB_USER:-postgres} ${DB_NAME:-nfse} > "$BACKUP_FILE"

    log_success "Backup criado: $BACKUP_FILE"
}

restore() {
    if [ -z "$1" ]; then
        log_error "Use: ./deploy.sh restore <arquivo_backup.sql>"
        exit 1
    fi

    if [ ! -f "$1" ]; then
        log_error "Arquivo não encontrado: $1"
        exit 1
    fi

    log_warning "Restaurando backup de: $1"
    read -p "Tem certeza? (s/n) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Ss]$ ]]; then
        docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U ${DB_USER:-postgres} ${DB_NAME:-nfse} < "$1"
        log_success "Backup restaurado!"
    else
        log_info "Restauração cancelada"
    fi
}

health_check() {
    log_info "Verificando saúde da aplicação..."

    if curl -f http://localhost:3001/health 2>/dev/null; then
        log_success "Aplicação está saudável ✓"
    else
        log_error "Aplicação não está respondendo"
        log_info "Verifique os logs: ./deploy.sh logs"
        exit 1
    fi
}

# ============================================
# Help
# ============================================

show_help() {
    echo "
${BLUE}╔══════════════════════════════════════════════╗${NC}
${BLUE}║  Script de Deploy - NFS-e                   ║${NC}
${BLUE}╚══════════════════════════════════════════════╝${NC}

Uso: ./deploy.sh [comando]

${YELLOW}Comandos:${NC}
  setup              Primeira vez: cria e inicia tudo
  update             Atualiza código e reinicia
  logs               Mostra logs de todos os serviços
  logs:app           Mostra logs apenas da aplicação
  logs:db            Mostra logs apenas do banco de dados
  status             Mostra status dos containers
  restart            Reinicia todos os serviços
  stop               Para todos os serviços
  backup             Cria backup do banco de dados
  restore <arquivo>  Restaura um backup
  health             Verifica saúde da aplicação
  help               Mostra esta mensagem

${YELLOW}Exemplos:${NC}
  ./deploy.sh setup
  ./deploy.sh update
  ./deploy.sh logs
  ./deploy.sh backup
  ./deploy.sh restore backups/backup_20240101_120000.sql

${YELLOW}Variáveis de Ambiente (.env):${NC}
  DB_USER            Usuário do PostgreSQL
  DB_PASSWORD        Senha do PostgreSQL
  DB_NAME            Nome do banco de dados
  JWT_SECRET         Chave secreta para tokens
  CORS_ORIGIN        Origem CORS permitida
  APP_PORT           Porta externa da aplicação
"
}

# ============================================
# Main
# ============================================

COMMAND=${1:-help}

case "$COMMAND" in
    setup)
        setup
        ;;
    update)
        update
        ;;
    logs)
        logs
        ;;
    logs:app)
        logs_app
        ;;
    logs:db)
        logs_db
        ;;
    status)
        status
        ;;
    restart)
        restart
        ;;
    stop)
        stop
        ;;
    backup)
        backup
        ;;
    restore)
        restore "$2"
        ;;
    health)
        health_check
        ;;
    help)
        show_help
        ;;
    *)
        log_error "Comando desconhecido: $COMMAND"
        show_help
        exit 1
        ;;
esac
