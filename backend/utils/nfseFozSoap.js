// Implementação SOAP para Foz do Iguaçu (legacy)
// Mantido para compatibilidade com emissores antigos
// Migrando para REST/nfse.gov.br no futuro

import https from 'https';
import axios from 'axios';
import { generateRpsXml, wrapInSoapEnvelope } from './xmlGenerator.js';
import { loadCertificate, signRpsXml } from './xmlSigner.js';
import { parseResposta } from './responseParser.js';

const num = (v) => parseFloat(String(v ?? '').replace(',', '.'));

/**
 * Valida o RPS + configurações antes de enviar (para Foz do Iguaçu)
 * Retorna array de mensagens de erro (vazio = ok)
 */
export function validarEmissao(rps, settings) {
  const erros = [];
  if (!settings.cnpj || !settings.inscricaoMunicipal) {
    erros.push("Configurações do emissor incompletas (CNPJ/Inscrição Municipal).");
  }
  if (!rps.numeroRps) {
    erros.push("Número do RPS é obrigatório.");
  }
  if (!rps.servico || !rps.servico.codigoTributacaoMunicipio) {
    erros.push("Código de Tributação Municipal é obrigatório.");
  }
  if (!rps.servico || !(num(rps.servico.valorServicos) > 0)) {
    erros.push("Valor dos Serviços deve ser maior que zero.");
  }
  if (!rps.tomador || !rps.tomador.cpfCnpj) {
    erros.push("CPF/CNPJ do Tomador é obrigatório.");
  }
  if (!rps.tomador || !rps.tomador.razaoSocial) {
    erros.push("Razão Social do Tomador é obrigatória.");
  }

  // Endereço do tomador (campos exigidos pela prefeitura; vazio gera E160 no schema)
  const end = (rps.tomador && rps.tomador.endereco) || {};
  if (!end.logradouro) {
    erros.push("Logradouro (endereço) do Tomador é obrigatório.");
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

  const regime = (settings.regimeEspecialTributacao || '').toString().trim();
  if (String(settings.optanteSimplesNacional) === '1' && !['05', '06', '5', '6'].includes(regime)) {
    erros.push("Empresa optante do Simples Nacional: defina o Regime Especial de Tributação como '05' (MEI) ou '06' (ME/EPP) em Configurações.");
  }

  return erros;
}

/**
 * Assina o XML e transmite para Foz do Iguaçu via SOAP
 * Retorna { statusText, responseObj }
 * Lança erro apenas para problemas de configuração/certificado (antes do envio)
 */
export async function assinarEEnviar(rps, settings, certConfig) {
  if (!certConfig || !certConfig.pfxBase64) {
    throw new Error("Certificado digital não configurado.");
  }

  const certBuffer = Buffer.from(certConfig.pfxBase64, 'base64');
  const { privateKeyPem, certPem } = loadCertificate(certBuffer, certConfig.password);

  const { xml, loteId, rpsId, versao } = generateRpsXml(rps, settings, { padrao: 'foz-iguacu' });
  const signedXml = signRpsXml({ xml, rpsId, loteId, privateKeyPem, certPem });
  const soapEnvelope = wrapInSoapEnvelope(signedXml, 'RecepcionarLoteRpsSincronoRequest', versao);

  const isProd = settings.ambiente === '1';
  const soapUrl = isProd
    ? 'https://fozdoiguacupr.gestaoiss.com.br/ws/nfse.asmx'
    : 'https://homologacao.gestaoiss.com.br/ws/nfse.asmx';

  console.log(`\n========== ENVIANDO RPS ${rps.numeroRps} (FOZ DO IGUAÇU - ${isProd ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO'}) ==========`);

  let statusText = 'Erro';
  let responseObj;

  try {
    const agent = new https.Agent({
      key: privateKeyPem,
      cert: certPem,
      rejectUnauthorized: false
    });

    const response = await axios.post(soapUrl, soapEnvelope, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://nfse.abrasf.org.br/RecepcionarLoteRpsSincrono'
      },
      httpsAgent: agent,
      timeout: 25000
    });

    const parsed = parseResposta(response.data);
    statusText = parsed.status;

    if (statusText === 'Processado') {
      console.log(`✅ NFS-e nº ${parsed.nfse?.numero} (verificação ${parsed.nfse?.codigoVerificacao})`);
    } else {
      console.log(`❌ Rejeitado:`);
      parsed.mensagens.forEach(m => console.log(`   [${m.codigo}] ${m.mensagem}`));
    }

    responseObj = {
      success: statusText === 'Processado',
      mensagens: parsed.mensagens,
      nfse: parsed.nfse,
      soapResponse: response.data,
      soapRequest: soapEnvelope,
      signedXml
    };
  } catch (sendErr) {
    console.error(`❌ Erro na transmissão do RPS ${rps.numeroRps}: ${sendErr.message}`);
    statusText = 'Erro';
    responseObj = {
      success: false,
      error: sendErr.message,
      mensagens: [{
        codigo: 'TRANSMISSAO',
        mensagem: sendErr.message,
        correcao: 'Verifique conectividade/certificado.'
      }],
      soapResponse: sendErr.response ? sendErr.response.data : 'Sem resposta do servidor.',
      soapRequest: soapEnvelope,
      signedXml
    };
  }

  return { statusText, responseObj };
}
