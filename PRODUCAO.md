# Guia de Produção - nfse.gov.br Nacional

Documentação para preparação, validação e deployment em produção.

## 📅 Cronograma

| Data | Evento | Status |
|------|--------|--------|
| 28 set | Desenvolvimento completo | ✅ |
| 1º out | Homologação deve estar completa | ⏳ |
| 1º nov | Go-live obrigatório (Resolução 191/2026) | ⏳ |
| 1º jan 2027 | Novos impostos (IBS/CBS) | ⏳ |

## 🎯 Checklist Pré-Produção

### Testes em Homologação (até 1º out)
- [ ] Endpoint de conectividade OK
- [ ] Primeiro envio de DPS bem-sucedido
- [ ] NFS-e gerada corretamente
- [ ] Casos extremos validados:
  - [ ] CPF vs CNPJ tomador
  - [ ] Valores mínimos e máximos
  - [ ] Com/sem alíquota
  - [ ] ISS retido
  - [ ] Simples Nacional
  - [ ] Múltiplos municípios
- [ ] Erros tratados adequadamente
- [ ] Certificado validado
- [ ] Respostas parsing OK

### Dados e Configuração
- [ ] Novo campo `padraoIntegracao` em Emissor
- [ ] Novo campo `versaoLayout` em Emissor
- [ ] Novo campo `municipioCodigoIbge` em Emissor
- [ ] Migrate dados existentes (se necessário)
- [ ] Backup de dados críticos

### Documentação
- [ ] Instruções de uso atualizadas
- [ ] Treinamento para operadores
- [ ] Plano de rollback preparado
- [ ] Monitoramento configurado

### Infraestrutura
- [ ] Certificados de produção obtidos/installados
- [ ] URLs de produção validadas
- [ ] mTLS funciona em produção
- [ ] Logs e monitoramento OK
- [ ] Plano de suporte 24/7

## 🔄 Migração de Dados

### Emissores Existentes (Foz)

```sql
-- Manter compatibilidade: emissores antigos continuam com padrão Foz
UPDATE emissor 
SET padraoIntegracao = 'foz-iguacu'
WHERE padraoIntegracao IS NULL 
  AND ambiente = '2'; -- Apenas em homologação inicialmente

-- Migrar para nacional quando pronto
UPDATE emissor 
SET padraoIntegracao = 'nfse-gov-br'
WHERE cnpj = '...'; -- Por ID específico
```

### NFS-e Históricas

- **Foz**: Continue usando padrão antigo
- **Nacional**: Novas emissões usam nfse.gov.br
- **Híbrido**: Sistema suporta ambos em paralelo

## 🚀 Deploy em Produção

### 1. Preparação
```bash
# Verificar ambiente
npm run test-casos-extremos
npm run test-homologacao

# Backup
pg_dump nfse > backup-$(date +%Y%m%d).sql

# Build
npm run build
```

### 2. Validação Pré-Deploy
```bash
# Testes de integração
curl -X POST https://www.nfse.gov.br/api/v1/contribute/issqn/health \
  --cert client-cert.pem \
  --key client-key.pem

# Verificar DNS
nslookup www.nfse.gov.br
```

### 3. Atualizar .env Produção
```env
# Manter DATABASE_URL
DATABASE_URL=postgresql://...

# Padrão nacional
NFSE_PADRAO=nfse-gov-br

# Novos campos (se houver)
# (adicionar conforme necessário)
```

### 4. Deploy
```bash
# Migrar schema
cd backend
npx prisma db push  # Aplica novos campos

# Restart servidor
systemctl restart nfse-nacional
# ou
docker-compose restart backend
```

### 5. Validação Pós-Deploy
```bash
# Health check
curl https://seu-dominio/health

# Testar emissor em produção
node test-homologacao-completo.js
# (com emissor prod e certificado prod)

# Verificar logs
tail -f /var/log/nfse-nacional/app.log
```

## 📊 Monitoramento em Produção

### Métricas Críticas
- Latência de envio de DPS (< 10s)
- Taxa de sucesso de emissão (> 99%)
- Erros de conectividade (< 0.1%)
- Tempo de resposta da API (< 5s)

