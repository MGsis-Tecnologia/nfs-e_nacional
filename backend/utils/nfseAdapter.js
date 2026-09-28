// Adaptador que escolhe entre diferentes sistemas de NFS-e
// Suporta: SOAP (Foz do Iguaçu) e REST (nfse.gov.br nacional)

import * as nfseFozSoap from './nfseFozSoap.js';
import * as nfseCentralRest from './nfseCentralApi.js';

/**
 * Determina qual adaptador usar baseado na configuração do emissor
 * @param {object} emissor - Dados do emissor (com campo padraoIntegracao)
 * @returns {string} Tipo de integração: "nfse-gov-br" | "foz-iguacu"
 */
export function obterTipoIntegracao(emissor) {
  // Se não especificado ou vazio, usar novo padrão nacional
  if (!emissor?.padraoIntegracao) {
    return 'nfse-gov-br';
  }
  return emissor.padraoIntegracao;
}

/**
 * Valida uma RPS/DPS antes de envio, conforme o sistema configurado
 * @param {object} nota - Dados da nota (RPS/DPS)
 * @param {object} emissor - Dados do emissor
 * @returns {array} Array de erros (vazio = válido)
 */
export function validarEmissao(nota, emissor) {
  const tipoIntegracao = obterTipoIntegracao(emissor);

  if (tipoIntegracao === 'nfse-gov-br') {
    return validarDpsNfseCentral(nota, emissor);
  } else {
    return validarRpsFoz(nota, emissor);
  }
}

/**
 * Assina e envia uma RPS/DPS conforme o sistema configurado
 * @param {object} nota - Dados da nota
 * @param {object} emissor - Dados do emissor
 * @param {object} certConfig - Configuração do certificado
 * @returns {Promise<{ statusText, responseObj }>}
 */
export async function assinarEEnviar(nota, emissor, certConfig) {
  const tipoIntegracao = obterTipoIntegracao(emissor);

  if (tipoIntegracao === 'nfse-gov-br') {
    return assinarEEnviarNfseCentral(nota, emissor, certConfig);
  } else {
    return nfseFozSoap.assinarEEnviar(nota, emissor, certConfig);
  }
}

// ============ Validações ============

function validarRpsFoz(nota, emissor) {
  // Reutiliza validações existentes de Foz
  return nfseFozSoap.validarEmissao(nota, emissor);
}

function validarDpsNfseCentral(nota, emissor) {
  const erros = [];

  // Validações básicas (comuns a ambos os sistemas)
  if (!emissor?.cnpj || !emissor?.inscricaoMunicipal) {
    erros.push("Configurações do emissor incompletas (CNPJ/Inscrição Municipal).");
  }
  if (!nota.numeroRps) {
    erros.push("Número do RPS/DPS é obrigatório.");
  }
  if (!nota.servico?.codigoTributacaoMunicipio && !nota.servico?.codigoServico) {
    erros.push("Código de Serviço é obrigatório.");
  }
  if (!(parseFloat(String(nota.servico?.valorServicos ?? '').replace(',', '.')) > 0)) {
    erros.push("Valor dos Serviços deve ser maior que zero.");
  }
  if (!nota.tomador?.cpfCnpj) {
    erros.push("CPF/CNPJ do Tomador é obrigatório.");
  }
  if (!nota.tomador?.razaoSocial) {
    erros.push("Razão Social do Tomador é obrigatória.");
  }

  // Endereço do tomador (obrigatório no padrão nacional)
  const end = nota.tomador?.endereco || {};
  if (!end.logradouro) {
    erros.push("Logradouro do Tomador é obrigatório.");
  }
  if (!end.numero) {
    erros.push("Número do endereço do Tomador é obrigatório.");
  }
  if (!end.bairro) {
    erros.push("Bairro do Tomador é obrigatório.");
  }
  if (!end.cep || String(end.cep).replace(/\D/g, '').length !== 8) {
    erros.push("CEP do Tomador é obrigatório (8 dígitos).");
  }

  // Validações específicas ao padrão nacional
  if (emissor.optanteSimplesNacional === '1') {
    const regimeNum = parseInt(emissor.regimeEspecialTributacao, 10);
    if (![5, 6].includes(regimeNum)) {
      erros.push("Optante Simples Nacional: Regime Especial deve ser 5 (MEI) ou 6 (ME/EPP).");
    }
  }

  return erros;
}

// ============ Envio ============

async function assinarEEnviarNfseCentral(nota, emissor, certConfig) {
  if (!certConfig?.pfxBase64) {
    throw new Error("Certificado digital não configurado.");
  }

  // TODO: Implementar geração de DPS em XML (será feito em próxima etapa)
  // Por enquanto, retornar estrutura de erro indicando que não está pronto
  const statusText = 'Erro';
  const responseObj = {
    success: false,
    error: 'Integração com nfse.gov.br ainda em desenvolvimento',
    mensagens: [{
      codigo: 'DEV_PENDING',
      mensagem: 'Geração de DPS em XML para nfse.gov.br será implementada em breve',
      correcao: 'Aguarde próximas releases'
    }],
    nota: nota.id
  };

  return { statusText, responseObj };
}

export { nfseFozSoap, nfseCentralRest };
