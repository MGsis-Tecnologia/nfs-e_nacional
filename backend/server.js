import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import bcrypt from 'bcryptjs';

import { loadCertificate } from './utils/xmlSigner.js';
import { generateRpsXml } from './utils/xmlGenerator.js';
import { parseResposta } from './utils/responseParser.js';
import { generateNfsePdf } from './utils/pdfGenerator.js';
import { validarEmissao, assinarEEnviar } from './utils/nfseService.js';
import * as repo from './repo.js';
import { initPrisma, isDbReady, testConnection } from './prisma.js';
import { readEnv, writeEnv, buildDatabaseUrl, ensureJwtSecret, runDbPush } from './setup.js';
import { signAdminToken, requireAdmin, requireAdminAllowQuery, requireEmissorToken } from './auth.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : '*';

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
const upload = multer({ storage: multer.memoryStorage() });

// Liveness check usado pelo HEALTHCHECK do Dockerfile.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', databaseReachable: isDbReady() });
});

// ---------- helpers ----------
// Remove dados sensíveis/pesados do emissor antes de enviar ao front.
const publicEmissor = (e) => {
  if (!e) return e;
  const { certPfxBase64, certPassword, ...rest } = e;
  return { ...rest, certConfigured: !!certPfxBase64 };
};
const certConfigDe = (e) => ({ pfxBase64: e.certPfxBase64, password: e.certPassword, filename: e.certFilename });
const dadosNfse = (responseObj) => {
  try {
    // Resposta SOAP (Foz do Iguaçu)
    if (responseObj?.soapResponse) {
      const nfse = parseResposta(responseObj.soapResponse).nfse;
      return nfse ? { numeroNfse: nfse.numero, codigoVerificacao: nfse.codigoVerificacao, chaveAcesso: nfse.chaveAcesso } : {};
    }
    // Resposta REST (nfse.gov.br)
    if (responseObj?.nfse) {
      return {
        numeroNfse: responseObj.nfse.numeroNfse || responseObj.nfse.numero,
        codigoVerificacao: responseObj.nfse.codigoVerificacao,
        chaveAcesso: responseObj.nfse.chaveAcesso
      };
    }
    // Fallback: dados diretos
    if (responseObj?.numeroNfse) {
      return {
        numeroNfse: responseObj.numeroNfse,
        codigoVerificacao: responseObj.codigoVerificacao,
        chaveAcesso: responseObj.chaveAcesso
      };
    }
    return {};
  } catch { return {}; }
};

// Bloqueia rotas de negócio enquanto o setup não terminou.
const ensureReady = (req, res, next) =>
  isDbReady() ? next() : res.status(409).json({ setupRequired: true, error: 'Sistema não configurado.' });

