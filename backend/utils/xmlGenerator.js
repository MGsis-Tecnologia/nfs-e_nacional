import { create } from 'xmlbuilder2';

// Helper to format decimals to 2 decimal places
const formatDecimal = (val) => {
  const num = parseFloat(val);
  return isNaN(num) ? '0.00' : num.toFixed(2);
};

// Helper to format aliquot to 4 decimal places
const formatAliquota = (val) => {
  const num = parseFloat(val);
  return isNaN(num) ? '0.0000' : num.toFixed(4);
};

// Helper to format date to YYYY-MM-DDTHH:MM:SS
const formatDate = (dateStr) => {
  if (!dateStr) {
    const d = new Date();
    // Ajustar para fuso local do Brasil (ou usar o UTC com offset)
    // Formato: YYYY-MM-DDTHH:MM:SS
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset*60*1000));
    return localDate.toISOString().slice(0, 19);
  }
  return dateStr.slice(0, 19);
};

export function generateRpsXml(rps, settings) {
  const rpsId = `rps_${rps.id}`;
  const loteId = `lote_${Date.now()}`;
  
  const isCnpjTomador = rps.tomador.cpfCnpj.replace(/\D/g, '').length === 14;
  const cleanedCnpjTomador = rps.tomador.cpfCnpj.replace(/\D/g, '');
  const cleanedCnpjPrestador = settings.cnpj.replace(/\D/g, '');

  const xmlObj = {
    EnviarLoteRpsSincronoEnvio: {
      '@xmlns': 'http://www.abrasf.org.br/nfse.xsd',
      LoteRps: {
        '@Id': loteId,
        '@versao': '2.02',
        NumeroLote: rps.numeroLote || '1',
        Prestador: {
          Cnpj: cleanedCnpjPrestador,
          InscricaoMunicipal: settings.inscricaoMunicipal.replace(/\D/g, '')
        },
        QuantidadeRps: '1',
        ListaRps: {
          Rps: {
            InfDeclaracaoPrestacaoServico: {
              '@Id': rpsId,
              Rps: {
                IdentificacaoRps: {
                  Numero: rps.numeroRps,
                  Serie: rps.serieRps || '1',
                  Tipo: '1' // 1 = RPS
                },
                DataEmissao: formatDate(rps.dataEmissao),
                Status: '1' // 1 = Normal
              },
              Competencia: rps.competencia ? rps.competencia.substring(0, 10) : formatDate(rps.dataEmissao).substring(0, 10),
              Servico: {
                Valores: {
                  ValorServicos: formatDecimal(rps.servico.valorServicos),
                  ValorDeducoes: formatDecimal(rps.servico.valorDeducoes),
                  ValorPis: formatDecimal(rps.servico.valorPis),
                  ValorCofins: formatDecimal(rps.servico.valorCofins),
                  ValorInss: formatDecimal(rps.servico.valorInss),
                  ValorIr: formatDecimal(rps.servico.valorIr),
                  ValorCsll: formatDecimal(rps.servico.valorCsll),
                  OutrasRetencoes: formatDecimal(rps.servico.outrasRetencoes),
                  ValoresNfse: {
                    // Preenchido pelo provedor
                  },
                  Aliquota: formatAliquota(rps.servico.aliquota), // ex: 3.0000 para 3%
                  DescontoIncondicionado: formatDecimal(rps.servico.descontoIncondicionado),
                  DescontoCondicionado: formatDecimal(rps.servico.descontoCondicionado)
                },
                IssRetido: rps.servico.issRetido || '2', // 1 = Sim, 2 = Não
                // Se retido, indicar o responsável: 1 = Tomador, 2 = Intermediário
                ...(rps.servico.issRetido === '1' ? { ResponsavelRetencao: '1' } : {}),
                ItemListaServico: rps.servico.itemListaServico, // Ex: 14.01
                CodigoCnae: settings.cnae.replace(/\D/g, ''),
                CodigoTributacaoMunicipio: rps.servico.codigoTributacaoMunicipio, // Obrigatório
                ...(rps.servico.codigoNbs ? { CodigoNbs: rps.servico.codigoNbs } : {}), // Novo para IBS/CBS
                Discriminacao: rps.servico.discriminacao,
                CodigoMunicipio: rps.servico.codigoMunicipio || '4108304', // Foz do Iguaçu
                ExigibilidadeIss: rps.servico.exigibilidadeIss || '1', // 1 = Exigível
                MunicipioIncidencia: rps.servico.municipioIncidencia || '4108304'
              },
              Prestador: {
                Cnpj: cleanedCnpjPrestador,
                InscricaoMunicipal: settings.inscricaoMunicipal.replace(/\D/g, '')
              },
              Tomador: {
                IdentificacaoTomador: {
                  CpfCnpj: isCnpjTomador 
                    ? { Cnpj: cleanedCnpjTomador } 
                    : { Cpf: cleanedCnpjTomador },
                  ...(rps.tomador.inscricaoMunicipal ? { InscricaoMunicipal: rps.tomador.inscricaoMunicipal } : {})
                },
                RazaoSocial: rps.tomador.razaoSocial,
                Endereco: {
                  Logradouro: rps.tomador.endereco.logradouro,
                  Numero: rps.tomador.endereco.numero,
                  ...(rps.tomador.endereco.complemento ? { Complemento: rps.tomador.endereco.complemento } : {}),
                  Bairro: rps.tomador.endereco.bairro,
                  CodigoMunicipio: rps.tomador.endereco.codigoMunicipio || '4108304',
                  Uf: rps.tomador.endereco.uf || 'PR',
                  Cep: rps.tomador.endereco.cep.replace(/\D/g, '')
                },
                ...(rps.tomador.contato && (rps.tomador.contato.telefone || rps.tomador.contato.email) ? {
                  Contato: {
                    ...(rps.tomador.contato.telefone ? { Telefone: rps.tomador.contato.telefone.replace(/\D/g, '') } : {}),
                    ...(rps.tomador.contato.email ? { Email: rps.tomador.contato.email } : {})
                  }
                } : {})
              },
              OptanteSimplesNacional: settings.optanteSimplesNacional || '2', // 1 = Sim, 2 = Não
              IncentivoFiscal: settings.incentivoFiscal ? '1' : '2' // 1 = Sim, 2 = Não
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
    rpsId
  };
}

// Wrapper for SOAP Envelope
export function wrapInSoapEnvelope(signedXml, method = 'EnviarLoteRpsSincrono') {
  // GestaoISS expects the raw XML inside a string parameter or nested parameter inside the SOAP body.
  // In ABRASF 2.02, it is usually:
  // <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfse="http://nfse.abrasf.org.br">
  //    <soapenv:Header/>
  //    <soapenv:Body>
  //       <nfse:EnviarLoteRpsSincronoRequest>
  //          <nfse:cabecMsg><![CDATA[<cabecalho versao="2.02" xmlns="http://www.abrasf.org.br/nfse.xsd"><versaoDados>2.02</versaoDados></cabecalho>]]></nfse:cabecMsg>
  //          <nfse:dadosMsg><![CDATA[ ... SIGNED XML ... ]]></nfse:dadosMsg>
  //       </nfse:EnviarLoteRpsSincronoRequest>
  //    </soapenv:Body>
  // </soapenv:Envelope>
  
  const cabecalho = '<cabecalho versao="2.02" xmlns="http://www.abrasf.org.br/nfse.xsd"><versaoDados>2.02</versaoDados></cabecalho>';
  
  const soapXmlObj = {
    'soapenv:Envelope': {
      '@xmlns:soapenv': 'http://schemas.xmlsoap.org/soap/envelope/',
      '@xmlns:ws': 'http://ws.integration.pmfi.pr.gov.br/', // GestaoISS Foz namespace can be fozdoiguacu or integration.
      // Wait, let's verify Foz do Iguaçu's namespace: it is usually "http://ws.integration.pmfi.pr.gov.br/" or "http://fozdoiguacupr.gestaoiss.com.br/"
      // In the WSDL, the targetNamespace is usually "http://ws.integration.pmfi.pr.gov.br/"
      'soapenv:Header': {},
      'soapenv:Body': {
        [`ws:${method}`]: {
          'ws:cabecMsg': cabecalho,
          'ws:dadosMsg': signedXml
        }
      }
    }
  };

  const doc = create({ version: '1.0', encoding: 'UTF-8' }, soapXmlObj);
  return doc.end({ prettyPrint: true });
}
