// Migra o backend/database.json (mono-emissor) para o PostgreSQL como o 1º emissor.
// Idempotente: se o CNPJ já existir, não duplica.
// Pode ser usado como função (a partir do server, após o setup) ou como script CLI.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as repo from '../repo.js';
import { parseResposta } from '../utils/responseParser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_PATH = path.join(__dirname, '..', 'database.json');

export async function migrarJson() {
  if (!fs.existsSync(JSON_PATH)) return { migrated: false, reason: 'sem database.json' };

  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const s = data.settings || {};
  const cnpj = (s.cnpj || '').replace(/\D/g, '');
  if (!cnpj) return { migrated: false, reason: 'database.json sem CNPJ' };

  if (await repo.getEmissorByCnpj(cnpj)) return { migrated: false, reason: `emissor ${cnpj} já existe` };

  const cert = data.cert || {};
  const seq = data.sequencias || { proximoRps: 1, proximoLote: 1 };

  const emissor = await repo.createEmissor({
    cnpj,
    inscricaoMunicipal: s.inscricaoMunicipal || '',
    razaoSocial: s.razaoSocial || '',
    nomeFantasia: s.nomeFantasia || null,
    cnae: s.cnae || null,
    incentivoFiscal: !!s.incentivoFiscal,
    optanteSimplesNacional: s.optanteSimplesNacional || '2',
    regimeEspecialTributacao: s.regimeEspecialTributacao || '0',
    ambiente: s.ambiente || '2',
    endereco: s.endereco || {},
    contato: s.contato || {},
    certFilename: cert.filename || null,
    certPassword: cert.password || null,
    certPfxBase64: cert.pfxBase64 || null,
    ...(data.apiKey ? { apiToken: data.apiKey } : {}),
    proximoRps: parseInt(seq.proximoRps, 10) || 1,
    proximoLote: parseInt(seq.proximoLote, 10) || 1
  });

  let n = 0;
  for (const r of (data.rps || [])) {
    let nfse = null;
    try { if (r.retorno?.soapResponse) nfse = parseResposta(r.retorno.soapResponse).nfse; } catch { /* ignore */ }
    await repo.createNota({
      emissorId: emissor.id,
      numeroRps: String(r.numeroRps || ''),
      numeroLote: String(r.numeroLote || ''),
      serieRps: String(r.serieRps || '1'),
      dataEmissao: r.dataEmissao || '',
      competencia: r.competencia || '',
      tomador: r.tomador || {},
      servico: r.servico || {},
      status: r.status || 'Rascunho',
      origem: r.origem || 'FRONT',
      numeroNfse: nfse?.numero || null,
      codigoVerificacao: nfse?.codigoVerificacao || null,
      chaveAcesso: nfse?.chaveAcesso || null,
      retorno: r.retorno || null,
      ...(r.dataCriacao ? { createdAt: new Date(r.dataCriacao) } : {})
    });
    n++;
  }
  return { migrated: true, emissorId: emissor.id, razaoSocial: emissor.razaoSocial, notas: n };
}

// Execução como script CLI: node prisma/migrate-json.js
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('prisma/migrate-json.js')) {
  const dotenv = await import('dotenv');
  dotenv.config({ path: path.join(__dirname, '..', '.env') });
  const { initPrisma } = await import('../prisma.js');
  await initPrisma(process.env.DATABASE_URL);
  migrarJson()
    .then((r) => { console.log(JSON.stringify(r)); process.exit(0); })
    .catch((e) => { console.error('Erro na migração:', e.message); process.exit(1); });
}