const parseDbUrl = (url) => {
  try {
    const u = new URL(url);
    return {
      host: u.hostname, port: u.port || '5432',
      user: decodeURIComponent(u.username),
      database: decodeURIComponent(u.pathname.replace(/^\//, '')),
      schema: u.searchParams.get('schema') || 'public'
    };
  } catch { return {}; }
};
const currentDbPassword = () => { try { return decodeURIComponent(new URL(process.env.DATABASE_URL).password); } catch { return ''; } };

// ===================== SETUP (sem auth) =====================
app.get('/api/setup/status', async (req, res) => {
  let adminCreated = false;
  if (isDbReady()) { try { adminCreated = (await repo.adminCount()) > 0; } catch { /* ignore */ } }
  res.json({ databaseConfigured: !!process.env.DATABASE_URL, databaseReachable: isDbReady(), adminCreated });
});

app.post('/api/setup/database', async (req, res) => {
  try {
    const { host, port, user, password, database, schema } = req.body || {};
    if (!user || !database) return res.status(400).json({ error: 'Informe ao menos usuário e nome do banco.' });
    const url = buildDatabaseUrl({ host, port, user, password, database, schema });
    await testConnection(url);
    await runDbPush(url);
    writeEnv({ DATABASE_URL: url });
    ensureJwtSecret();
    await initPrisma(url);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/setup/admin', async (req, res) => {
  try {
    if (!isDbReady()) return res.status(409).json({ error: 'Configure o banco de dados primeiro.' });
    if ((await repo.adminCount()) > 0) return res.status(409).json({ error: 'Administrador já existe.' });
    const { username, password } = req.body || {};
    if (!username || !password || password.length < 6) {
      return res.status(400).json({ error: 'Usuário e senha (mínimo 6 caracteres) são obrigatórios.' });
    }
    const admin = await repo.createAdmin(username, bcrypt.hashSync(password, 10));
    // Migra automaticamente o database.json (se existir) como 1º emissor.
    let migracao = null;
    try {
      const { migrarJson } = await import('./prisma/migrate-json.js');
      migracao = await migrarJson();
      if (migracao.migrated) console.log(`Migração: ${migracao.razaoSocial} + ${migracao.notas} nota(s).`);
    } catch (e) { console.warn('Migração do database.json falhou:', e.message); }
    res.json({ success: true, token: signAdminToken(admin), username: admin.username, migracao });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== AUTH =====================
app.post('/api/auth/login', ensureReady, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const admin = await repo.getAdminByUsername(username || '');
    if (!admin || !bcrypt.compareSync(password || '', admin.passwordHash)) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    }
    res.json({ token: signAdminToken(admin), username: admin.username });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===================== CONEXÃO DO BANCO (admin) =====================
app.get('/api/admin/connection', ensureReady, requireAdmin, (req, res) => {
  const info = parseDbUrl(process.env.DATABASE_URL || '');
  res.json({ ...info }); // sem a senha
});

app.post('/api/admin/connection', ensureReady, requireAdmin, async (req, res) => {
  try {
    const { host, port, user, password, database, schema } = req.body || {};
    if (!user || !database) return res.status(400).json({ error: 'Usuário e nome do banco são obrigatórios.' });
    const url = buildDatabaseUrl({ host, port, user, password: password || currentDbPassword(), database, schema });
    await testConnection(url);   // valida credenciais
    await runDbPush(url);        // garante as tabelas no banco de destino
    writeEnv({ DATABASE_URL: url });
    await initPrisma(url);       // reconecta sem reiniciar o processo
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===================== EMISSORES (admin) =====================
app.get('/api/emissores', ensureReady, requireAdmin, async (req, res) => {
  try { res.json((await repo.listEmissores()).map(publicEmissor)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/emissores/:id', ensureReady, requireAdmin, async (req, res) => {
  try {
    const e = await repo.getEmissor(req.params.id);
    if (!e) return res.status(404).json({ error: 'Emissor não encontrado.' });
    res.json(publicEmissor(e));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/emissores', ensureReady, requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.cnpj || !b.inscricaoMunicipal || !b.razaoSocial) {
      return res.status(400).json({ error: 'CNPJ, Inscrição Municipal e Razão Social são obrigatórios.' });
    }
    const cnpj = String(b.cnpj).replace(/\D/g, '');
    if (await repo.getEmissorByCnpj(cnpj)) return res.status(409).json({ error: 'Já existe um emissor com este CNPJ.' });
    const e = await repo.createEmissor({
      cnpj,
      inscricaoMunicipal: b.inscricaoMunicipal,
      razaoSocial: b.razaoSocial,
      nomeFantasia: b.nomeFantasia || null,
      cnae: b.cnae || null,
      incentivoFiscal: !!b.incentivoFiscal,
      optanteSimplesNacional: b.optanteSimplesNacional || '2',
      regimeEspecialTributacao: b.regimeEspecialTributacao || '0',
      ambiente: b.ambiente || '2',
      endereco: b.endereco || {},
      contato: b.contato || {}
    });
    res.status(201).json(publicEmissor(e));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/emissores/:id', ensureReady, requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const data = {};
    for (const k of ['inscricaoMunicipal', 'razaoSocial', 'nomeFantasia', 'cnae',
      'optanteSimplesNacional', 'regimeEspecialTributacao', 'ambiente', 'endereco', 'contato']) {
      if (k in b) data[k] = b[k];
    }
    if ('incentivoFiscal' in b) data.incentivoFiscal = !!b.incentivoFiscal;
    if (b.cnpj) data.cnpj = String(b.cnpj).replace(/\D/g, '');
    const e = await repo.updateEmissor(req.params.id, data);
    res.json(publicEmissor(e));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/emissores/:id', ensureReady, requireAdmin, async (req, res) => {
  try { await repo.deleteEmissor(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Upload de certificado do emissor (salvo no banco em base64)
app.post('/api/emissores/:id/cert', ensureReady, requireAdmin, upload.single('certificate'), async (req, res) => {
  try {
    const { password } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    loadCertificate(req.file.buffer, password); // valida senha/arquivo
    await repo.updateEmissor(req.params.id, {
      certFilename: req.file.originalname,
      certPassword: password,
      certPfxBase64: req.file.buffer.toString('base64')
    });
    res.json({ success: true, message: 'Certificado configurado e validado com sucesso!', cert: { filename: req.file.originalname } });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/emissores/:id/token/regenerate', ensureReady, requireAdmin, async (req, res) => {
  try { res.json({ apiToken: await repo.regenerateToken(req.params.id) }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/sequencias', ensureReady, requireAdmin, async (req, res) => {
  try {
    const { emissorId } = req.query;
    if (!emissorId) return res.status(400).json({ error: 'emissorId é obrigatório.' });
    res.json(await repo.getSequencias(emissorId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===================== NOTAS / RPS (admin) =====================
// PDF registrado ANTES do gate genérico, com auth flexível (aceita ?token= para window.open)
app.get('/api/rps/:id/pdf', ensureReady, requireAdminAllowQuery, async (req, res) => {
  try {
    const nota = await repo.getNota(req.params.id);
    if (!nota) return res.status(404).json({ error: 'Nota não encontrada.' });
    const nfse = nota.retorno?.soapResponse ? parseResposta(nota.retorno.soapResponse).nfse : nota.retorno?.nfse;
    if (!nfse || !nfse.numero) return res.status(400).json({ error: 'Esta nota ainda não foi autorizada.' });
    const emissor = await repo.getEmissor(nota.emissorId);
    const pdf = await generateNfsePdf(nfse, emissor || {}, nota);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="NFSe-${nfse.numero}.pdf"`);
    res.send(pdf);
  } catch (err) { res.status(500).json({ error: 'Erro ao gerar PDF: ' + err.message }); }
});

app.get('/api/rps', ensureReady, requireAdmin, async (req, res) => {
  try {
    const { emissorId, status } = req.query;
    res.json(await repo.listNotas({ emissorId, status }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/rps', ensureReady, requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.emissorId) return res.status(400).json({ error: 'emissorId é obrigatório.' });
    const emissor = await repo.getEmissor(b.emissorId);
    if (!emissor) return res.status(404).json({ error: 'Emissor não encontrado.' });
    const nota = await repo.createNota({
      emissorId: b.emissorId,
      numeroRps: String(b.numeroRps || ''),
      numeroLote: String(b.numeroLote || ''),
      serieRps: String(b.serieRps || '1'),
      dataEmissao: b.dataEmissao || new Date().toISOString(),
      competencia: b.competencia || new Date().toISOString().slice(0, 10),
      tomador: b.tomador || {},
      servico: b.servico || {},
      status: 'Rascunho',
      origem: 'FRONT'
    });
    if (nota.numeroRps) await repo.bumpSequencia(emissor.id, 'rps', nota.numeroRps);
    res.status(201).json(nota);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Gera o XML (não assinado) para visualização no modal de payloads
app.post('/api/rps/:id/generate', ensureReady, requireAdmin, async (req, res) => {
  try {
    const nota = await repo.getNota(req.params.id);
    if (!nota) return res.status(404).json({ error: 'Nota não encontrada.' });
    const emissor = await repo.getEmissor(nota.emissorId);
    const { xml } = generateRpsXml(nota, emissor);
    res.json({ xml });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/rps/:id', ensureReady, requireAdmin, async (req, res) => {
  try {
    const nota = await repo.getNota(req.params.id);
    if (!nota) return res.status(404).json({ error: 'Nota não encontrada.' });
    const b = req.body || {};
    const data = {};
    for (const k of ['numeroRps', 'numeroLote', 'serieRps', 'dataEmissao', 'competencia', 'tomador', 'servico']) {
      if (k in b) data[k] = b[k];
    }
    if (nota.status === 'Erro') data.status = 'Rascunho';
    res.json(await repo.updateNota(req.params.id, data));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/rps/:id', ensureReady, requireAdmin, async (req, res) => {
  try { await repo.deleteNota(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/rps/:id/send', ensureReady, requireAdmin, async (req, res) => {
  try {
    const nota = await repo.getNota(req.params.id);
    if (!nota) return res.status(404).json({ error: 'Nota não encontrada.' });
    const emissor = await repo.getEmissor(nota.emissorId);
    if (!emissor) return res.status(404).json({ error: 'Emissor não encontrado.' });

    const erros = validarEmissao(nota, emissor);
    if (erros.length) return res.status(400).json({ error: erros[0] });

    const { statusText, responseObj } = await assinarEEnviar(nota, emissor, certConfigDe(emissor));
    const atualizada = await repo.updateNota(nota.id, {
      status: statusText, retorno: responseObj, ...(statusText === 'Processado' ? dadosNfse(responseObj) : {})
    });
    if (statusText === 'Processado') {
      await repo.bumpSequencia(emissor.id, 'lote', nota.numeroLote);
      await repo.bumpSequencia(emissor.id, 'rps', nota.numeroRps);
    }
    res.json({ status: statusText, result: responseObj, nota: atualizada });
  } catch (err) { res.status(500).json({ error: 'Erro ao assinar/enviar RPS: ' + err.message }); }
});

// ===================== ERP (token por emissor) =====================
app.post('/api/nfse/emitir', ensureReady, requireEmissorToken, async (req, res) => {
  try {
    const emissor = req.emissor;
    const body = req.body || {};
    const seq = await repo.getSequencias(emissor.id);
    const now = new Date();
    const rps = {
      numeroRps: String(body.numeroRps || seq.proximoRps),
      numeroLote: String(body.numeroLote || seq.proximoLote),
      serieRps: String(body.serieRps || '1'),
      dataEmissao: body.dataEmissao || now.toISOString(),
      competencia: body.competencia || now.toISOString().slice(0, 10),
      tomador: body.tomador || {},
      servico: body.servico || {}
    };
    const erros = validarEmissao(rps, emissor);
    if (erros.length) return res.status(422).json({ status: 'Erro', mensagens: erros.map(m => ({ codigo: 'VALIDACAO', mensagem: m })) });

    const { statusText, responseObj } = await assinarEEnviar(rps, emissor, certConfigDe(emissor));
    const nota = await repo.createNota({
      emissorId: emissor.id, ...rps, status: statusText, origem: 'ERP',
      retorno: responseObj, ...(statusText === 'Processado' ? dadosNfse(responseObj) : {})
    });
    if (statusText === 'Processado') {
      await repo.bumpSequencia(emissor.id, 'rps', rps.numeroRps);
      await repo.bumpSequencia(emissor.id, 'lote', rps.numeroLote);
      const out = { status: 'Processado', rpsId: nota.id, nfse: responseObj.nfse, pdfUrl: `/api/nfse/chave/${responseObj.nfse?.chaveAcesso || nota.chaveAcesso}/pdf` };
      if (body.incluirPdf) out.pdfBase64 = (await generateNfsePdf(responseObj.nfse, emissor, nota)).toString('base64');
      return res.json(out);
    }
    return res.status(422).json({ status: 'Erro', rpsId: nota.id, mensagens: responseObj.mensagens || [{ codigo: 'ERRO', mensagem: responseObj.error || 'Falha no envio.' }] });
  } catch (err) { res.status(500).json({ status: 'Erro', error: err.message }); }
});

app.get('/api/nfse/:id', ensureReady, requireEmissorToken, async (req, res) => {
  try {
    const nota = await repo.getNota(req.params.id);
    if (!nota || nota.emissorId !== req.emissor.id) return res.status(404).json({ status: 'Erro', error: 'Nota não encontrada.' });
    const nfse = nota.retorno?.soapResponse ? parseResposta(nota.retorno.soapResponse).nfse : nota.retorno?.nfse;
    res.json({
      status: nota.status, rpsId: nota.id, numeroRps: nota.numeroRps,
      nfse: nfse || null, mensagens: nota.retorno?.mensagens || [],
      pdfUrl: nfse?.numero ? `/api/nfse/chave/${nfse.chaveAcesso || nota.chaveAcesso}/pdf` : null
    });
  } catch (err) { res.status(500).json({ status: 'Erro', error: err.message }); }
});

// Reimpressão do PDF da NFS-e pelo ERP, localizada pela CHAVE DE ACESSO.
app.get('/api/nfse/chave/:chave/pdf', ensureReady, requireEmissorToken, async (req, res) => {
  try {
    const nota = await repo.getNotaByChaveAcesso(req.params.chave, req.emissor.id);
    if (!nota) return res.status(404).json({ status: 'Erro', error: 'Nota não encontrada para esta chave de acesso.' });
    const nfse = nota.retorno?.soapResponse ? parseResposta(nota.retorno.soapResponse).nfse : nota.retorno?.nfse;
    if (!nfse || !nfse.numero) return res.status(400).json({ status: 'Erro', error: 'Esta nota ainda não foi autorizada.' });
    const pdf = await generateNfsePdf(nfse, req.emissor, nota);
    // Opção para clientes que preferem texto (ex.: WinDev): ?formato=base64
    // devolve JSON com o PDF em Base64, evitando corromper o binário.
    const formato = String(req.query.formato || '').toLowerCase();
    if (formato === 'base64' || formato === 'json') {
      return res.json({
        status: 'OK',
        numero: nfse.numero,
        chaveAcesso: nfse.chaveAcesso || nota.chaveAcesso || '',
        filename: `NFSe-${nfse.numero}.pdf`,
        pdfBase64: pdf.toString('base64')
      });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="NFSe-${nfse.numero}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);
  } catch (err) { res.status(500).json({ status: 'Erro', error: 'Erro ao gerar PDF: ' + err.message }); }
});

// ===================== TESTE - Homologação nfse.gov.br =====================
// Endpoints para validar integração com o novo padrão nacional
// IMPORTANTE: Apenas funciona com credenciais de teste/homologação

app.post('/api/test/nfse-gov-br/validar-conectividade', ensureReady, requireAdmin, async (req, res) => {
  try {
    const { validarCertificadoParaNfseCentral, verificarConectividadeNfseCentral, testarIntegracaoNfseCentral } = await import('./utils/nfseValidation.js');

    // Se houver um emissor com certificado, testa com ele
    const emissor = req.body?.emissorId
      ? await repo.getEmissor(req.body.emissorId)
      : await repo.getEmissores().then(e => e[0]);

    const resultado = {
      timestamp: new Date().toISOString(),
      conectividade: {},
      certificado: null,
      integracao: null
    };

    // Teste 1: Conectividade
    resultado.conectividade = await verificarConectividadeNfseCentral();

    // Teste 2: Validar certificado (se disponível)
    if (emissor?.certPfxBase64) {
      try {
        const certBuffer = Buffer.from(emissor.certPfxBase64, 'base64');
        resultado.certificado = await validarCertificadoParaNfseCentral(certBuffer, emissor.certPassword);
      } catch (err) {
        resultado.certificado = { valido: false, erro: err.message };
      }
    }

    // Teste 3: Integração completa (se tudo ok)
    if (resultado.conectividade.homologacao.status && emissor?.certPfxBase64) {
      try {
        const certBuffer = Buffer.from(emissor.certPfxBase64, 'base64');
        resultado.integracao = await testarIntegracaoNfseCentral({
          cnpj: emissor.cnpj,
          certificadoBuffer: certBuffer,
          certificadoSenha: emissor.certPassword,
          ambiente: 'homologacao'
        });
      } catch (err) {
        resultado.integracao = { sucesso: false, erro: err.message };
      }
    }

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/test/nfse-gov-br/simular-dps', ensureReady, requireAdmin, async (req, res) => {
  try {
    const { simularFluxoEnvioDps } = await import('./utils/nfseValidation.js');
    const b = req.body || {};

    if (!b.emissorId || !b.notaData) {
      return res.status(400).json({ erro: 'emissorId e notaData são obrigatórios' });
    }

    const emissor = await repo.getEmissor(b.emissorId);
    if (!emissor) return res.status(404).json({ erro: 'Emissor não encontrado' });

    const nota = b.notaData;
    const resultado = await simularFluxoEnvioDps(nota, emissor);

    res.json({
      timestamp: new Date().toISOString(),
      simulacao: resultado,
      aviso: 'Esta é uma simulação. Nenhum dado foi realmente enviado.'
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Endpoint para enviar DPS real para homologação (USE COM CUIDADO!)
app.post('/api/test/nfse-gov-br/enviar-dps', ensureReady, requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.emissorId || !b.notaId) {
      return res.status(400).json({ erro: 'emissorId e notaId são obrigatórios' });
    }

    const nota = await repo.getNota(b.notaId);
    if (!nota) return res.status(404).json({ erro: 'Nota não encontrada' });

    const emissor = await repo.getEmissor(b.emissorId);
    if (!emissor) return res.status(404).json({ erro: 'Emissor não encontrado' });

    if (!emissor.certPfxBase64) {
      return res.status(400).json({ erro: 'Certificado digital não configurado para este emissor' });
    }

    // Apenas em homologação
    if (emissor.ambiente !== '2') {
      return res.status(400).json({ erro: 'Este endpoint é apenas para homologação (ambiente=2)' });
    }

    // Validar antes de enviar
    const { validarDpsNfseCentral } = await import('./utils/dpsGenerator.js');
    const errosValidacao = validarDpsNfseCentral(nota, emissor);
    if (errosValidacao.length > 0) {
      return res.status(400).json({ erro: 'Validação falhou', erros: errosValidacao });
    }

    // Enviar para homologação
    const { assinarEEnviar } = await import('./utils/nfseService.js');
    const certConfig = { pfxBase64: emissor.certPfxBase64, password: emissor.certPassword, filename: emissor.certFilename };

    const { statusText, responseObj } = await assinarEEnviar(nota, emissor, certConfig);

    // Atualizar no banco
    const notaAtualizada = await repo.updateNota(nota.id, {
      status: statusText,
      retorno: responseObj,
      ...(statusText === 'Processado' ? {
        numeroNfse: responseObj.nfse?.numeroNfse,
        codigoVerificacao: responseObj.nfse?.codigoVerificacao,
        chaveAcesso: responseObj.nfse?.chaveAcesso
      } : {})
    });

    res.json({
      status: statusText,
      nota: notaAtualizada,
      resposta: responseObj,
      aviso: 'Enviado para HOMOLOGAÇÃO nfse.gov.br'
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===================== Frontend (build único) =====================
// Serve o SPA quando o build existe (deploy em container único). Em dev,
// frontend e backend rodam como processos separados e esta pasta não existe.
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/health') return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ===================== Boot =====================
async function boot() {
  ensureJwtSecret();
  if (process.env.DATABASE_URL) {
    // Quando o DATABASE_URL já vem pronto por variável de ambiente (ex.: Coolify),
    // o wizard de setup nunca roda — então ninguém chama "prisma db push" para
    // criar as tabelas. Garante o schema aqui antes de conectar.
    try { await runDbPush(process.env.DATABASE_URL); }
    catch (e) { console.warn('⚠️  Falha ao sincronizar o schema do banco: ' + e.message); }
    try { await initPrisma(process.env.DATABASE_URL); console.log('✅ Banco conectado.'); }
    catch (e) { console.warn('⚠️  DATABASE_URL definido mas sem conexão — entrando em modo setup. (' + e.message + ')'); }
  } else {
    console.log('ℹ️  Sem DATABASE_URL — primeira execução: o front abrirá o wizard de setup.');
  }
  app.listen(PORT, HOST, () => console.log(`Backend rodando em http://${HOST}:${PORT}`));
}
boot();
