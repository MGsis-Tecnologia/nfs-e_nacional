// Gerador de DPS (Documento de Prestação de Serviço) para nfse.gov.br
// DPS é o documento intermediário que será convertido em NFS-e pelo Ambiente Nacional

import { generateRpsXml, formatDecimal, formatDate } from './xmlGenerator.js';

/**
 * Gera uma DPS completa (XML assinado) para nfse.gov.br
 * @param {object} nota - Dados da nota (com mesma estrutura de RPS)
 * @param {object} emissor - Configurações do emissor
 * @returns {object} { dpsXml, dpsId, numeroSequencial, metadados }
 */
export function gerarDpsXmlNfseCentral(nota, emissor) {
  // Gera XML usando o padrão nfse-gov-br
  const { xml, loteId, rpsId, versao } = generateRpsXml(nota, emissor, {
    padrao: 'nfse-gov-br',
    versaoLayout: emissor.versaoLayout || '2.00'
  });

  // Adicionar metadados úteis para rastreamento
  const metadados = {
    cnpj: emissor.cnpj,
    dataGeracao: formatDate(new Date().toISOString()),
    numeroRps: nota.numeroRps,
    numeroLote: nota.numeroLote,
    codigoMunicipioTomador: nota.tomador?.endereco?.codigoMunicipio,
    codigoMunicipioServico: nota.servico?.codigoMunicipio,
    valorServico: nota.servico?.valorServicos,
    aliquota: nota.servico?.aliquota,
    paisDestino: nota.tomador?.endereco?.pais || 'BR',
    tipoDocumento: 'DPS',
    padraoIntegracao: 'nfse-gov-br',
    versaoLayout: emissor.versaoLayout || '2.00'
  };

  return {
    dpsXml: xml,
    dpsId: rpsId,
    loteId: loteId,
    numeroSequencial: nota.numeroRps,
    versao: versao,
    metadados: metadados,
    tipoDocumento: 'DPS'
  };
}

/**
 * Valida se uma DPS tem todos os dados obrigatórios para nfse.gov.br
 * Retorna array de erros (vazio = válida)
 */
export function validarDpsNfseCentral(nota, emissor) {
  const erros = [];

  // Dados do emissor
  if (!emissor.cnpj) erros.push('CNPJ do emissor obrigatório');
  if (!emissor.inscricaoMunicipal) erros.push('Inscrição municipal do emissor obrigatória');

  // Dados da DPS
  if (!nota.numeroRps) erros.push('Número do RPS/DPS obrigatório');
  if (!nota.numeroLote) erros.push('Número do lote obrigatório');

  // Serviço
  if (!nota.servico) {
    erros.push('Dados do serviço obrigatórios');
  } else {
    const valorServico = parseFloat(String(nota.servico.valorServicos || '').replace(',', '.'));
    if (isNaN(valorServico) || valorServico <= 0) {
      erros.push('Valor do serviço deve ser maior que zero');
    }

    if (!nota.servico.codigoTributacaoMunicipio && !nota.servico.itemListaServico) {
      erros.push('Código de Tributação Municipal ou Item da Lista de Serviço obrigatório');
    }

    if (!nota.servico.discriminacao) {
      erros.push('Descrição/Discriminação do serviço obrigatória');
    }

    // Código de município do serviço (OBRIGATÓRIO em nfse.gov.br)
    if (!nota.servico.codigoMunicipio) {
      erros.push('Código IBGE do município (onde o serviço foi prestado) é obrigatório');
    }
  }

  // Tomador
  if (!nota.tomador) {
    erros.push('Dados do tomador obrigatórios');
  } else {
    if (!nota.tomador.cpfCnpj) {
      erros.push('CPF/CNPJ do tomador obrigatório');
    }

    if (!nota.tomador.razaoSocial) {
      erros.push('Razão Social/Nome do tomador obrigatório');
    }

    // Endereço do tomador
    const endereco = nota.tomador.endereco || {};
    if (!endereco.logradouro) erros.push('Logradouro do tomador obrigatório');
    if (!endereco.numero) erros.push('Número do endereço do tomador obrigatório');
    if (!endereco.bairro) erros.push('Bairro do tomador obrigatório');

    if (!endereco.cep) {
      erros.push('CEP do tomador obrigatório');
    } else if (String(endereco.cep).replace(/\D/g, '').length !== 8) {
      erros.push('CEP deve conter 8 dígitos');
    }

    // Código de município do tomador (OBRIGATÓRIO em nfse.gov.br)
    if (!endereco.codigoMunicipio) {
      erros.push('Código IBGE do município do tomador é obrigatório');
    }

    if (!endereco.uf) {
      erros.push('UF do tomador obrigatório');
    }
  }

  // Validações específicas de Simples Nacional
  if (emissor.optanteSimplesNacional === '1') {
    const regimeNum = parseInt(emissor.regimeEspecialTributacao, 10);
    if (![5, 6].includes(regimeNum)) {
      erros.push('Optante Simples Nacional deve ter Regime Especial 5 (MEI) ou 6 (ME/EPP)');
    }
  }

  return erros;
}

/**
 * Prepara payload JSON para envio à API REST do nfse.gov.br
 * @param {string} dpsXmlAssinado - XML assinado digitalmente
 * @param {object} metadados - Informações adicionais da DPS
 * @returns {object} Payload estruturado
 */
export function prepararPayloadNfseCentral(dpsXmlAssinado, metadados) {
  return {
    xmlDPS: dpsXmlAssinado,
    cnpj: metadados.cnpj?.replace(/\D/g, ''),
    numeroRps: metadados.numeroRps,
    numeroLote: metadados.numeroLote,
    codigoMunicipio: metadados.codigoMunicipioServico,
    // Campos opcionais para tracking
    ...(metadados.dataGeracao ? { dataGeracaoDps: metadados.dataGeracao } : {}),
    ...(metadados.paisDestino ? { paisDestino: metadados.paisDestino } : {}),
    ...(metadados.versaoLayout ? { versaoLayout: metadados.versaoLayout } : {})
  };
}

/**
 * Extrai informações da resposta de envio de DPS
 * @param {object} responseData - Resposta da API do nfse.gov.br
 * @returns {object} { numeroNfse, codigoVerificacao, dataAutorizacao, status }
 */
export function extrairDadosNfseResposta(responseData) {
  if (!responseData) return {};

  return {
    numeroNfse: responseData.numeroNfse || responseData.nfse?.numero,
    codigoVerificacao: responseData.codigoVerificacao || responseData.nfse?.codigoVerificacao,
    chaveAcesso: responseData.chaveAcesso || responseData.nfse?.chaveAcesso,
    dataAutorizacao: responseData.dataAutorizacao || responseData.nfse?.dataAutorizacao,
    linkNfse: responseData.linkNfse || responseData.nfse?.linkNfse,
    status: responseData.status || 'PROCESSADO'
  };
}
