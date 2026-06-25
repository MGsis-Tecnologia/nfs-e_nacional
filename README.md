# Emissor Local de RPS NFS-e - Foz do Iguaçu (GestãoISS)

Esta é uma aplicação local desenvolvida com **React (Vite)** e **Node.js (Express)** para a geração, assinatura digital (ICP-Brasil) e envio de lotes de Recibo Provisório de Serviços (RPS) de NFS-e seguindo o padrão ABRASF v2.02 do município de Foz do Iguaçu.

## Funcionalidades
- **Configurações do Emissor**: Armazenamento seguro dos dados fiscais do prestador.
- **Upload do Certificado Digital A1**: Carregamento local do certificado `.p12`/`.pfx` com autenticação mútua SSL (HTTPS com certificado de cliente) para transmissão direta.
- **Gerenciador de RPS**: CRUD completo e intuitivo para elaborar novos recibos provisórios.
- **Visualizador de Payloads**: Inspeção detalhada em abas do XML estruturado, XML assinado digitalmente, envelope SOAP transmitido e retorno SOAP bruto recebido do provedor GestãoISS.

---

## Como Executar a Aplicação

### 1. Iniciar os Servidores Concorrentes
Abra o terminal na pasta raiz do projeto (`d:\Nfs-e`) e execute o script de desenvolvimento:
```bash
npm run dev
```

Este comando utilizará a biblioteca `concurrently` para rodar simultaneamente:
*   **Frontend (Vite):** `http://localhost:3000`
*   **Backend (Express):** `http://localhost:3001` (com proxy configurado no Vite)

---

## Fluxo de Configuração e Uso

1.  **Acesse a aba "Configurações":**
    *   Cadastre as informações da sua empresa (CNPJ, Inscrição Municipal, CNAE, Simples Nacional, Regime de Tributação, Endereço).
    *   Selecione o ambiente de operação (**Homologação** ou **Produção**).
    *   Faça o upload do seu certificado digital **.p12** ou **.pfx** e insira a senha para validar localmente.
2.  **Crie um RPS na aba "Novo RPS":**
    *   Siga as 3 etapas intuitivas (Identificação do RPS, Tomador/Cliente e Serviço/Valores).
    *   Ao salvar, o RPS constará como status `Rascunho` na listagem de notas.
3.  **Gerencie e Transmita na aba "Relação de Notas":**
    *   Clique no botão **"Enviar"** para realizar o processo automático: *geração do XML -> assinatura digital das tags (Lote e RPS) -> encapsulamento SOAP -> postagem no WebService da prefeitura*.
    *   Selecione o ícone de **código/olho** para analisar a resposta XML ou os logs detalhados do servidor em tempo real.
