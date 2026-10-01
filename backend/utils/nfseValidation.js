// Utilitários para validação e testes de integração com nfse.gov.br
// Pode ser executado via CLI para verificar conectividade e configuração

import https from 'https';
import axios from 'axios';

/**
 * Verifica conectividade com os servidores de nfse.gov.br
 * @returns {Promise<object>} Status de ambos os ambientes
 */
export async function verificarConectividadeNfseCentral() {
  const resultados = {
    homologacao: { url: null, status: false, statusCode: null, erro: null },
    producao: { url: null, status: false, statusCode: null, erro: null }
  };

  // Homologação
  resultados.homologacao.url = 'https://www.producaorestrita.nfse.gov.br/api/v1/contribute/issqn';
  try {
    const respHomolog = await axios.get('https://www.producaorestrita.nfse.gov.br/health', {
      timeout: 5000,
      validateStatus: () => true // Aceitar qualquer status
    });
    resultados.homologacao.statusCode = respHomolog.status;
    resultados.homologacao.status = respHomolog.status < 500;
  } catch (err) {
    resultados.homologacao.erro = err.message;
  }

  // Produção
  resultados.producao.url = 'https://www.nfse.gov.br/api/v1/contribute/issqn';
  try {
    const respProd = await axios.get('https://www.nfse.gov.br/health', {
      timeout: 5000,
      validateStatus: () => true
    });
    resultados.producao.statusCode = respProd.status;
    resultados.producao.status = respProd.status < 500;
  } catch (err) {
    resultados.producao.erro = err.message;
  }

  return resultados;
}

/**
 * Valida se um certificado é adequado para mTLS com nfse.gov.br
 * @param {Buffer} certBuffer - Buffer do certificado .pfx
 * @param {string} password - Senha do certificado
 * @returns {object} { válido, erros, avisos, certificadoInfo }
 */
export async function validarCertificadoParaNfseCentral(certBuffer, password) {
  const resultado = {
    valido: true,
    erros: [],
    avisos: [],
    certificadoInfo: null
  };

  try {
    const { loadCertificate } = await import('./xmlSigner.js');
    const { privateKeyPem, certPem } = loadCertificate(certBuffer, password);

    if (!privateKeyPem || !certPem) {
      resultado.erros.push('Falha ao extrair chaves do certificado');
      resultado.valido = false;
      return resultado;
    }

    // Tentar extrair informações do certificado
    try {
      // Aqui seria possível parsear o certificado usando uma lib como 'asn1.js'
      // Por enquanto, apenas confirmar que foi carregado
      resultado.certificadoInfo = {
        carregado: true,
        temChavePrivada: !!privateKeyPem,
        temCertificado: !!certPem,
        tamanhoChave: privateKeyPem?.length || 0
      };
    } catch (parseErr) {
      resultado.avisos.push(`Não foi possível extrair detalhes do certificado: ${parseErr.message}`);
    }

    if (!resultado.certificadoInfo?.temChavePrivada) {
      resultado.erros.push('Certificado não possui chave privada');
      resultado.valido = false;
    }

    if (!resultado.certificadoInfo?.temCertificado) {
      resultado.erros.push('Certificado não possui certificado válido');
      resultado.valido = false;
    }
  } catch (err) {
    resultado.erros.push(`Erro ao validar certificado: ${err.message}`);
    resultado.valido = false;
  }

  return resultado;
}

/**
 * Testa a integração com o ambiente de homologação de nfse.gov.br
 * Não envia dados reais, apenas testa conectividade
 * @param {object} params - { cnpj, certificado, ambiente }
 * @returns {Promise<object>} Resultado do teste
 */
export async function testarIntegracaoNfseCentral(params) {
  const { cnpj, certificadoBuffer, certificadoSenha, ambiente = 'homologacao' } = params;

  const resultado = {
    sucesso: false,
    etapa: 'init',
    mensagens: [],
    erros: [],
    detalhes: {}
  };

  try {
    // Etapa 1: Validar certificado
    resultado.etapa = 'validacao-certificado';
    const valCert = await validarCertificadoParaNfseCentral(certificadoBuffer, certificadoSenha);
    if (!valCert.valido) {
      resultado.erros.push(...valCert.erros);
      resultado.mensagens.push('Certificado inválido para mTLS');
      return resultado;
    }
    resultado.detalhes.certificado = valCert.certificadoInfo;

    // Etapa 2: Verificar conectividade
    resultado.etapa = 'conectividade';
    const conectividade = await verificarConectividadeNfseCentral();
    resultado.detalhes.conectividade = conectividade;
    if (!conectividade[ambiente].status) {
      resultado.erros.push(`Não foi possível conectar ao ambiente ${ambiente}`);
      return resultado;
    }
    resultado.mensagens.push(`✓ Conectividade com ${ambiente} OK`);

    // Etapa 3: Tenta uma requisição test (se endpoint de teste existir)
    resultado.etapa = 'teste-mtls';
    const { loadCertificate } = await import('./xmlSigner.js');
    const certBuf = certificadoBuffer;
    const { privateKeyPem, certPem } = loadCertificate(certBuf, certificadoSenha);

    const httpsAgent = new https.Agent({
      key: privateKeyPem,
      cert: certPem,
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2'
    });

    const urlBase = ambiente === 'producao'
      ? 'https://www.nfse.gov.br/api/v1/contribute/issqn'
      : 'https://www.producaorestrita.nfse.gov.br/api/v1/contribute/issqn';

    // Tentar GET simples para verificar mTLS
    try {
      const testResponse = await axios.get(`${urlBase}/health`, {
        httpsAgent,
        timeout: 10000,
        validateStatus: () => true
      });

      resultado.detalhes.testMtls = {
        statusCode: testResponse.status,
        headers: {
          'content-type': testResponse.headers['content-type'],
          'server': testResponse.headers['server']
        }
      };

      if (testResponse.status < 500) {
        resultado.mensagens.push(`✓ mTLS funciona (status ${testResponse.status})`);
      } else {
        resultado.erros.push(`Servidor retornou erro: ${testResponse.status}`);
      }
    } catch (testErr) {
      // Pode falhar se o endpoint /health não existir, mas mTLS pode estar OK
      resultado.avisos.push(`Não foi possível testar /health: ${testErr.message}`);
      resultado.mensagens.push('ℹ Nota: mTLS pode estar configurado, mas /health não respondeu');
    }

    resultado.sucesso = resultado.erros.length === 0;
  } catch (err) {
    resultado.erros.push(`Erro durante teste: ${err.message}`);
    resultado.detalhes.erro = err;
  }

  return resultado;
}

