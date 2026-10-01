// Gerador da DPS (Declaração de Prestação de Serviço) da NFS-e Nacional.
// Leiaute v1.01 - ordem dos elementos conforme tiposComplexos_v1.01.xsd
// (XSDs oficiais em backend/schemas/v1.01).

const NAMESPACE_DPS = 'http://www.sped.fazenda.gov.br/nfse';
const VERSAO_LEIAUTE = '1.01';
const VERSAO_APLICATIVO = 'nfse-emissor-1.0';

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');

function escaparXml(valor) {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Campos de texto (TSString) não aceitam quebra de linha/caracteres de controle.
const textoLinha = (v) => String(v ?? '').replace(/[\x00-\x1f\x7f]+/g, ' ').trim();

function tag(nome, valor) {
  return valor === undefined || valor === null || valor === '' ? '' : `<${nome}>${escaparXml(valor)}</${nome}>`;
}

function paraNumero(valor) {
  const n = parseFloat(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

const decimal2 = (valor) => paraNumero(valor).toFixed(2);

// dhEmi no fuso de Brasília (-03:00), sem milissegundos. Recuado 1 min para a
// SEFIN não rejeitar por "data/hora de emissão posterior ao processamento".
function dataHoraBrasilia(date = new Date(Date.now() - 60_000)) {
  const local = new Date(date.getTime() - 3 * 3600_000);
  return local.toISOString().slice(0, 19) + '-03:00';
}

function dataBrasilia(date = new Date()) {
  return new Date(date.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Id da DPS: "DPS" + cMun emissor (7) + tipo inscrição (1=CPF, 2=CNPJ)
 * + inscrição federal (14) + série (5) + número (15).
 */
export function gerarIdDps({ cnpjCpf, codigoMunicipio, serie, numero }) {
  const doc = soDigitos(cnpjCpf);
  const tipo = doc.length === 14 ? '2' : '1';
  return `DPS${soDigitos(codigoMunicipio).padStart(7, '0')}${tipo}${doc.padStart(14, '0')}` +
    `${soDigitos(serie).padStart(5, '0')}${soDigitos(numero).padStart(15, '0')}`;
}

// Código de tributação nacional (6 dígitos): item(2) + subitem(2) + desdobro(2).
// Aceita um código já pronto (servico.codigoTributacaoNacional) ou deriva do
// item da LC 116 ("14.01" -> "140101").
export function derivarCodigoTributacaoNacional(servico = {}) {
  const pronto = soDigitos(servico.codigoTributacaoNacional);
  if (pronto.length === 6) return pronto;
  const partes = String(servico.itemListaServico || '').split(/[.\-]/).map(soDigitos).filter(Boolean);
  if (partes.length >= 2) {
    return partes[0].padStart(2, '0') + partes[1].padStart(2, '0') + (partes[2] || '01').padStart(2, '0');
  }
  const digitos = soDigitos(servico.itemListaServico);
  if (digitos.length === 4) return digitos + '01';
  if (digitos.length === 6) return digitos;
  return '';
}

// O cadastro do emissor usa os códigos ABRASF; a DPS usa outra tabela.
function regimeTributario(emissor) {
  const regimeAbrasf = parseInt(emissor.regimeEspecialTributacao, 10) || 0;
  const optante = emissor.optanteSimplesNacional === '1';

  // opSimpNac: 1 = Não optante, 2 = MEI, 3 = ME/EPP
  let opSimpNac = '1';
  if (optante) opSimpNac = regimeAbrasf === 5 ? '2' : '3';

  // regEspTrib nacional: 0 Nenhum, 1 Ato cooperado, 2 Estimativa,
  // 3 Microempresa municipal, 4 Notário/registrador, 5 Profissional autônomo,
  // 6 Sociedade de profissionais, 9 Outros
  const mapaRegEsp = { 1: '3', 2: '2', 3: '6', 4: '1' };
  const regEspTrib = mapaRegEsp[regimeAbrasf] || '0';

  // regApTribSN (só ME/EPP): 1 = tributos federais e municipal pelo SN
  const regApTribSN = opSimpNac === '3' ? '1' : undefined;

  return { opSimpNac, regApTribSN, regEspTrib };
}

function xmlEndereco(end = {}) {
  return (
    `<end>` +
    `<endNac>${tag('cMun', soDigitos(end.codigoMunicipio))}${tag('CEP', soDigitos(end.cep))}</endNac>` +
    tag('xLgr', textoLinha(end.logradouro)) +
    tag('nro', textoLinha(end.numero) || 'S/N') +
    tag('xCpl', textoLinha(end.complemento)) +
    tag('xBairro', textoLinha(end.bairro)) +
    `</end>`
  );
}

function xmlDocumento(cpfCnpj) {
  const doc = soDigitos(cpfCnpj);
  return doc.length === 14 ? tag('CNPJ', doc) : tag('CPF', doc);
}

function xmlPrestador(emissor) {
  const reg = regimeTributario(emissor);
  const contato = emissor.contato || {};
  // Emitente = prestador (tpEmit 1): nome e endereço vêm do cadastro CNC,
  // por isso xNome/end não são informados aqui. A IM também não: a SEFIN
  // rejeita (E0120) quando o município não tem dados complementares no CNC.
  return (
    `<prest>` +
    xmlDocumento(emissor.cnpj) +
    tag('fone', soDigitos(contato.telefone)) +
    tag('email', textoLinha(contato.email)) +
    `<regTrib>${tag('opSimpNac', reg.opSimpNac)}${tag('regApTribSN', reg.regApTribSN)}${tag('regEspTrib', reg.regEspTrib)}</regTrib>` +
    `</prest>`
  );
}

function xmlTomador(tomador) {
  const contato = tomador.contato || {};
  const end = tomador.endereco || {};
  return (
    `<toma>` +
    xmlDocumento(tomador.cpfCnpj) +
    tag('IM', soDigitos(tomador.inscricaoMunicipal)) +
    tag('xNome', textoLinha(tomador.razaoSocial)) +
    (end.cep && end.codigoMunicipio ? xmlEndereco(end) : '') +
    tag('fone', soDigitos(contato.telefone)) +
    tag('email', textoLinha(contato.email)) +
    `</toma>`
  );
}

function xmlServico(servico, codigoMunicipioPrestacao) {
  const cTribMun = soDigitos(servico.codigoTributacaoMunicipio);
  return (
    `<serv>` +
    `<locPrest>${tag('cLocPrestacao', codigoMunicipioPrestacao)}</locPrest>` +
    `<cServ>` +
    tag('cTribNac', derivarCodigoTributacaoNacional(servico)) +
    (cTribMun.length === 3 ? tag('cTribMun', cTribMun) : '') +
    // xDescServ é o único texto que aceita quebra de linha.
    tag('xDescServ', String(servico.discriminacao || '').trim()) +
    tag('cNBS', soDigitos(servico.codigoNbs)) +
    `</cServ>` +
    `</serv>`
  );
}

function xmlValores(servico, reg) {
  const desconto = paraNumero(servico.descontoIncondicionado);
  // tribISSQN: 1 Tributável, 2 Imunidade, 3 Exportação, 4 Não incidência
  const tribISSQN = ['1', '2', '3', '4'].includes(String(servico.tributacaoIssqn)) ? String(servico.tributacaoIssqn) : '1';
  // tpRetISSQN: 1 Não retido, 2 Retido pelo tomador, 3 Retido pelo intermediário
  const tpRetISSQN = servico.issRetido === '1' ? '2' : '1';
  // Alíquota só vai na DPS para optante ME/EPP; nos demais casos a SEFIN
  // usa a alíquota parametrizada pelo município.
  const aliquota = paraNumero(servico.aliquota);
  const pAliq = reg.opSimpNac === '3' && aliquota > 0 ? aliquota.toFixed(2) : '';

  return (
    `<valores>` +
    `<vServPrest>${tag('vServ', decimal2(servico.valorServicos))}</vServPrest>` +
    (desconto > 0 ? `<vDescCondIncond>${tag('vDescIncond', desconto.toFixed(2))}</vDescCondIncond>` : '') +
    `<trib>` +
    `<tribMun>${tag('tribISSQN', tribISSQN)}${tag('tpRetISSQN', tpRetISSQN)}${tag('pAliq', pAliq)}</tribMun>` +
    `<totTrib>${tag('indTotTrib', '0')}</totTrib>` +
    `</trib>` +
    `</valores>`
  );
}

export function codigoMunicipioEmissor(emissor) {
  return soDigitos(emissor.municipioCodigoIbge || emissor.endereco?.codigoMunicipio);
}

/**
 * Monta o XML da DPS (não assinado).
 * @returns {{ dpsXml: string, dpsId: string, metadados: object }}
 */
export function gerarDpsXmlNfseCentral(nota, emissor) {
  const cLocEmi = codigoMunicipioEmissor(emissor);
  if (cLocEmi.length !== 7) {
    throw new Error('Código IBGE do município do emissor (7 dígitos) é obrigatório. Configure no cadastro do emissor.');
  }
  const serie = soDigitos(nota.serieRps) || '1';
  const nDPS = String(parseInt(soDigitos(nota.numeroRps), 10) || '');
  if (!nDPS || nDPS === '0') throw new Error('Número da DPS inválido.');

  const servico = nota.servico || {};
  const cTribNac = derivarCodigoTributacaoNacional(servico);
  if (!cTribNac) {
    throw new Error('Código de tributação nacional não informado: preencha o Item da Lista de Serviço (ex.: 14.01).');
  }

  const dpsId = gerarIdDps({ cnpjCpf: emissor.cnpj, codigoMunicipio: cLocEmi, serie, numero: nDPS });
  const reg = regimeTributario(emissor);
  const dCompet = (nota.competencia || '').slice(0, 10) || dataBrasilia();
  const codigoMunicipioPrestacao = soDigitos(servico.codigoMunicipio) || cLocEmi;

  const infDps =
    tag('tpAmb', emissor.ambiente === '1' ? '1' : '2') +
    tag('dhEmi', dataHoraBrasilia()) +
    tag('verAplic', VERSAO_APLICATIVO) +
    tag('serie', serie) +
    tag('nDPS', nDPS) +
    tag('dCompet', dCompet) +
    tag('tpEmit', '1') +
    tag('cLocEmi', cLocEmi) +
    xmlPrestador(emissor) +
    (nota.tomador?.cpfCnpj ? xmlTomador(nota.tomador) : '') +
    xmlServico(servico, codigoMunicipioPrestacao) +
    xmlValores(servico, reg);

  const dpsXml =
    `<DPS xmlns="${NAMESPACE_DPS}" versao="${VERSAO_LEIAUTE}">` +
    `<infDPS Id="${dpsId}">${infDps}</infDPS>` +
    `</DPS>`;

  const metadados = {
    cnpj: emissor.cnpj,
    idDps: dpsId,
    numeroDps: nDPS,
    serie,
    cLocEmi,
    cTribNac,
    codigoMunicipioPrestacao,
    valorServico: servico.valorServicos,
    tipoDocumento: 'DPS',
    versaoLeiaute: VERSAO_LEIAUTE
  };

  return { dpsXml, dpsId, metadados };
}

/**
 * Valida se uma DPS tem os dados obrigatórios (retorna array de erros).
 */
export function validarDpsNfseCentral(nota, emissor) {
  const erros = [];

  if (!emissor.cnpj) erros.push('CNPJ do emissor obrigatório');
  if (codigoMunicipioEmissor(emissor).length !== 7) {
    erros.push('Código IBGE do município do emissor (7 dígitos) obrigatório');
  }
  if (!nota.numeroRps || !(parseInt(soDigitos(nota.numeroRps), 10) > 0)) erros.push('Número da DPS obrigatório');

  const servico = nota.servico;
  if (!servico) {
    erros.push('Dados do serviço obrigatórios');
  } else {
    if (!(paraNumero(servico.valorServicos) > 0)) erros.push('Valor do serviço deve ser maior que zero');
    if (!derivarCodigoTributacaoNacional(servico)) {
      erros.push('Item da Lista de Serviço (ex.: 14.01) ou código de tributação nacional (6 dígitos) obrigatório');
    }
    if (!servico.discriminacao) erros.push('Descrição do serviço obrigatória');
  }

  const tomador = nota.tomador;
  if (tomador?.cpfCnpj) {
    const doc = soDigitos(tomador.cpfCnpj);
    if (doc.length !== 11 && doc.length !== 14) erros.push('CPF/CNPJ do tomador inválido');
    if (!tomador.razaoSocial) erros.push('Nome/Razão Social do tomador obrigatório');
    const end = tomador.endereco || {};
    if (end.cep || end.codigoMunicipio) {
      if (soDigitos(end.cep).length !== 8) erros.push('CEP do tomador deve ter 8 dígitos');
      if (soDigitos(end.codigoMunicipio).length !== 7) erros.push('Código IBGE do município do tomador (7 dígitos) obrigatório');
      if (!end.logradouro) erros.push('Logradouro do tomador obrigatório');
      if (!end.bairro) erros.push('Bairro do tomador obrigatório');
    }
  }

  if (emissor.optanteSimplesNacional === '1') {
    const regime = parseInt(emissor.regimeEspecialTributacao, 10);
    if (![5, 6].includes(regime)) {
      erros.push('Optante Simples Nacional: Regime Especial deve ser 5 (MEI) ou 6 (ME/EPP)');
    }
  }

  return erros;
}

// Mantido por compatibilidade com scripts de teste antigos.
export function prepararPayloadNfseCentral(dpsXmlAssinado) {
  return { dpsXml: dpsXmlAssinado };
}

/**
 * Extrai os dados da NFS-e gerada a partir da resposta da SEFIN
 * ({ chaveAcesso, idDps, nfseXml, ... }).
 */
export function extrairDadosNfseResposta(responseData, nfseXml = '') {
  if (!responseData && !nfseXml) return {};
  const pegar = (nome) => nfseXml.match(new RegExp(`<${nome}>([^<]*)</${nome}>`))?.[1];
  const chaveAcesso = responseData?.chaveAcesso || nfseXml.match(/Id="NFS(\d{50})"/)?.[1];

  return {
    numeroNfse: pegar('nNFSe'),
    codigoVerificacao: chaveAcesso,
    chaveAcesso,
    idDps: responseData?.idDps,
    dataAutorizacao: pegar('dhProc') || responseData?.dataHoraProcessamento,
    status: 'PROCESSADO'
  };
}
