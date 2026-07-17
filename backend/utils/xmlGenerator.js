import { create } from 'xmlbuilder2';

// Helper to format decimals to 2 decimal places (aceita vírgula: "100,00" -> 100.00)
const formatDecimal = (val) => {
  const num = parseFloat(String(val).replace(',', '.'));
  return isNaN(num) ? '0.00' : num.toFixed(2);
};

// Helper to format aliquot to 4 decimal places (aceita vírgula: "3,7610" -> 3.7610)
const formatAliquota = (val) => {
  const num = parseFloat(String(val).replace(',', '.'));
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

  // Regime Especial de Tributação.
  // ATENÇÃO: o XSD (tsRegimeEspecialTributacao) só aceita UM dígito: 1|2|3|4|5|6.
  // A mensagem de erro da prefeitura fala em "05/06" (dois dígitos), mas isso é só
  // a descrição humana — no XML tem que ir 1 dígito (5 = MEI, 6 = ME/EPP).
  // Aqui aceitamos "05"/"5"/"06"/"6" da config e normalizamos para 1 dígito; "0"/vazio = omitir.
  const regimeNum = parseInt(settings.regimeEspecialTributacao, 10);
  const regimeEspecial = (regimeNum >= 1 && regimeNum <= 6) ? String(regimeNum) : null;

  // Endereço do tomador: omite campos vazios (o XSD não aceita <Bairro/>, <Endereco/> etc. vazios).
  // Ordem ABRASF (tcEndereco): Endereco(logradouro), Numero, Complemento, Bairro, CodigoMunicipio, Uf, Cep.
  const te = rps.tomador.endereco || {};
  const teCep = (te.cep || '').replace(/\D/g, '');
  const tomadorEndereco = {
    ...(te.logradouro ? { Endereco: te.logradouro } : {}),
    ...(te.numero ? { Numero: te.numero } : {}),
    ...(te.complemento ? { Complemento: te.complemento } : {}),
    ...(te.bairro ? { Bairro: te.bairro } : {}),
    CodigoMunicipio: te.codigoMunicipio || '4108304',
    Uf: te.uf || 'PR',
    ...(teCep ? { Cep: teCep } : {})
  };

  const xmlObj = {
    EnviarLoteRpsSincronoEnvio: {
      '@xmlns': 'http://www.abrasf.org.br/nfse.xsd',
      LoteRps: {
        '@Id': loteId,
        '@versao': '2.02',
        NumeroLote: '1', // fixo em 1: sem controle de sequência de lote; incrementa apenas o RPS
        // ABRASF 2.02: LoteRps -> CpfCnpj + InscricaoMunicipal (NÃO existe <Prestador> aqui)
        CpfCnpj: { Cnpj: cleanedCnpjPrestador },
        InscricaoMunicipal: settings.inscricaoMunicipal.replace(/\D/g, ''),
        QuantidadeRps: '1',
        ListaRps: {
          Rps: {
            InfDeclaracaoPrestacaoServico: {
              '@Id': rpsId,
              Rps: {
                '@Id': `Rps1_${rps.numeroRps}_${cleanedCnpjPrestador}`,
                IdentificacaoRps: {
                  Numero: rps.numeroRps,
                  Serie: rps.serieRps || '1',
                  Tipo: '1' // 1 = RPS
                },
                DataEmissao: formatDate(rps.dataEmissao).substring(0, 10), // Apenas data, sem hora
                Status: '1' // 1 = Normal
              },
              Competencia: rps.competencia ? rps.competencia.substring(0, 10) : formatDate(rps.dataEmissao).substring(0, 10),
              Servico: {
                Valores: {
                  // Ordem ABRASF (tcValoresDeclaracaoServico): ValorServicos ... ValorIss, Aliquota, ...
                  ValorServicos: formatDecimal(rps.servico.valorServicos),
                  // Aliquota aceita 4 casas decimais (tsAliquota: totalDigits=6, fractionDigits=4). Ex.: 3.7610
                  ...(parseFloat(String(rps.servico.aliquota).replace(',', '.')) > 0
                    ? { Aliquota: formatAliquota(rps.servico.aliquota) }
                    : {})
                },
                IssRetido: rps.servico.issRetido || '2', // 1 = Sim, 2 = Não
                ItemListaServico: rps.servico.itemListaServico.replace('.', ''), // Remove ponto: 01.07 → 0107
                CodigoCnae: (settings.cnae || '').replace(/\D/g, ''),
                CodigoTributacaoMunicipio: rps.servico.codigoTributacaoMunicipio, // Obrigatório
                Discriminacao: rps.servico.discriminacao,
                CodigoMunicipio: rps.servico.codigoMunicipio || '4108304', // Foz do Iguaçu
                ExigibilidadeISS: rps.servico.exigibilidadeIss || '1', // 1 = Exigível (note: ISS em maiúsculo)
                MunicipioIncidencia: rps.servico.municipioIncidencia || '4108304'
              },
              Prestador: {
                // ABRASF 2.02: tcIdentificacaoPrestador -> CpfCnpj{Cnpj} + InscricaoMunicipal
                CpfCnpj: { Cnpj: cleanedCnpjPrestador },
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
                Endereco: tomadorEndereco,
                ...(rps.tomador.contato && (rps.tomador.contato.telefone || rps.tomador.contato.email) ? {
                  Contato: {
                    ...(rps.tomador.contato.telefone ? { Telefone: rps.tomador.contato.telefone.replace(/\D/g, '') } : {}),
                    ...(rps.tomador.contato.email ? { Email: rps.tomador.contato.email } : {})
                  }
                } : {})
              },
              // Posição ABRASF 2.02: RegimeEspecialTributacao vem ANTES de OptanteSimplesNacional
              ...(regimeEspecial ? { RegimeEspecialTributacao: regimeEspecial } : {}),
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
export function wrapInSoapEnvelope(signedXml, method = 'RecepcionarLoteRpsSincronoRequest') {
  const cabecalho = '<cabecalho versao="2.02" xmlns="http://www.abrasf.org.br/nfse.xsd"><versaoDados>2.02</versaoDados></cabecalho>';
  
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