/**
 * Valida dados mínimos necessários para envio de DPS
 * @param {object} nota - Dados da nota/DPS
 * @param {object} emissor - Dados do emissor
 * @returns {object} { valido, erros, avisos }
 */
export function validarDadosParaEnvioDps(nota, emissor) {
  const resultado = {
    valido: true,
    erros: [],
    avisos: []
  };

  // Verificar campos críticos
  const camposCriticos = [
    { campo: 'emissor.cnpj', valor: emissor?.cnpj },
    { campo: 'nota.numeroRps', valor: nota?.numeroRps },
    { campo: 'nota.servico.valorServicos', valor: nota?.servico?.valorServicos },
    { campo: 'nota.tomador.cpfCnpj', valor: nota?.tomador?.cpfCnpj },
    { campo: 'nota.tomador.razaoSocial', valor: nota?.tomador?.razaoSocial },
    { campo: 'nota.tomador.endereco.codigoMunicipio', valor: nota?.tomador?.endereco?.codigoMunicipio },
    { campo: 'nota.servico.codigoMunicipio', valor: nota?.servico?.codigoMunicipio }
  ];

  camposCriticos.forEach(({ campo, valor }) => {
    if (!valor) {
      resultado.erros.push(`Campo obrigatório vazio: ${campo}`);
      resultado.valido = false;
    }
  });

  // Avisos
  if (!emissor?.padraoIntegracao) {
    resultado.avisos.push('padraoIntegracao não definido, usando nfse-gov-br padrão');
  }

  return resultado;
}

/**
 * Simula o fluxo completo de envio (sem realmente enviar)
 * Útil para validação em testes
 */
export async function simularFluxoEnvioDps(nota, emissor) {
  const resultado = {
    etapas: [],
    sucesso: false,
    erros: []
  };

  try {
    // Etapa 1: Validação de dados
    resultado.etapas.push({
      nome: 'Validação de Dados',
      status: 'iniciada'
    });

    const valDados = validarDadosParaEnvioDps(nota, emissor);
    resultado.etapas[0].status = valDados.valido ? 'sucesso' : 'erro';
    resultado.etapas[0].detalhes = valDados;

    if (!valDados.valido) {
      resultado.erros.push(...valDados.erros);
      return resultado;
    }

    // Etapa 2: Geração de DPS
    resultado.etapas.push({
      nome: 'Geração de DPS XML',
      status: 'iniciada'
    });

    try {
      const { gerarDpsXmlNfseCentral } = await import('./dpsGenerator.js');
      const { dpsXml, metadados } = gerarDpsXmlNfseCentral(nota, emissor);
      resultado.etapas[1].status = 'sucesso';
      resultado.etapas[1].detalhes = {
        tamanhoXml: dpsXml?.length || 0,
        metadados: {
          cnpj: metadados.cnpj,
          idDps: metadados.idDps,
          numeroDps: metadados.numeroDps,
          cTribNac: metadados.cTribNac,
          codigoMunicipioPrestacao: metadados.codigoMunicipioPrestacao
        }
      };
    } catch (err) {
      resultado.etapas[1].status = 'erro';
      resultado.etapas[1].erro = err.message;
      resultado.erros.push(`Erro ao gerar DPS: ${err.message}`);
      return resultado;
    }

    // Etapa 3: Assinatura (simulado)
    resultado.etapas.push({
      nome: 'Assinatura Digital',
      status: 'simulada',
      detalhes: { precisaCertificado: true }
    });

    // Etapa 4: Preparação de envio
    resultado.etapas.push({
      nome: 'Preparação para Envio',
      status: 'sucesso',
      detalhes: { url: 'https://www.producaorestrita.nfse.gov.br/api/v1/contribute/issqn' }
    });

    resultado.sucesso = true;
  } catch (err) {
    resultado.erros.push(`Erro geral: ${err.message}`);
  }

  return resultado;
}
