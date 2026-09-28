import { create } from 'xmlbuilder2';

// ============ Helpers ============

const formatDecimal = (val) => {
  const num = parseFloat(String(val).replace(',', '.'));
  return isNaN(num) ? '0.00' : num.toFixed(2);
};

const formatAliquota = (val) => {
  const num = parseFloat(String(val).replace(',', '.'));
  return isNaN(num) ? '0.0000' : num.toFixed(4);
};

const formatDate = (dateStr) => {
  if (!dateStr) {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().slice(0, 19);
  }
  return dateStr.slice(0, 19);
};

// ============ Defaults por Padrão ============

/**
 * Obtém valores padrão baseado no padrão de integração
 * @param {string} padrao - 'nfse-gov-br' | 'foz-iguacu' | 'abrasf-2.03'
 * @returns {object} Defaults para o padrão
 */
function obterDefaultsPorPadrao(padrao) {
  const defaults = {
    'foz-iguacu': {
      codigoMunicipioFallback: '4108304',
      versaoAbrasf: '2.02',
      xmlns: 'http://www.abrasf.org.br/nfse.xsd',
      namespace: 'http://nfse.abrasf.org.br',
      soapAction: 'http://nfse.abrasf.org.br/RecepcionarLoteRpsSincrono',
      tipoXml: 'ABRASF-2.02',
      usarSoap: true
    },
    'nfse-gov-br': {
      codigoMunicipioFallback: null, // Obrigatório!
      versaoAbrasf: '2.03', // Transição: 2.03 com preparação para NT-004
      xmlns: 'http://www.abrasf.org.br/nfse.xsd',
      namespace: 'http://nfse.abrasf.org.br',
      soapAction: 'http://nfse.abrasf.org.br/RecepcionarLoteRpsSincrono',
      tipoXml: 'ABRASF-2.03-NT-004-PREP', // Preparação para novo layout
      usarSoap: false, // REST
      ibs: null, // Será adicionado em jan/2027
      cbs: null  // Será adicionado em jan/2027
    },
    'abrasf-2.03': {
      codigoMunicipioFallback: null, // Obrigatório
      versaoAbrasf: '2.03',
      xmlns: 'http://www.abrasf.org.br/nfse.xsd',
      namespace: 'http://nfse.abrasf.org.br',
      tipoXml: 'ABRASF-2.03',
      usarSoap: true
    }
  };

  return defaults[padrao] || defaults['nfse-gov-br'];
}

// ============ Geração de XML ============

/**
 * Gera XML de RPS/DPS para envio
 * @param {object} nota - Dados da nota (RPS/DPS)
 * @param {object} emissor - Configurações do emissor
 * @param {object} options - { padrao, versaoLayout }
 * @returns {object} { xml, loteId, rpsId }
 */