### Alertas Configurar
```
- Status: nfse.gov.br offline
- Taxa de erro > 5%
- Latência > 15s
- Certificado próximo de expirar (< 30 dias)
```

### Logs Monitorar
```
[ERROR] Falha ao enviar DPS
[WARN] Certificado expirando em 30 dias
[ERROR] Timeout conectando nfse.gov.br
[WARN] mTLS handshake failure
```

## 🛠️ Troubleshooting

### Problema: "Certificate verify failed"
**Causa**: Certificado inválido ou expirado
**Solução**:
1. Verificar data de validade: `openssl x509 -in cert.pem -noout -dates`
2. Renovar certificado se expirado
3. Em DEV: `rejectUnauthorized: false`

### Problema: "Connection timeout"
**Causa**: Rede ou DNS
**Solução**:
1. Testar DNS: `nslookup www.nfse.gov.br`
2. Testar ping: `ping www.nfse.gov.br`
3. Verificar firewall

### Problema: "400 Bad Request"
**Causa**: Dados inválidos na DPS
**Solução**:
1. Rodar validação: `validarDpsNfseCentral(nota, emissor)`
2. Verificar campos obrigatórios
3. Consultar logs de erro estruturados

### Problema: "503 Service Unavailable"
**Causa**: Servidor nfse.gov.br temporariamente offline
**Solução**:
1. Aguardar
2. Implementar retry com backoff exponencial
3. Alertar usuário para retentar depois

## 📝 Respostas Esperadas

### Sucesso (201 Created)
```json
{
  "numeroNfse": "123456",
  "codigoVerificacao": "ABC123DEF",
  "chaveAcesso": "CHV...",
  "dataAutorizacao": "2026-11-01T10:30:00Z",
  "status": "PROCESSADO"
}
```

### Erro Validação (400 Bad Request)
```json
{
  "erros": [
    {
      "codigo": "E001",
      "descricao": "Campo obrigatório ausente",
      "campo": "codigoMunicipio"
    }
  ]
}
```

### Erro Servidor (500)
```json
{
  "erro": "Erro interno do servidor",
  "codigo": "ERRO_INTERNO"
}
```

## 🔐 Segurança

### Certificado Digital
- Tipo: ICP-Brasil A1
- Armazenar em .pfx protegido
- Senha em variável de ambiente
- Nunca fazer commit de certificado

### Dados Sensíveis
- CNPJ: PII - proteger
- Certificado: privado - proteger
- Senhas: env vars only

### Logs
- NÃO incluir certificado em logs
- NÃO incluir senha em logs
- NÃO incluir dados sensíveis inteiros
- Incluir apenas hash/máscara

## 📞 Suporte

### Contatos
- **Receita Federal**: https://www.gov.br/nfse/
- **Documentação**: https://www.gov.br/nfse/pt-br/biblioteca
- **Status**: https://www.nfse.gov.br/PainelNacional/

### Escalação
1. Verificar status de nfse.gov.br
2. Validar certificado
3. Testar conectividade
4. Revisar logs
5. Contactar suporte Receita se necessário

## ✅ Checklist Final

Antes de go-live em 1º novembro:

- [ ] Testes em homologação OK
- [ ] Dados migrados corretamente
- [ ] Certificados de produção instalados
- [ ] Monitoramento configurado
- [ ] Alertas funcionando
- [ ] Runbook de incidents preparado
- [ ] Suporte 24/7 ativo
- [ ] Comunicação com usuários
- [ ] Rollback plan pronto
- [ ] Validação final com dados reais

## 📈 Pós Go-Live

### Primeiros Dias
- Monitorar alertas continuamente
- Validar respostas de nfse.gov.br
- Acompanhar taxa de sucesso
- Estar preparado para rollback

### Primeira Semana
- Testar todos os cenários
- Validar arquivos enviados
- Confirmar NFS-e geradas
- Recolher feedback de usuários

### Primeiro Mês
- Estabilidade confirmada
- Métricas normalizadas
- Documentação atualizada
- Planos de scaling se necessário

---

**Status**: Pronto para homologação ✅
**Próximo**: Validação em nfse.gov.br produção
**Deadline**: 1º novembro de 2026 (obrigatório)
