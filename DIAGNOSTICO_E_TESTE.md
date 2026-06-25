# Diagnóstico e Teste - NFSe Foz do Iguaçu

## 🔍 Status Atual

```
✅ Ambiente: HOMOLOGAÇÃO (0)
✅ Certificado: VAZIO (aguardando upload)
✅ Configurações: CARREGADAS
```

---

## 📋 Checklist - O que Fazer Agora

### 1️⃣ **Verifique o Ambiente**

**Abra:** http://localhost:3000 → Configurações

Verifique:
- ✅ **Ambiente:** Deve estar em **"Homologação"** (não Produção)
- ✅ **Certificado:** Campo deve estar vazio (pronto para novo upload)
- ✅ **CNPJ:** 05375942000178
- ✅ **Inscrição Municipal:** 32569

---

### 2️⃣ **Faça Upload do Certificado VÁLIDO**

No formulário de Certificado:
1. Clique em **"Selecionar Arquivo"**
2. Escolha seu arquivo `.pfx` ou `.p12`
3. Digite a **senha correta**
4. Clique em **"Enviar Certificado"**

✅ Você deve ver: `"Certificado digital configurado e validado com sucesso!"`

---

### 3️⃣ **Teste em Homologação**

Vá para **"Novo RPS"** e crie um de teste:

**Passo 1 - Identificação:**
- Número do RPS: `1`
- Série: `1`
- Data: Hoje

**Passo 2 - Tomador:**
- CPF/CNPJ: `11.222.333/0001-81`
- Razão Social: `Empresa Teste LTDA`
- Endereço: Complete com dados

**Passo 3 - Serviço:**
- Item Serviço: `01.07`
- **Código Tributação:** `01`
- Valor: `100.00`
- Alíquota: `3.0`
- Discriminação: `Teste em homologação`

Clique em **"Salvar RPS"** → **"Enviar"**

---

## 🔬 Como Saber Se Está Enviando Para o Lugar Certo

### ✅ Homologação (URL correta)

```
https://homologacao.gestaoiss.com.br/ws/nfse.asmx
```

**Respostas esperadas:**
- ❌ Erro de certificado → OK (está contacting o servidor)
- ✅ Protocolo + NumeroNfse → SUCESSO!
- ✅ ListaMensagemRetorno com erro específico → OK (servidor respondeu)

### ❌ Produção (EVITE POR ENQUANTO)

```
https://fozdoiguacupr.gestaoiss.com.br/ws/nfse.asmx
```

⚠️ **Só use em produção após testar com sucesso em homologação!**

---

## 🛠️ Como Validar a Conectividade

### Teste 1: Verificar Endpoint de Homologação

```bash
curl -I https://homologacao.gestaoiss.com.br/ws/nfse.asmx
```

**Esperado:**
- Status: `200 OK` ou `405 Method Not Allowed` (não aceita GET, só POST)
- Conectividade: ✅ OK

### Teste 2: Verificar Backend

```bash
curl http://localhost:3001/api/settings
```

**Esperado:**
- Resposta JSON com ambiente: `"0"` (Homologação)
- Certificado: `null`

### Teste 3: Verificar Status Após Envio

Clique no ícone **código/olho** do RPS enviado e verifique:

```json
{
  "status": "Erro",  // ou "Processado"
  "result": {
    "soapResponse": "... XML da resposta ..."
  }
}
```

---

## 📊 Interpretando Respostas

### ✅ Sucesso (Homologação)

```xml
<EnviarLoteRpsSincronoResponse>
  <EnviarLoteRpsSincronoResult>
    <Protocolo>12345678</Protocolo>
    <NumeroNfse>123456</NumeroNfse>
  </EnviarLoteRpsSincronoResult>
</EnviarLoteRpsSincronoResponse>
```

**Status:** ✅ Processado
**Próximo passo:** Ativar Produção

### ⚠️ Erro de Validação

```xml
<ListaMensagemRetorno>
  <MensagemRetorno>
    <Codigo>E001</Codigo>
    <Mensagem>Código de Tributação Inválido</Mensagem>
  </MensagemRetorno>
</ListaMensagemRetorno>
```

**Status:** ❌ Erro
**O que fazer:** Ajustar o RPS conforme erro e tentar novamente

### 🔴 Erro de Certificado

```
"Unsupported PKCS12 PFX data"
```

**Status:** ❌ Erro
**O que fazer:** 
- Verifique a senha
- Tente outro certificado
- Confirme que é `.pfx` válido

---

## 🎯 Fluxo Recomendado

```
1. AGORA: Ambiente em Homologação ✅
2. HOJE: Upload certificado válido
3. HOJE: Teste 1 RPS em Homologação
4. AMANHÃ: Se sucesso, mude para Produção
5. SEMANA 1: Monitore RPS reais em Produção
```

---

## 📞 Troubleshooting

### Problema: "Sem resposta do servidor"
- ✅ Verifique se está em Homologação
- ✅ Confirme conectividade: `curl -I https://homologacao.gestaoiss.com.br/ws/nfse.asmx`
- ✅ Verifique firewall/proxy

### Problema: "Certificado inválido"
- ✅ Verifique a senha do certificado
- ✅ Confirme que é um arquivo `.pfx` válido
- ✅ Tente reconverter o certificado

### Problema: "Campo obrigatório faltando"
- ✅ Preencha TODOS os campos (Código Tributação, CPF/CNPJ, Razão Social)
- ✅ Veja a validação que aparece na interface

---

## ✨ Próximos Passos Imediatos

1. ✅ **Agora:** http://localhost:3000 → Configurações
2. ✅ **Upload:** Seu certificado `.pfx` válido
3. ✅ **Teste:** Crie 1 RPS de teste
4. ✅ **Envie:** Clique em "Enviar"
5. ✅ **Valide:** Clique no ícone código/olho

**Depois me conta qual foi a resposta!** 🚀
