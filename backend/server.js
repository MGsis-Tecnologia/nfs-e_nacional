import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import https from 'https';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { generateRpsXml, wrapInSoapEnvelope } from './utils/xmlGenerator.js';
import { loadCertificate, signRpsXml } from './utils/xmlSigner.js';
import { parseResposta } from './utils/responseParser.js';
import { generateNfsePdf } from './utils/pdfGenerator.js';

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
    res.json({ settings, cert: cert && cert.pfxBase64 ? { filename: cert.filename, passwordConfigured: !!cert.password } : null });
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
    const certConfig = db.getCert();

    if (!settings.cnpj || !settings.inscricaoMunicipal) {
      return res.status(400).json({ error: "Configurações do emissor incompletas (CNPJ/Inscrição Municipal)." });
    }

    // Validate required RPS fields before sending
    if (!rps.numeroRps) {
      return res.status(400).json({ error: "Número do RPS é obrigatório." });
    }
    if (!rps.servico.codigoTributacaoMunicipio) {
      return res.status(400).json({ error: "Código de Tributação Municipal é obrigatório." });
    }
    if (!rps.servico.valorServicos || parseFloat(rps.servico.valorServicos) <= 0) {
      return res.status(400).json({ error: "Valor dos Serviços deve ser maior que zero." });
    }
    if (!rps.tomador.cpfCnpj) {
      return res.status(400).json({ error: "CPF/CNPJ do Tomador é obrigatório." });
    }
    if (!rps.tomador.razaoSocial) {
      return res.status(400).json({ error: "Razão Social do Tomador é obrigatória." });
    }
    // Optante do Simples Nacional exige Regime Especial de Tributação "05" (MEI) ou "06" (ME/EPP).
    const regimeAtual = (settings.regimeEspecialTributacao || '').toString().trim();
    if (settings.optanteSimplesNacional === '1' && !['05', '06', '5', '6'].includes(regimeAtual)) {
      return res.status(400).json({ error: "Empresa optante do Simples Nacional: defina o Regime Especial de Tributação como '05' (MEI) ou '06' (ME/EPP) em Configurações." });
    }

    if (!certConfig || !certConfig.pfxBase64) {
      return res.status(400).json({ error: "Certificado digital não configurado." });
    }

    console.log(`[CERTIFICADO] Carregando do banco: ${certConfig.filename}`);
    const certBuffer = Buffer.from(certConfig.pfxBase64, 'base64');
    console.log(`[CERTIFICADO] Certificado lido do banco: ${certBuffer.length} bytes`);

    let privateKeyPem, certPem, certPemClean;
    try {
      const certData = loadCertificate(certBuffer, certConfig.password);
      privateKeyPem = certData.privateKeyPem;
      certPem = certData.certPem;
      certPemClean = certData.certPemClean;
      console.log(`[CERTIFICADO] ✅ Certificado carregado e validado com sucesso`);
    } catch (certErr) {
      console.error(`[CERTIFICADO] ❌ Erro ao carregar certificado:`);
      console.error(`             ${certErr.message}`);
      throw certErr;
    }

    // 1. Generate XML
    const { xml, loteId, rpsId } = generateRpsXml(rps, settings);
    console.log(`\n[XML GERADO - ANTES DA ASSINATURA]:\n${xml}\n`);

    // 2. Sign XML
    const signedXml = signRpsXml({
      xml,
      rpsId,
      loteId,
      privateKeyPem,
      certPem
    });
    console.log(`\n[XML ASSINADO - PRONTO PARA ENVIO]:\n${signedXml}\n`);

    // 3. Wrap in SOAP Envelope
    const soapEnvelope = wrapInSoapEnvelope(signedXml, 'RecepcionarLoteRpsSincronoRequest');

    // 4. Send to WebService (Mutual SSL)
    const isProd = settings.ambiente === '1';
    const soapUrl = isProd 
      ? 'https://fozdoiguacupr.gestaoiss.com.br/ws/nfse.asmx'
      : 'https://homologacao.gestaoiss.com.br/ws/nfse.asmx';

    // Log request
    console.log(`\n========== ENVIANDO RPS ${rps.numeroRps} ==========`);
    console.log(`URL: ${soapUrl}`);
    console.log(`Ambiente: ${isProd ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO'}`);
    console.log(`Certificado: ${certConfig.filename}`);

    let responseData = '';
    let statusText = 'Erro';
    let responseObj = null;

    try {
      // Configuration for HTTPS Agent with client certificate (Mutual SSL)
      console.log(`[1/3] Configurando certificado para HTTPS...`);
      const agent = new https.Agent({
        key: privateKeyPem,  // Chave privada em PEM com BEGIN/END
        cert: certPem,       // Certificado em PEM com BEGIN/END (não usar certPemClean!)
        rejectUnauthorized: false // Avoid SSL certificate validation issues typical of municipal servers
      });
      console.log(`[2/3] Enviando requisição SOAP...`);

      const response = await axios.post(soapUrl, soapEnvelope, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://nfse.abrasf.org.br/RecepcionarLoteRpsSincrono'
        },
        httpsAgent: agent,
        timeout: 25000 // 25 seconds timeout
      });

      responseData = response.data;
      console.log(`[3/3] Resposta recebida da prefeitura!`);
      console.log(`Status HTTP: ${response.status}`);

      // Parse correto: a resposta vem HTML-escapada dentro de <outputXML>.
      const parsed = parseResposta(responseData);
      statusText = parsed.status;

      if (statusText === 'Processado') {
        console.log(`✅ SUCESSO! NFS-e gerada: nº ${parsed.nfse?.numero || '?'} (verificação ${parsed.nfse?.codigoVerificacao || '?'})`);
      } else {
        console.log(`❌ ERRO da prefeitura:`);
        parsed.mensagens.forEach(m => console.log(`   [${m.codigo}] ${m.mensagem}`));
      }

      responseObj = {
        success: statusText === 'Processado',
        mensagens: parsed.mensagens,
        nfse: parsed.nfse,
        soapResponse: responseData,
        soapRequest: soapEnvelope,
        signedXml: signedXml
      };

    } catch (sendErr) {
      console.error(`\n❌ ERRO NA TRANSMISSÃO DO RPS ${rps.numeroRps}:`);
      console.error(`   Tipo: ${sendErr.code || sendErr.name}`);
      console.error(`   Mensagem: ${sendErr.message}`);
      if (sendErr.response) {
        console.error(`   Status HTTP: ${sendErr.response.status}`);
        console.error(`   Resposta: ${sendErr.response.data?.substring(0, 200)}`);
      } else {
        console.error(`   Sem resposta do servidor (verifique conectividade/firewall)`);
      }
      statusText = 'Erro';
      responseObj = {
        success: false,
        error: sendErr.message,
        soapResponse: sendErr.response ? sendErr.response.data : 'Sem resposta do servidor.',
        soapRequest: soapEnvelope,
        signedXml: signedXml
      };
    }

    // Update RPS Status in DB
    rpsList[rpsIndex].status = statusText;
    rpsList[rpsIndex].retorno = responseObj;
    db.saveRpsList(rpsList);

    // Quando autoriza, avança a numeração do Lote (e garante o RPS à frente)
    if (statusText === 'Processado') {
      if (rps.numeroLote) db.bumpSequencia('lote', rps.numeroLote);
      if (rps.numeroRps) db.bumpSequencia('rps', rps.numeroRps);
    }

    res.json({
      status: statusText,
      result: responseObj
    });

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

// Start Server
app.listen(PORT, () => {
  console.log(`Backend rodando localmente na porta ${PORT}`);
});
