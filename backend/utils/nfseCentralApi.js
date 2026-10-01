// Cliente REST da SEFIN Nacional (NFS-e Nacional) - autenticação mTLS com o
// certificado ICP-Brasil do emitente. XMLs trafegam em GZip + Base64.

import https from 'https';
import zlib from 'zlib';
import axios from 'axios';

const URL_SEFIN = {
  producao: 'https://sefin.nfse.gov.br/SefinNacional',
  homologacao: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional'
};

export const urlBaseSefin = (ambiente) => URL_SEFIN[ambiente === 'producao' ? 'producao' : 'homologacao'];

export const compactarGZipBase64 = (xml) => zlib.gzipSync(Buffer.from(xml, 'utf8')).toString('base64');
export const descompactarGZipBase64 = (b64) => zlib.gunzipSync(Buffer.from(b64, 'base64')).toString('utf8');

/**
 * Agente HTTPS com o certificado do emitente (mTLS).
 * @param {object} certConfig - { privateKeyPem, certPem }
 */
export function createNfseCentralAgent(certConfig) {
  if (!certConfig?.privateKeyPem || !certConfig?.certPem) {
    throw new Error('Certificado digital obrigatório para mTLS com a SEFIN Nacional');
  }
  return new https.Agent({
    key: certConfig.privateKeyPem,
    cert: certConfig.certPem,
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2'
  });
}

async function requisitar(metodo, ambiente, caminho, certConfig, corpo) {
  const url = `${urlBaseSefin(ambiente)}/${caminho}`;
  try {
    const response = await axios({
      method: metodo,
      url,
      data: corpo,
      httpsAgent: createNfseCentralAgent(certConfig),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: 60000,
      validateStatus: () => true
    });
    const ok = response.status >= 200 && response.status < 300;
    if (!ok) {
      console.error(`❌ SEFIN ${metodo} ${caminho} -> HTTP ${response.status}`);
      console.error(JSON.stringify(response.data, null, 2));
    }
    return {
      success: ok,
      statusCode: response.status,
      responseData: response.data,
      message: ok ? undefined : resumirErros(response.data) || `HTTP ${response.status}`
    };
  } catch (error) {
    console.error(`❌ Falha de comunicação com a SEFIN (${url}): ${error.message}`);
    return { success: false, statusCode: 0, responseData: null, message: error.message };
  }
}

/**
 * POST /nfse - envia a DPS assinada; em caso de sucesso devolve a NFS-e.
 * @returns {Promise<{ success, statusCode, responseData, nfseXml?, message? }>}
 */
export async function enviarDpsNfseCentral({ dpsXmlAssinado, ambiente = 'homologacao', certConfig }) {
  if (!dpsXmlAssinado) throw new Error('DPS XML assinado é obrigatório');

  console.log(`\n========== ENVIANDO DPS PARA SEFIN NACIONAL (${ambiente.toUpperCase()}) ==========`);
  const resultado = await requisitar('POST', ambiente, 'nfse', certConfig, {
    dpsXmlGZipB64: compactarGZipBase64(dpsXmlAssinado)
  });

  const b64 = resultado.responseData?.nfseXmlGZipB64;
  if (resultado.success && b64) {
    resultado.nfseXml = descompactarGZipBase64(b64);
  } else if (resultado.success) {
    resultado.success = false;
    resultado.message = 'Resposta da SEFIN sem a NFS-e (nfseXmlGZipB64).';
  }
  return resultado;
}

/** GET /nfse/{chaveAcesso} - consulta a NFS-e pela chave de acesso (50 dígitos). */
export async function consultarNfse({ chaveAcesso, ambiente = 'homologacao', certConfig }) {
  const resultado = await requisitar('GET', ambiente, `nfse/${chaveAcesso}`, certConfig);
  const b64 = resultado.responseData?.nfseXmlGZipB64;
  if (resultado.success && b64) resultado.nfseXml = descompactarGZipBase64(b64);
  return resultado;
}

/** GET /dps/{idDps} - descobre a chave de acesso da NFS-e gerada a partir de uma DPS. */
export function consultarDps({ idDps, ambiente = 'homologacao', certConfig }) {
  return requisitar('GET', ambiente, `dps/${idDps}`, certConfig);
}

/** POST /nfse/{chaveAcesso}/eventos - registra um evento (ex.: cancelamento) já assinado. */
export function registrarEvento({ chaveAcesso, pedRegEventoXmlAssinado, ambiente = 'homologacao', certConfig }) {
  return requisitar('POST', ambiente, `nfse/${chaveAcesso}/eventos`, certConfig, {
    pedidoRegistroEventoXmlGZipB64: compactarGZipBase64(pedRegEventoXmlAssinado)
  });
}

function listaErros(responseData) {
  if (!responseData || typeof responseData !== 'object') return [];
  const erros = responseData.erros || responseData.Erros || responseData.erro || [];
  return Array.isArray(erros) ? erros : [erros];
}

function resumirErros(responseData) {
  if (typeof responseData === 'string') return responseData.slice(0, 500);
  return listaErros(responseData)
    .map(e => [e.Codigo || e.codigo, e.Descricao || e.descricao || e.mensagem].filter(Boolean).join(' - '))
    .join(' | ');
}

/**
 * Converte a resposta de erro da SEFIN em [{ codigo, mensagem, correcao }].
 */
export function extrairMensagensErro(responseData) {
  if (typeof responseData === 'string' && responseData) {
    return [{ codigo: 'RESPOSTA', mensagem: responseData.slice(0, 1000) }];
  }
  return listaErros(responseData).map(e => ({
    codigo: e.Codigo || e.codigo || 'ERRO',
    mensagem: e.Descricao || e.descricao || e.mensagem || JSON.stringify(e),
    correcao: e.Complemento || e.complemento
  }));
}