export function generateRpsXml(nota, emissor, options = {}) {
  const padrao = options.padrao || emissor.padraoIntegracao || 'nfse-gov-br';
  const defaults = obterDefaultsPorPadrao(padrao);

  // IDs únicos
  const rpsId = `rps_${nota.id}`;
  const loteId = `lote_${Date.now()}`;

  // Limpeza de dados
  const isCnpjTomador = nota.tomador.cpfCnpj.replace(/\D/g, '').length === 14;
  const cleanedCnpjTomador = nota.tomador.cpfCnpj.replace(/\D/g, '');
  const cleanedCnpjPrestador = emissor.cnpj.replace(/\D/g, '');

  // Regime Especial de Tributação (normalizar para 1 dígito)
  const regimeNum = parseInt(emissor.regimeEspecialTributacao, 10);
  const regimeEspecial = (regimeNum >= 1 && regimeNum <= 6) ? String(regimeNum) : null;

  // Endereço do tomador
  const te = nota.tomador.endereco || {};
  const teCep = (te.cep || '').replace(/\D/g, '');

  // Código de município: usar do tomador, depois do serviço, depois do fallback (que pode ser null)
  const codigoMunicipioTomador = te.codigoMunicipio || nota.servico?.codigoMunicipio || defaults.codigoMunicipioFallback;

  if (!codigoMunicipioTomador && padrao === 'nfse-gov-br') {
    throw new Error('Código IBGE do município é obrigatório para nfse.gov.br. Configure no tomador/serviço ou no emissor.');
  }

  const tomadorEndereco = {
    ...(te.logradouro ? { Endereco: te.logradouro } : {}),
    ...(te.numero ? { Numero: te.numero } : {}),
    ...(te.complemento ? { Complemento: te.complemento } : {}),
    ...(te.bairro ? { Bairro: te.bairro } : {}),
    ...(codigoMunicipioTomador ? { CodigoMunicipio: codigoMunicipioTomador } : {}),
    ...(te.uf ? { Uf: te.uf } : {}),
    ...(teCep ? { Cep: teCep } : {})
  };

  // Código de município do serviço
  const codigoMunicipioServico = nota.servico?.codigoMunicipio || defaults.codigoMunicipioFallback;
  const municipioIncidencia = nota.servico?.municipioIncidencia || codigoMunicipioServico;

  // Construir XML base ABRASF
  const xmlObj = {
    EnviarLoteRpsSincronoEnvio: {
      '@xmlns': defaults.xmlns,
      LoteRps: {
        '@Id': loteId,
        '@versao': defaults.versaoAbrasf,
        NumeroLote: '1', // Fixo: só incrementa RPS
        CpfCnpj: { Cnpj: cleanedCnpjPrestador },
        InscricaoMunicipal: emissor.inscricaoMunicipal.replace(/\D/g, ''),
        QuantidadeRps: '1',
        ListaRps: {
          Rps: {
            InfDeclaracaoPrestacaoServico: {
              '@Id': rpsId,
              Rps: {
                '@Id': `Rps1_${nota.numeroRps}_${cleanedCnpjPrestador}`,
                IdentificacaoRps: {
                  Numero: nota.numeroRps,
                  Serie: nota.serieRps || '1',
                  Tipo: '1'
                },
                DataEmissao: formatDate(nota.dataEmissao).substring(0, 10),
                Status: '1'
              },
              Competencia: nota.competencia ? nota.competencia.substring(0, 10) : formatDate(nota.dataEmissao).substring(0, 10),
              Servico: {
                Valores: {
                  ValorServicos: formatDecimal(nota.servico.valorServicos),
                  ...(parseFloat(String(nota.servico.aliquota).replace(',', '.')) > 0
                    ? { Aliquota: formatAliquota(nota.servico.aliquota) }
                    : {}),
                  // IBS/CBS: preparação para jan/2027
                  ...(defaults.ibs && nota.servico.valorIbs ? { ValorIBS: formatDecimal(nota.servico.valorIbs) } : {}),
                  ...(defaults.cbs && nota.servico.valorCbs ? { ValorCBS: formatDecimal(nota.servico.valorCbs) } : {})
                },
                IssRetido: nota.servico.issRetido || '2',
                ItemListaServico: nota.servico.itemListaServico?.replace('.', '') || '',
                CodigoCnae: (emissor.cnae || '').replace(/\D/g, ''),
                CodigoTributacaoMunicipio: nota.servico.codigoTributacaoMunicipio,
                Discriminacao: nota.servico.discriminacao,
                ...(codigoMunicipioServico ? { CodigoMunicipio: codigoMunicipioServico } : {}),
                ExigibilidadeISS: nota.servico.exigibilidadeIss || '1',
                ...(municipioIncidencia ? { MunicipioIncidencia: municipioIncidencia } : {})
              },
              Prestador: {
                CpfCnpj: { Cnpj: cleanedCnpjPrestador },
                InscricaoMunicipal: emissor.inscricaoMunicipal.replace(/\D/g, '')
              },
              Tomador: {
                IdentificacaoTomador: {
                  CpfCnpj: isCnpjTomador
                    ? { Cnpj: cleanedCnpjTomador }
                    : { Cpf: cleanedCnpjTomador },
                  ...(nota.tomador.inscricaoMunicipal ? { InscricaoMunicipal: nota.tomador.inscricaoMunicipal } : {})
                },
                RazaoSocial: nota.tomador.razaoSocial,
                Endereco: tomadorEndereco,
                ...(nota.tomador.contato && (nota.tomador.contato.telefone || nota.tomador.contato.email) ? {
                  Contato: {
                    ...(nota.tomador.contato.telefone ? { Telefone: nota.tomador.contato.telefone.replace(/\D/g, '') } : {}),
                    ...(nota.tomador.contato.email ? { Email: nota.tomador.contato.email } : {})
                  }
                } : {})
              },
              ...(regimeEspecial ? { RegimeEspecialTributacao: regimeEspecial } : {}),
              OptanteSimplesNacional: emissor.optanteSimplesNacional || '2',
              IncentivoFiscal: emissor.incentivoFiscal ? '1' : '2'
            }
          }
        }
      }
    }
  };

  const doc = create({ version: '1.0', encoding: 'UTF-8' }, xmlObj);
  return {
    xml: doc.end({ prettyPrint: true }),
    loteId,
    rpsId,
    padrao,
    versao: defaults.versaoAbrasf
  };
}

// ============ SOAP Envelope (para sistemas que usam SOAP) ============

/**
 * Envolve XML assinado em envelope SOAP
 * Usado apenas por Foz do Iguaçu (nfse-gov-br usa REST)
 */
export function wrapInSoapEnvelope(signedXml, method = 'RecepcionarLoteRpsSincronoRequest', versaoAbrasf = '2.02') {
  const cabecalho = `<cabecalho versao="${versaoAbrasf}" xmlns="http://www.abrasf.org.br/nfse.xsd"><versaoDados>${versaoAbrasf}</versaoDados></cabecalho>`;

  const soapXmlObj = {
    'soap:Envelope': {
      '@xmlns:soap': 'http://schemas.xmlsoap.org/soap/envelope/',
      '@xmlns:nfse': 'http://nfse.abrasf.org.br',
      'soap:Header': {},
      'soap:Body': {
        [`nfse:${method}`]: {
          'nfseCabecMsg': cabecalho,
          'nfseDadosMsg': signedXml
        }
      }
    }
  };

  const doc = create({ version: '1.0', encoding: 'UTF-8' }, soapXmlObj);
  return doc.end({ prettyPrint: true });
}

// ============ Exports de Helpers ============

export {
  formatDecimal,
  formatAliquota,
  formatDate,
  obterDefaultsPorPadrao
};
