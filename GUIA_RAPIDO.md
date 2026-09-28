# 🚀 Guia Rápido - Sistema NFS-e Nacional

## ✅ Sistema Rodando

```
Backend:  http://localhost:3001
Frontend: http://localhost:3000 (ou 3001)
```

---

## 📋 1º USO - SETUP INICIAL

### Passo 1: Acessar o Sistema
1. Abra: `http://localhost:3000` ou `http://localhost:3001`
2. Clique em **"Configurar Banco de Dados"**

### Passo 2: Conectar ao Banco
```
Host: localhost
Porta: 5432
Usuário: seu_usuario_postgres
Senha: sua_senha
Banco: nfse
```

Clique **"Testar Conexão"** → **"Próximo"**

### Passo 3: Criar Usuário Admin
```
Usuário: admin
Senha: admin123
```

Clique **"Criar Admin"** → **"Entrar"**

---

## 🔐 2º - LOGIN

Depois do setup:
```
Usuário: admin
Senha: admin123
```

---

## 🏢 3º - CADASTRAR EMPRESA

1. **Clique em "Emissores"** (lado esquerdo)
2. **Clique em "Novo Emissor"**
3. **Preencha os dados:**

```
Ambiente:                Homologação (Testes)
Padrão de Integração:    🌐 NFS-e Nacional (nfse.gov.br)
Versão Layout:           NT-004 v2.00
CNPJ:                    11.222.333/0001-81
Inscrição Municipal:     123456789
Razão Social:            Sua Empresa LTDA
Nome Fantasia:           Sua Empresa
CNAE:                    6209100
Optante Simples:         Sim ou Não (conforme sua empresa)
Regime Especial:         0 (ou outro se aplicável)

Código IBGE Município:   4106902 (Curitiba)
Nome Município:          Curitiba

Endereço:
  CEP:                   80010-000
  Logradouro:            Rua/Avenida
  Número:                123
  Bairro:                Centro
  UF:                    PR
  
Contato:
  Telefone:              (41) 3333-4444
  Email:                 seu@email.com
```

4. Clique **"Salvar Emissor"**

---

## 🔒 4º - CARREGAR CERTIFICADO DIGITAL

Após criar a empresa:

1. **Vá para a aba "Token & Certificado"**
2. **Selecione arquivo .pfx/.p12** (seu certificado digital)
3. **Informe a senha do certificado**
4. Clique **"Salvar Certificado"**

✅ Pronto! Certificado carregado.

---

## 📝 5º - CRIAR NOTA (RPS/DPS)

1. **Clique em "Criar Nota"** (ou "Novo RPS" no Dashboard)
2. **Preencha os dados:**

### Dados da Nota:
```
Número RPS:            1
Série:                 1
Número Lote:           1
Data Emissão:          (hoje)
Competência:           (mês atual, ex: 2026-09)
```

### Dados do Tomador (Cliente):
```
CPF/CNPJ:              12.345.678/0001-90
Razão Social:          Cliente Empresa LTDA

Endereço Tomador:
  Logradouro:          Rua Cliente
  Número:              456
  Bairro:              Bairro
  Código IBGE:         4106902 (⚠️ OBRIGATÓRIO em nfse.gov.br)
  UF:                  PR
  CEP:                 80010-000
```

### Dados do Serviço:
```
Item Lista Serviço:    01.07
Código Tributação:     080502
Código IBGE Serviço:   4106902 (⚠️ OBRIGATÓRIO em nfse.gov.br)
Discriminação:         Consultoria empresarial
Valor Serviços:        100.00
Alíquota:              3.00
ISS Retido:            Não (ou Sim se aplicável)
```

3. Clique **"Salvar Rascunho"**

---

## 📤 6º - ENVIAR NOTA

1. **Vá para "Minhas Notas"**
2. **Encontre a nota com status "Rascunho"**
3. **Clique em "Enviar"** (botão de papel aviãozinho)
4. **Aguarde o resultado:**

### ✅ SUCESSO
```
Status: Processado
NFS-e: 123456
Código Verificação: ABC123DEF
Chave Acesso: CHV...
```

### ❌ ERRO
```
Verifique a mensagem de erro
Corrija os dados
Tente novamente
```

---

## 🔍 TESTAR CONECTIVIDADE

Antes de enviar, você pode testar:

1. **Vá para "Configurações"**
2. **Seção "Teste de Integração"**
3. Clique **"Validar Conectividade"**

✅ Se passar = pronto para enviar  
❌ Se falhar = verifique internet e certificado

---

## 🧪 TESTES AUTOMATIZADOS

Se preferir testar via CLI:

```bash
cd backend

# Teste rápido (5 min)
node test-homologacao.js

# Teste interativo (escolher enviar ou simular)
node test-homologacao-completo.js

# Teste casos extremos
node test-casos-extremos.js
```

---

## 📊 ACOMPANHAR EMISSÕES

1. **Dashboard**
   - Ver métricas (total, sucesso, erro, rascunho)
   - Ações rápidas

2. **Minhas Notas**
   - Lista de todas as notas
   - Status de cada uma
   - Opções (editar, enviar, baixar PDF, remover)

3. **Configurações**
   - Ver padrão de integração
   - Testar conectividade
   - Gerenciar certificado

---

## 🎯 FLUXO RESUMIDO

```
1. Setup Banco de Dados
   ↓
2. Criar Admin
   ↓
3. Login
   ↓
4. Cadastrar Empresa
   ↓
5. Carregar Certificado
   ↓
6. Criar Nota
   ↓
7. Enviar para nfse.gov.br
   ↓
8. ✅ NFS-e Gerada!
```

---

## 💡 DICAS

### Dados de Teste Rápido
```
Código IBGE:          4106902 (Curitiba)
CPF Teste:            12345678901
CNPJ Teste:           11222333000181
Valor Mínimo:         0.01
Valor Máximo:         999999.99
```

### Erros Comuns

| Erro | Solução |
|------|---------|
| "Código IBGE obrigatório" | Preencher código município do tomador |
| "CEP inválido" | Usar 8 dígitos sem formatação |
| "Certificado não configurado" | Carregar .pfx/.p12 válido |
| "Conexão timeout" | Verificar internet e firewall |

### Shortcuts
- **Ctrl+S**: Salvar (em formulários)
- **Esc**: Cancelar/Voltar
- **Enter**: Enviar (em alguns campos)

---

## 🚨 SUPORTE RÁPIDO

**Problema?**
1. Consulte HOMOLOGACAO.md (guia completo)
2. Rode test-homologacao.js (validar setup)
3. Verifique logs no terminal do backend

**Dúvida?**
1. Veja FRONTEND_MELHORIAS.md (UI em construção)
2. Leia PRODUCAO.md (preparação)

---

## 📞 PRÓXIMOS PASSOS

### Hoje/Esta Semana
- [x] Setup banco
- [x] Criar usuário
- [x] Cadastrar empresa
- [x] Testar conectividade

### Próxima Semana
- [ ] Enviar 1ª nota real
- [ ] Validar NFS-e gerada
- [ ] Testar casos extremos

### Antes de Produção (1º nov)
- [ ] Homologação completa
- [ ] Certificado de produção
- [ ] Deploy em produção

---

**Bem-vindo ao novo sistema de NFS-e Nacional!** 🎉

Qualquer dúvida, consulte a documentação completa em:
- HOMOLOGACAO.md (testes)
- PRODUCAO.md (produção)
- FRONTEND_MELHORIAS.md (desenvolvimento)

**Bom uso!** ✨
