// Cliente REST para integração com nfse.gov.br (ambiente nacional)
// Handles: mTLS authentication, request signing, error handling

import https from 'https';
import axios from 'axios';

/**
 * Cria um agente HTTPS com certificado para mTLS com nfse.gov.br
 * @param {object} certConfig - { privateKeyPem, certPem }
 * @returns {https.Agent}
 */
export function createNfseCentralAgent(certConfig) {
  if (!certConfig || !certConfig.privateKeyPem || !certConfig.certPem) {
    throw new Error('Certificado digital obrigatório para mTLS com nfse.gov.br');
  }

  return new https.Agent({
    key: certConfig.privateKeyPem,
    cert: certConfig.certPem,
    rejectUnauthorized: true, // Validar certificado do servidor em produção
    minVersion: 'TLSv1.2'
  });
}

/**
 * Envia uma DPS assinada para nfse.gov.br
 * @param {object} params - { dpsXmlAssinado, ambiente, certConfig, cnpj }
 * @returns {Promise<{ statusCode, responseData, headers }>}
 */
export async function enviarDpsNfseCentral(params) {
  const { dpsXmlAssinado, ambiente = 'homologacao', certConfig, cnpj } = params;

  if (!dpsXmlAssinado) {
    throw new Error('DPS XML assinado é obrigatório');
  }
  if (!certConfig) {
    throw new Error('Configuração de certificado é obrigatória');
  }

  // URL base conforme ambiente
  const urlBase =
    ambiente === 'producao'
      ? 'https://www.nfse.gov.br/api/v1/contribute/issqn'
      : 'https://www.producaorestrita.nfse.gov.br/api/v1/contribute/issqn';

  const endpoint = `${urlBase}/dps`;
  const httpsAgent = createNfseCentralAgent(certConfig);

  console.log(`\n========== ENVIANDO DPS PARA NFSE.GOV.BR (${ambiente.toUpperCase()}) ==========`);

  try {
    // Payload: XML assinado em formato JSON
    const payload = {
      xmlDPS: dpsXmlAssinado, // XML assinado como string
      cnpj: cnpj?.replace?.(/\D/g, ''), // Remover formatação
    };

    const response = await axios.post(endpoint, payload, {
      httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'nfse-nacional/1.0',
      },
      timeout: 30000, // 30 segundos
    });

    console.log(`✅ DPS enviada com sucesso. Status: ${response.status}`);

    return {
      statusCode: response.status,
      responseData: response.data,
      headers: response.headers,
      success: true,
    };
  } catch (error) {
    console.error(`❌ Erro ao enviar DPS para nfse.gov.br: ${error.message}`);

    // Estruturar resposta de erro
    const errorData = {
      statusCode: error.response?.status || 0,
      message: error.message,
      responseData: error.response?.data || null,
      headers: error.response?.headers || {},
      success: false,
    };

    // Log detalhado para debug
    if (error.response?.data) {
      console.error('Resposta do servidor:', JSON.stringify(error.response.data, null, 2));
    }

    return errorData;
  }
}

/**
 * Consulta status de uma DPS/NFS-e previamente enviada
 * @param {object} params - { numeroNfse, cnpj, ambiente, certConfig }
 * @returns {Promise<object>}
 */
export async function consultarStatusDps(params) {
  const { numeroNfse, cnpj, ambiente = 'homologacao', certConfig } = params;

  if (!numeroNfse || !cnpj) {
    throw new Error('numeroNfse e cnpj são obrigatórios');
  }

  const urlBase =
    ambiente === 'producao'
      ? 'https://www.nfse.gov.br/api/v1/contribute/issqn'
      : 'https://www.producaorestrita.nfse.gov.br/api/v1/contribute/issqn';

  const endpoint = `${urlBase}/nfse/${numeroNfse}`;
  const httpsAgent = createNfseCentralAgent(certConfig);

  console.log(`\n========== CONSULTANDO STATUS NFS-E: ${numeroNfse} ==========`);

  try {
    const response = await axios.get(endpoint, {
      httpsAgent,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'nfse-nacional/1.0',
      },
      timeout: 15000,
    });

    console.log(`✅ Consulta realizada. Status: ${response.status}`);
    return {
      statusCode: response.status,
      responseData: response.data,
      success: true,
    };
  } catch (error) {
    console.error(`❌ Erro ao consultar status: ${error.message}`);
    return {
      statusCode: error.response?.status || 0,
      message: error.message,
      responseData: error.response?.data || null,
      success: false,
    };
  }
}

/**
 * Cancela uma NFS-e emitida
 * @param {object} params - { numeroNfse, justificativa, cnpj, ambiente, certConfig }
 * @returns {Promise<object>}
 */
export async function cancelarNfse(params) {
  const { numeroNfse, justificativa, cnpj, ambiente = 'homologacao', certConfig } = params;

  if (!numeroNfse || !justificativa) {
    throw new Error('numeroNfse e justificativa são obrigatórios');
  }

  const urlBase =
    ambiente === 'producao'
      ? 'https://www.nfse.gov.br/api/v1/contribute/issqn'
      : 'https://www.producaorestrita.nfse.gov.br/api/v1/contribute/issqn';

  const endpoint = `${urlBase}/nfse/${numeroNfse}/cancelar`;
  const httpsAgent = createNfseCentralAgent(certConfig);

  console.log(`\n========== CANCELANDO NFS-E: ${numeroNfse} ==========`);

  try {
    const payload = {
      numeroNfse,
      justificativa,
      cnpj: cnpj?.replace?.(/\D/g, ''),
    };

    const response = await axios.post(endpoint, payload, {
      httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'nfse-nacional/1.0',
      },
      timeout: 15000,
    });

    console.log(`✅ NFS-e cancelada com sucesso`);
    return {
      statusCode: response.status,
      responseData: response.data,
      success: true,
    };
  } catch (error) {
    console.error(`❌ Erro ao cancelar NFS-e: ${error.message}`);
    return {
      statusCode: error.response?.status || 0,
      message: error.message,
      responseData: error.response?.data || null,
      success: false,
    };
  }
}

/**
 * Recupera as mensagens de erro estruturadas da resposta do nfse.gov.br
 * @param {object} responseData - Resposta da API
 * @returns {array} Array de mensagens estruturadas
 */
export function extrairMensagensErro(responseData) {
  if (!responseData) return [];

  const mensagens = [];

  // Pode vir em diferentes formatos conforme a resposta
  if (Array.isArray(responseData.erros)) {
    responseData.erros.forEach(erro => {
      mensagens.push({
        codigo: erro.codigo || 'DESCONHECIDO',
        mensagem: erro.descricao || erro.mensagem || String(erro),
      });
    });
  } else if (responseData.erro) {
    mensagens.push({
      codigo: responseData.erro.codigo || 'ERRO',
      mensagem: responseData.erro.descricao || responseData.erro.mensagem || String(responseData.erro),
    });
  } else if (typeof responseData === 'string') {
    mensagens.push({
      codigo: 'RESPOSTA',
      mensagem: responseData,
    });
  }

  return mensagens;
}
