// Utilitário para interpretar a resposta SOAP da prefeitura (GestãoISS / ABRASF 2.02).
// A resposta real vem HTML-escapada dentro de <outputXML> (&lt;...&gt;), então precisa
// ser decodificada antes de qualquer parse.

export function decodeXmlEntities(str) {
  if (!str) return '';
  return String(str)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x?\d+;/g, (m) => {
      const hex = /&#x/i.test(m);
      const code = parseInt(m.replace(/&#x?|;/gi, ''), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : m;
    })
    .replace(/&amp;/g, '&'); // por último, para não desfazer entidades acima
}

// Pega o conteúdo "de verdade" da resposta: desembrulha <outputXML> e desescapa.
export function extractInnerXml(soapResponse) {
  if (!soapResponse) return '';
  const m = String(soapResponse).match(/<outputXML[^>]*>([\s\S]*?)<\/outputXML>/i);
  const inner = m ? m[1] : String(soapResponse);
  return decodeXmlEntities(inner).trim();
}

const tag = (xml, name) => {
  if (!xml) return null;
  const m = xml.match(new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`, 'i'));
  // decode novamente: o conteúdo pode trazer entidades duplas (ex.: &amp;amp; -> &)
  return m ? decodeXmlEntities(m[1].trim()) : null;
};

// Extrai o conteúdo completo (com as tags) de um elemento — útil para isolar um sub-bloco.
const block = (xml, name) => {
  if (!xml) return null;
  const m = xml.match(new RegExp(`<(?:\\w+:)?${name}\\b[\\s\\S]*?<\\/(?:\\w+:)?${name}>`, 'i'));
  return m ? m[0] : null;
};

// Endereço: recebe o bloco PAI (Prestador/Tomador). O container <Endereco> tem um
// <Endereco> aninhado (o logradouro), então isolamos do 1º "<Endereco" até o ÚLTIMO "</Endereco>".
const parseEndereco = (parentBlock) => {
  if (!parentBlock) return null;
  const open = parentBlock.search(/<(?:\w+:)?Endereco\b/i);
  const close = parentBlock.toLowerCase().lastIndexOf('</endereco>');
  if (open === -1 || close === -1) return null;
  const cont = parentBlock.slice(open, close + '</endereco>'.length);
  // remove o wrapper externo <Endereco>...</Endereco>, sobrando os campos internos
  // (incluindo o <Endereco> aninhado = logradouro)
  const inner = cont
    .replace(/^<(?:\w+:)?Endereco\b[^>]*>/i, '')
    .replace(/<\/(?:\w+:)?Endereco>\s*$/i, '');

  return {
    logradouro: tag(inner, 'Endereco'),
    numero: tag(inner, 'Numero'),
    complemento: tag(inner, 'Complemento'),
    bairro: tag(inner, 'Bairro'),
    codigoMunicipio: tag(inner, 'CodigoMunicipio'),
    uf: tag(inner, 'Uf'),
    cep: tag(inner, 'Cep')
  };
};

const parseContato = (xml) => {
  if (!xml) return null;
  return { telefone: tag(xml, 'Telefone'), email: tag(xml, 'Email') };
};

// Lista todas as <MensagemRetorno> (Codigo/Mensagem/Correcao).
export function parseMensagens(innerXml) {
  const out = [];
  const re = /<(?:\w+:)?MensagemRetorno\b[^>]*>([\s\S]*?)<\/(?:\w+:)?MensagemRetorno>/gi;
  let m;
  while ((m = re.exec(innerXml)) !== null) {
    const bloco = m[1];
    out.push({
      codigo: tag(bloco, 'Codigo') || '',
      mensagem: tag(bloco, 'Mensagem') || '',
      correcao: tag(bloco, 'Correcao') || ''
    });
  }
  return out;
}

// Limpa o campo OutrasInformacoes (a Foz codifica quebras como "\s\n").
const limparOutrasInfo = (txt) => {
  if (!txt) return null;
  return txt
    .replace(/\\s\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .split('\n').map(s => s.trim()).filter(Boolean).join('\n');
};

// A chave de acesso da NFS-e Nacional tem 50 dígitos. No ABRASF 2.02 (Foz) ela
// não vem em tag própria: aparece como texto dentro de OutrasInformacoes
// ("Chave de Acesso da NFS-e Nacional: <50 dígitos>"). Aqui tentamos a tag e,
// como fallback, extraímos os 50 dígitos do texto.
const extrairChaveAcesso = (x, outrasInfoRaw) =>
  tag(x, 'ChaveAcesso')
  || outrasInfoRaw?.match(/Chave de Acesso[^:]*:\s*(\d{50})/i)?.[1]
  || outrasInfoRaw?.match(/\b(\d{50})\b/)?.[1]
  || '';

// Extrai TODOS os dados da NFS-e autorizada (para exibição e PDF/DANFSE).
export function parseNfse(innerXml) {
  const x = block(innerXml, 'InfNfse');
  if (!x) return null;

  const v = block(x, 'ValoresNfse');
  const prestadorBloco = block(x, 'PrestadorServico');
  const decl = block(x, 'DeclaracaoPrestacaoServico');
  const tomadorBloco = block(decl, 'Tomador');
  const servicoBloco = block(decl, 'Servico');
  const rpsBloco = block(decl, 'Rps');
  const outrasInfoRaw = tag(x, 'OutrasInformacoes');

  return {
    numero: tag(x, 'Numero'),
    codigoVerificacao: tag(x, 'CodigoVerificacao'),
    dataEmissao: tag(x, 'DataEmissao'),
    chaveAcesso: extrairChaveAcesso(x, outrasInfoRaw),
    outrasInformacoes: limparOutrasInfo(outrasInfoRaw),
    competencia: tag(decl, 'Competencia'),
    valores: {
      baseCalculo: tag(v, 'BaseCalculo'),
      aliquota: tag(v, 'Aliquota'),
      valorIss: tag(v, 'ValorIss'),
      valorLiquidoNfse: tag(v, 'ValorLiquidoNfse')
    },
    prestador: prestadorBloco ? {
      razaoSocial: tag(prestadorBloco, 'RazaoSocial'),
      nomeFantasia: tag(prestadorBloco, 'NomeFantasia'),
      cnpj: tag(block(prestadorBloco, 'IdentificacaoPrestador'), 'Cnpj'),
      inscricaoMunicipal: tag(block(prestadorBloco, 'IdentificacaoPrestador'), 'InscricaoMunicipal'),
      endereco: parseEndereco(prestadorBloco),
      contato: parseContato(block(prestadorBloco, 'Contato'))
    } : null,
    tomador: tomadorBloco ? {
      razaoSocial: tag(tomadorBloco, 'RazaoSocial'),
      cnpj: tag(block(tomadorBloco, 'IdentificacaoTomador'), 'Cnpj'),
      cpf: tag(block(tomadorBloco, 'IdentificacaoTomador'), 'Cpf'),
      endereco: parseEndereco(tomadorBloco),
      contato: parseContato(block(tomadorBloco, 'Contato'))
    } : null,
    servico: servicoBloco ? {
      valorServicos: tag(block(servicoBloco, 'Valores'), 'ValorServicos'),
      itemListaServico: tag(servicoBloco, 'ItemListaServico'),
      codigoCnae: tag(servicoBloco, 'CodigoCnae'),
      codigoTributacaoMunicipio: tag(servicoBloco, 'CodigoTributacaoMunicipio'),
      discriminacao: tag(servicoBloco, 'Discriminacao'),
      issRetido: tag(servicoBloco, 'IssRetido'),
      codigoMunicipio: tag(servicoBloco, 'CodigoMunicipio')
    } : null,
    rps: rpsBloco ? {
      numero: tag(block(rpsBloco, 'IdentificacaoRps'), 'Numero'),
      serie: tag(block(rpsBloco, 'IdentificacaoRps'), 'Serie')
    } : null
  };
}

// Decide o status final a partir da resposta bruta.
// Retorna { status: 'Processado' | 'Erro', mensagens: [], nfse: {} | null, innerXml }
export function parseResposta(soapResponse) {
  const innerXml = extractInnerXml(soapResponse);
  const mensagens = parseMensagens(innerXml);
  const nfse = parseNfse(innerXml);

  const temNfse = /<(?:\w+:)?(CompNfse|Nfse)\b/i.test(innerXml) ||
                  /<(?:\w+:)?NumeroNfse\b/i.test(innerXml) ||
                  (nfse && nfse.numero);
  const temErro = /<(?:\w+:)?ListaMensagemRetorno\b/i.test(innerXml) ||
                  /<(?:\w+:)?ListaMensagemRetornoLote\b/i.test(innerXml);

  let status;
  if (temNfse && !temErro) status = 'Processado';
  else if (temErro) status = 'Erro';
  else status = temNfse ? 'Processado' : 'Erro';

  return { status, mensagens, nfse, innerXml };
}
