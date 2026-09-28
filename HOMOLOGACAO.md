# Testes em Homologação - nfse.gov.br Nacional

Este documento descreve como testar a integração com o novo padrão nacional de NFS-e via nfse.gov.br.

## 📋 Pré-requisitos

1. **Banco de dados PostgreSQL** ativo e funcionando
2. **Emissor cadastrado** com:
   - CNPJ válido
   - Inscrição municipal
   - Certificado digital (.pfx) configurado
   - Ambiente em HOMOLOGAÇÃO (ambiente = 2)
   - Padrão integração: `nfse-gov-br`

3. **Certificado Digital** (A1 - arquivo .pfx)
   - Tipo: ICP-Brasil
   - Entidade: Pessoa Jurídica (CNPJ)
   - Válido para homologação

## 🚀 Como Fazer o Teste

### Opção 1: Script Interativo Completo (Recomendado)

```bash
cd backend
node test-homologacao-completo.js
```

Este script:
1. Lista emissores cadastrados
2. Valida o certificado
3. Verifica conectividade com nfse.gov.br
4. Testa integração mTLS
5. Prepara uma DPS de teste
6. Oferece opção de enviar ou simular

### Opção 2: Testes Automatizados Básicos

```bash
cd backend
node test-homologacao.js
```

Roda 7 testes unitários:
- ✅ Validação de dados
- ✅ Geração de XML
- ✅ Preparação de payload
- ✅ Extração de resposta
- ✅ Simulação de fluxo
- ✅ Verificação de conectividade
- ✅ Validação de padrão

### Opção 3: Endpoints HTTP de Teste

Com o servidor rodando (`npm run dev`), use estes endpoints:

#### 1. Verificar Conectividade e Certificado

```bash
curl -X POST http://localhost:3001/api/test/nfse-gov-br/validar-conectividade \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"emissorId": "<ID_EMISSOR>"}'
```

Retorna:
```json
{
  "conectividade": {
    "homologacao": { "status": true, "statusCode": 200 },
    "producao": { "status": true, "statusCode": 200 }
  },
  "certificado": {
    "valido": true,
    "certificadoInfo": { "carregado": true, "temChavePrivada": true }
  },
  "integracao": { "sucesso": true, ... }
}
```

#### 2. Simular Fluxo de Envio

```bash
curl -X POST http://localhost:3001/api/test/nfse-gov-br/simular-dps \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "emissorId": "<ID_EMISSOR>",
    "notaData": {
      "numeroRps": "999",
      "numeroLote": "1",
      "serieRps": "1",
      "dataEmissao": "2026-09-28T10:00:00Z",
      "competencia": "2026-09",
      "tomador": {
        "cpfCnpj": "11222333000181",
        "razaoSocial": "Empresa Teste LTDA",
        "endereco": {
          "logradouro": "Rua Teste",
          "numero": "123",
          "bairro": "Centro",
          "codigoMunicipio": "4106902",
          "uf": "PR",
          "cep": "80010000"
        }
      },
      "servico": {
        "codigoMunicipio": "4106902",
        "codigoTributacaoMunicipio": "080502",
        "discriminacao": "Teste",
        "valorServicos": "100.00",
        "aliquota": "3.00"
      }
    }
  }'
```

#### 3. Enviar DPS Real para Homologação

⚠️ **USE COM CUIDADO** - Isso realmente envia para nfse.gov.br!

```bash
curl -X POST http://localhost:3001/api/test/nfse-gov-br/enviar-dps \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "emissorId": "<ID_EMISSOR>",
    "notaId": "<ID_NOTA_NO_BANCO>"
  }'
```

## 🔍 Fluxo de Teste Recomendado

### Fase 1: Validação (sem enviar dados)
1. Rodar `test-homologacao.js` - testes básicos
2. Rodar `test-homologacao-completo.js` e escolher **opção 2** (simular)
3. Verificar se geração de DPS está OK

### Fase 2: Teste de Conectividade
1. Chamar endpoint `/api/test/nfse-gov-br/validar-conectividade`
2. Verificar:
   - Conectividade OK
   - Certificado válido
   - mTLS funcionando

### Fase 3: Primeiro Envio
1. Rodar `test-homologacao-completo.js` e escolher **opção 1**
2. Acompanhar logs
3. Verificar resposta de sucesso
4. Conferir NFS-e gerada (if success)

### Fase 4: Testes Adicionais
- [ ] Diferentes valores de serviço
- [ ] Tomadores com CPF vs CNPJ
- [ ] Serviços com e sem ISS retido
- [ ] Múltiplos emissores
- [ ] Testes de erro (dados inválidos)

## 📊 Arquivos de Log

Os testes geram logs estruturados:

```
========== ENVIANDO DPS PARA NFSE.GOV.BR (HOMOLOGAÇÃO) ==========
✅ DPS enviada com sucesso. Status: 201
✅ NFS-e nº 123456 (verificação ABC123DEF)
```

## 🐛 Troubleshooting

### Erro: "Certificado digital não configurado"
- Verificar se emissor tem certificado .pfx carregado
- Verificar se certPassword está correto

### Erro: "Código IBGE do município é obrigatório"
- Adicionar `codigoMunicipio` nos dados do tomador
- Adicionar `codigoMunicipio` nos dados do serviço

### Erro: "Não foi possível conectar a homologação"
- Verificar conexão de internet
- Testar conectividade: `curl https://www.producaorestrita.nfse.gov.br`
- Verificar se mTLS está correto

### Erro de mTLS: "certificate verify failed"
- Certificado pode ter expirado
- Tentar com `rejectUnauthorized: false` (apenas em DEV!)
- Conferir se certificado é válido para homologação

## 📚 Próximos Passos

1. **Validar respostas reais** da API em homologação
2. **Testes de carga** - enviar múltiplas DPS
3. **Teste de erro** - validar tratamento de erros
4. **Homologação oficial** junto à Receita Federal (se necessário)
5. **Preparar para produção** - documentação e treinamento

## 🔗 Recursos Úteis

- Portal nfse.gov.br: https://www.nfse.gov.br
- Swagger API: https://www.producaorestrita.nfse.gov.br/swagger/contribuintesissqn
- Documentação: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica
- Manual: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual

## ⚙️ Variáveis de Ambiente

```env
# Padrão de integração (já definido no .env)
NFSE_PADRAO=nfse-gov-br

# URLs (automáticas, não precisam ser alteradas)
# Homologação: https://www.producaorestrita.nfse.gov.br/api/v1/contribute/issqn
# Produção: https://www.nfse.gov.br/api/v1/contribute/issqn
```

## ❓ Perguntas Frequentes

**P: Preciso de autorização da Receita para testar?**
A: Não. Homologação é um ambiente de teste sem validade legal. Pode enviar dados de teste livremente.

**P: As NFS-e de teste aparecem na nota fiscal real?**
A: Não. Dados de homologação não afetam sistema de produção.

**P: Posso testar sem certificado?**
A: Não. Certificado digital é obrigatório para autenticação mTLS e assinatura de DPS.

**P: Quanto tempo leva para gerar uma NFS-e?**
A: Normalmente segundos em homologação. Em produção pode levar alguns minutos.

---

**Status**: Pronto para testes de homologação ✅
**Última atualização**: 2026-09-28
**Próximo milestone**: Produção (antes de 1º novembro de 2026)
