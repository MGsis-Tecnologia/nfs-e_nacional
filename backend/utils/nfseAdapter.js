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

  try {
    const { loadCertificate } = await import('./xmlSigner.js');
    const { signRpsXml } = await import('./xmlSigner.js');
    const { gerarDpsXmlNfseCentral, prepararPayloadNfseCentral, extrairDadosNfseResposta } = await import('./dpsGenerator.js');
    const { enviarDpsNfseCentral, extrairMensagensErro } = nfseCentralRest;

    // 1. Gerar DPS em XML
    const { dpsXml, metadados } = gerarDpsXmlNfseCentral(nota, emissor);

    // 2. Assinar XML da DPS
    const certBuffer = Buffer.from(certConfig.pfxBase64, 'base64');
    const { privateKeyPem, certPem } = loadCertificate(certBuffer, certConfig.password);
    const dpsXmlAssinado = signRpsXml({
      xml: dpsXml,
      rpsId: `rps_${nota.id}`,
      loteId: `lote_${Date.now()}`,
      privateKeyPem,
      certPem
    });

    // 3. Determinar ambiente (homologação ou produção)
    const ambiente = emissor.ambiente === '1' ? 'producao' : 'homologacao';

    // 4. Enviar para nfse.gov.br
    console.log(`\n========== ENVIANDO DPS ${nota.numeroRps} PARA NFSE.GOV.BR (${ambiente.toUpperCase()}) ==========`);

    const resultadoEnvio = await enviarDpsNfseCentral({
      dpsXmlAssinado,
      ambiente,
      certConfig: { privateKeyPem, certPem },
      cnpj: emissor.cnpj
    });

    // 5. Processar resposta
    if (!resultadoEnvio.success) {
      console.error(`❌ Erro ao enviar DPS para nfse.gov.br`);
      const mensagens = extrairMensagensErro(resultadoEnvio.responseData);

      return {
        statusText: 'Erro',
        responseObj: {
          success: false,
          error: resultadoEnvio.message || 'Erro ao enviar DPS',
          mensagens: mensagens.length ? mensagens : [{
            codigo: 'ENVIO_FALHOU',
            mensagem: resultadoEnvio.message || 'Falha na transmissão',
            correcao: 'Verifique conectividade e certificado digital'
          }],
          restResponse: resultadoEnvio.responseData,
          restRequest: { ambiente, cnpj: emissor.cnpj, metadados },
          dpsXmlAssinado
        }
      };
    }

    // Sucesso!
    console.log(`✅ DPS enviada com sucesso para nfse.gov.br`);
    const dadosNfse = extrairDadosNfseResposta(resultadoEnvio.responseData);

    if (dadosNfse.numeroNfse) {
      console.log(`✅ NFS-e nº ${dadosNfse.numeroNfse} (verificação ${dadosNfse.codigoVerificacao})`);
    }

    return {
      statusText: 'Processado',
      responseObj: {
        success: true,
        mensagens: [{
          codigo: 'SUCESSO',
          mensagem: 'DPS enviada com sucesso e processada pelo Ambiente Nacional'
        }],
        nfse: dadosNfse,
        restResponse: resultadoEnvio.responseData,
        restRequest: { ambiente, cnpj: emissor.cnpj, metadados },
        dpsXmlAssinado
      }
    };
  } catch (error) {
    console.error(`❌ Erro ao processar DPS para nfse.gov.br: ${error.message}`);

    return {
      statusText: 'Erro',
      responseObj: {
        success: false,
        error: error.message,
        mensagens: [{
          codigo: 'ERRO_PROCESSAMENTO',
          mensagem: error.message,
          correcao: 'Verifique os dados da DPS e tente novamente'
        }],
        nota: nota.id
      }
    };
  }
}

export { nfseFozSoap, nfseCentralRest };
