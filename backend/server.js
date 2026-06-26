import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { generateRpsXml } from './utils/xmlGenerator.js';
import { loadCertificate } from './utils/xmlSigner.js';
import { parseResposta } from './utils/responseParser.js';
import { generateNfsePdf } from './utils/pdfGenerator.js';
import { validarEmissao, assinarEEnviar } from './utils/nfseService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Multer em memória: o certificado é salvo no banco (base64), não em disco.
// Assim o .pfx viaja junto do banco versionado e funciona em outra máquina.
const upload = multer({ storage: multer.memoryStorage() });

// API: Settings
app.get('/api/settings', (req, res) => {
  try {
    const settings = db.getSettings();
    const cert = db.getCert();
    res.json({
      settings,
      cert: cert && cert.pfxBase64 ? { filename: cert.filename, passwordConfigured: !!cert.password } : null,
      apiKey: db.getApiKey()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const newSettings = db.saveSettings(req.body);
    res.json(newSettings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Upload Certificate
app.post('/api/settings/cert', upload.single('certificate'), (req, res) => {
  try {
    const { password } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }

    const fileBuffer = req.file.buffer; // memoryStorage -> buffer em memória

    // Valida o certificado e a senha imediatamente
    loadCertificate(fileBuffer, password);

    // Se válido, salva NO BANCO (base64) para ser portável/versionável
    db.saveCert({
      filename: req.file.originalname,
      password: password,
      pfxBase64: fileBuffer.toString('base64')
    });

    res.json({
      success: true,
      message: "Certificado digital configurado e validado com sucesso!",
      cert: {
        filename: req.file.originalname,
        passwordConfigured: true
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// API: Gerar nova API Key (invalida a anterior). Aberto ao front local.
app.post('/api/settings/apikey/regenerate', (req, res) => {
  try {
    const apiKey = db.regenerateApiKey();
    res.json({ apiKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Sequências (próximo nº de RPS e Lote) — usado para pré-preencher o formulário
app.get('/api/sequencias', (req, res) => {
  try {
    res.json(db.getSequencias());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: RPS (CRUD)
app.get('/api/rps', (req, res) => {
  try {
    const rpsList = db.getRpsList();
    res.json(rpsList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rps', (req, res) => {
  try {
    const rpsList = db.getRpsList();
    const newRps = {
      ...req.body,
      id: Date.now().toString(),
      status: 'Rascunho', // Rascunho, Gerado, Assinado, Enviado, Processado, Erro
      dataCriacao: new Date().toISOString(),
      retorno: null
    };
    rpsList.push(newRps);
    db.saveRpsList(rpsList);
    // Mantém a numeração de RPS sempre à frente do que já foi usado
    if (newRps.numeroRps) db.bumpSequencia('rps', newRps.numeroRps);
    res.status(201).json(newRps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/rps/:id', (req, res) => {
  try {
    const { id } = req.params;
    const rpsList = db.getRpsList();
    const index = rpsList.findIndex(r => r.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "RPS não encontrado." });
    }

    rpsList[index] = {
      ...rpsList[index],
      ...req.body,
      // Se estava com erro, volta a ser rascunho ao editar
      status: rpsList[index].status === 'Erro' ? 'Rascunho' : rpsList[index].status
    };
    db.saveRpsList(rpsList);
    res.json(rpsList[index]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/rps/:id', (req, res) => {
  try {
    const { id } = req.params;
    let rpsList = db.getRpsList();
    rpsList = rpsList.filter(r => r.id !== id);
    db.saveRpsList(rpsList);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Generate XML (Unsigned)
app.post('/api/rps/:id/generate', (req, res) => {
  try {
    const { id } = req.params;
    const rpsList = db.getRpsList();
    const rps = rpsList.find(r => r.id === id);
    if (!rps) {
      return res.status(404).json({ error: "RPS não encontrado." });
    }

    const settings = db.getSettings();
    if (!settings.cnpj || !settings.inscricaoMunicipal) {
      return res.status(400).json({ error: "Configurações do emissor incompletas (CNPJ/Inscrição Municipal)." });
    }

    // Validate required RPS fields
    if (!rps.numeroRps) {
      return res.status(400).json({ error: "Número do RPS é obrigatório." });
    }
    if (!rps.servico.codigoTributacaoMunicipio) {
      return res.status(400).json({ error: "Código de Tributação Municipal é obrigatório." });
    }
    if (!rps.servico.valorServicos || parseFloat(rps.servico.valorServicos) <= 0) {
      return res.status(400).json({ error: "Valor dos Serviços deve ser maior que zero." });
    }

    const { xml, loteId, rpsId } = generateRpsXml(rps, settings);
    res.json({ xml, loteId, rpsId });
  } catch (err) {
    res.status(500).json({ error: "Erro ao gerar XML: " + err.message });
  }
});

// API: Sign and Send
app.post('/api/rps/:id/send', async (req, res) => {
  try {
    const { id } = req.params;
    const rpsList = db.getRpsList();
    const rpsIndex = rpsList.findIndex(r => r.id === id);
    if (rpsIndex === -1) {
      return res.status(404).json({ error: "RPS não encontrado." });
    }

    const rps = rpsList[rpsIndex];
    const settings = db.getSettings();

    const erros = validarEmissao(rps, settings);
    if (erros.length) return res.status(400).json({ error: erros[0] });

    const { statusText, responseObj } = await assinarEEnviar(rps, settings, db.getCert());

    rpsList[rpsIndex].status = statusText;
    rpsList[rpsIndex].retorno = responseObj;
    db.saveRpsList(rpsList);

    // Quando autoriza, avança a numeração do Lote (e garante o RPS à frente)
    if (statusText === 'Processado') {
      if (rps.numeroLote) db.bumpSequencia('lote', rps.numeroLote);
      if (rps.numeroRps) db.bumpSequencia('rps', rps.numeroRps);
    }

    res.json({ status: statusText, result: responseObj });

  } catch (err) {
    res.status(500).json({ error: "Erro ao assinar/enviar RPS: " + err.message });
  }
});

// API: PDF da NFS-e autorizada (DANFSE)
app.get('/api/rps/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const rps = db.getRpsList().find(r => r.id === id);
    if (!rps) return res.status(404).json({ error: "RPS não encontrado." });

    // Re-parseia sempre a partir do soapResponse (fonte da verdade, robusto a mudanças no parser)
    const nfse = (rps.retorno && rps.retorno.soapResponse)
      ? parseResposta(rps.retorno.soapResponse).nfse
      : (rps.retorno && rps.retorno.nfse);
    if (!nfse || !nfse.numero) {
      return res.status(400).json({ error: "Esta nota ainda não foi autorizada (sem dados de NFS-e para impressão)." });
    }

    const pdf = await generateNfsePdf(nfse, db.getSettings(), rps);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="NFSe-${nfse.numero}.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: "Erro ao gerar PDF: " + err.message });
  }
});

// ===== Integração com ERP / sistemas externos =====

// Middleware de autenticação por API Key (header x-api-key)
function requireApiKey(req, res, next) {
  const key = req.get('x-api-key');
  if (!key || key !== db.getApiKey()) {
    return res.status(401).json({ status: 'Erro', error: "API key inválida ou ausente. Envie o header 'x-api-key'." });
  }
  next();
}

// Emissão completa em 1 chamada: cria -> assina -> envia -> retorna o resultado.
// A nota é salva no mesmo banco (aparece no front e gera PDF).
app.post('/api/nfse/emitir', requireApiKey, async (req, res) => {
  try {
    const body = req.body || {};
    const settings = db.getSettings();
    const seq = db.getSequencias();
    const now = new Date();

    const rps = {
      id: Date.now().toString(),
      numeroRps: String(body.numeroRps || seq.proximoRps),
      numeroLote: String(body.numeroLote || seq.proximoLote),
      serieRps: String(body.serieRps || '1'),
      dataEmissao: body.dataEmissao || now.toISOString(),
      competencia: body.competencia || now.toISOString().slice(0, 10),
      tomador: body.tomador || {},
      servico: body.servico || {},
      status: 'Rascunho',
      dataCriacao: now.toISOString(),
      origem: 'ERP',
      retorno: null
    };

    const erros = validarEmissao(rps, settings);
    if (erros.length) {
      return res.status(422).json({ status: 'Erro', mensagens: erros.map(m => ({ codigo: 'VALIDACAO', mensagem: m })) });
    }

    const { statusText, responseObj } = await assinarEEnviar(rps, settings, db.getCert());

    // Persiste a nota emitida (sempre, inclusive em erro, para histórico/reenvio)
    rps.status = statusText;
    rps.retorno = responseObj;
    const list = db.getRpsList();
    list.push(rps);
    db.saveRpsList(list);

    if (statusText === 'Processado') {
      db.bumpSequencia('rps', rps.numeroRps);
      db.bumpSequencia('lote', rps.numeroLote);

      const out = {
        status: 'Processado',
        rpsId: rps.id,
        nfse: responseObj.nfse,
        pdfUrl: `/api/rps/${rps.id}/pdf`
      };
      if (body.incluirPdf) {
        const nfse = parseResposta(responseObj.soapResponse).nfse;
        out.pdfBase64 = (await generateNfsePdf(nfse, settings, rps)).toString('base64');
      }
      return res.json(out);
    }

    // Rejeitado pela prefeitura ou falha de transmissão
    return res.status(422).json({
      status: 'Erro',
      rpsId: rps.id,
      mensagens: responseObj.mensagens || [{ codigo: 'ERRO', mensagem: responseObj.error || 'Falha no envio.' }]
    });
  } catch (err) {
    res.status(500).json({ status: 'Erro', error: err.message });
  }
});

// Consulta o status/resultado de uma emissão (para o ERP acompanhar)
app.get('/api/nfse/:id', requireApiKey, (req, res) => {
  const rps = db.getRpsList().find(r => r.id === req.params.id);
  if (!rps) return res.status(404).json({ status: 'Erro', error: 'Nota não encontrada.' });
  const nfse = rps.retorno && rps.retorno.soapResponse ? parseResposta(rps.retorno.soapResponse).nfse : (rps.retorno && rps.retorno.nfse);
  res.json({
    status: rps.status,
    rpsId: rps.id,
    numeroRps: rps.numeroRps,
    nfse: nfse || null,
    mensagens: (rps.retorno && rps.retorno.mensagens) || [],
    pdfUrl: nfse && nfse.numero ? `/api/rps/${rps.id}/pdf` : null
  });
});

// Start Server
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`Backend rodando em http://${HOST}:${PORT}`);
  console.log(`API Key (header x-api-key para o ERP): ${db.getApiKey()}`);
  if (HOST === '127.0.0.1') {
    console.log(`(Apenas localhost. Para aceitar o ERP em outra máquina: defina HOST=0.0.0.0)`);
  }
});
