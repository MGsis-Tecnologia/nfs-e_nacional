# Guia de Teste em Homologação

## 🔧 Antes de Ir para Produção - Teste Completo

### Passo 1: Configure o Ambiente de Homologação

1. Abra a aplicação (`npm run dev`)
2. Vá para **Configurações**
3. Selecione **Ambiente:** `Homologação`
4. Preencha os dados da sua empresa:
   - CNPJ: seu CNPJ real
   - Inscrição Municipal: sua IM de Foz do Iguaçu
   - CNAE: seu código CNAE
   - Regime: Simplesmente Nacional? (Sim/Não)
5. Upload do certificado `.p12` com senha
6. Clique em **Salvar**

---

### Passo 2: Crie um RPS de Teste

1. Vá para **Novo RPS**
2. **Aba 1 - Identificação:**
   - Número do RPS: `1` (primeiro)
   - Série: `1`
   - Data de Emissão: hoje
   - Competência: `2024-06`

3. **Aba 2 - Tomador/Cliente:**
   - CNPJ/CPF: `11.222.333/0001-81` (CNPJ teste)
   - Razão Social: `Empresa Teste LTDA`
   - Endereço:
     - Logradouro: `Rua das Flores`
     - Número: `123`
     - Bairro: `Centro`
     - CEP: `85850-000`
     - Município: `4108304` (Foz do Iguaçu)
     - UF: `PR`

4. **Aba 3 - Serviço/Valores:**
   - Item da Lista: `14.01` (Serviços de programação)
   - **Código de Tributação Municipal:** `01` (IMPORTANTE! Ajuste conforme sua prefeitura)
   - Discriminação: `Serviço de desenvolvimento de software`
   - Valor dos Serviços: `1.000,00`
   - Alíquota ISS: `3,0000` (3%)
   - Outros valores: deixe em branco (zero)

5. Clique em **Salvar**

---

### Passo 3: Envie o RPS

1. Na aba **Relação de Notas**, localize o RPS que acabou de criar
2. Status deve estar como `Rascunho`
3. Clique no botão **Enviar**
4. Aguarde resposta (pode levar alguns segundos)

---

### Passo 4: Analise a Resposta

1. Clique no ícone de **código/olho** ao lado do RPS
2. Verifique as abas:
   - **XML Gerado:** veja a estrutura
   - **XML Assinado:** confirmação de assinatura digital
   - **Envelope SOAP:** conteúdo enviado
   - **Resposta SOAP:** resposta da prefeitura

---

## ✅ Respostas Esperadas em Homologação

### Sucesso ✅
```
Status: Processado

Resposta contém:
- <Protocolo>: número do protocolo
- <NumeroNfse>: número da NFS-e gerada
- <ChaveAcesso>: chave de acesso nacional
```

### Erro ❌
```
Status: Erro

Resposta contém:
- <ListaMensagemRetorno>
- <MensagemRetorno>
  - <Codigo>: código do erro
  - <Mensagem>: descrição do erro
```

---

## 🔍 Erros Comuns em Homologação

| Erro | Causa | Solução |
|------|-------|---------|
| `Código de Tributação Inválido` | Código errado para seu serviço | Valide o código com a prefeitura |
| `CNPJ Inválido` | Formatação errada | Use apenas números: `11222333000181` |
| `Certificado Inválido` | Senha errada ou arquivo corrompido | Revise a senha e re-upload o cert |
| `Assinatura Inválida` | Problema na assinatura digital | Verifique se o certificado é válido |
| `Campo Obrigatório Faltando` | Razão Social, CPF/CNPJ do Tomador, etc. | Preencha todos os campos obrigatórios |

---

## ✨ Checklist Final Antes de Produção

- [ ] RPS enviado com sucesso em **Homologação**
- [ ] Recebeu `Protocolo` na resposta
- [ ] Recebeu `NumeroNfse` na resposta
- [ ] Resposta contém `ChaveAcesso` válida
- [ ] XML Assinado foi gerado corretamente
- [ ] Certificado digital está carregado e validado
- [ ] Todas as configurações da empresa estão preenchidas
- [ ] Código de Tributação Municipal foi validado com a prefeitura
- [ ] Testou com pelo menos 3 RPS diferentes

---

## 🚀 Mudando para Produção

Quando tudo estiver funcionando em Homologação:

1. **Configurações** → Ambiente: `Produção`
2. **URL muda automaticamente para:** `https://fozdoiguacupr.gestaoiss.com.br/ws/nfse.asmx`
3. **Crie um novo RPS** em produção
4. **Envie** e analise a resposta
5. **Sucesso!** 🎉

---

## 📞 Suporte

Se encontrar problemas em homologação:
1. Verifique a **Resposta SOAP** (aba código/olho)
2. Procure a mensagem de erro específica
3. Consulte o manual ABRASF (incluído no projeto)
4. Contate a [Prefeitura de Foz do Iguaçu](https://fozdoiguacupr.gestaoiss.com.br/)

**Boa sorte! 🚀**
