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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Certs Directory Setup
const certsDir = path.join(__dirname, 'certs');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

// Multer Config for Certificate Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, certsDir);
  },
  filename: (req, file, cb) => {
    // Keep it simple, save as cert.p12 or cert.pfx
    const ext = path.extname(file.originalname);
    cb(null, `certificate${ext}`);
  }
});
const upload = multer({ storage });

// API: Settings
app.get('/api/settings', (req, res) => {
  try {
    const settings = db.getSettings();
    const cert = db.getCert();
    res.json({ settings, cert: cert ? { filename: cert.filename, passwordConfigured: !!cert.password } : null });
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

    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);

    // Validate the certificate and password immediately
    const certData = loadCertificate(fileBuffer, password);

    // If valid, save to database config
    db.saveCert({
      filename: req.file.filename,
      password: password // Saved locally
    });

    res.json({
      success: true,
      message: "Certificado digital configurado e validado com sucesso!",
      cert: {
        filename: req.file.filename,
        passwordConfigured: true,
        validUntil: certData.validUntil // metadata can be added
      }
    });
  } catch (err) {
    // Clean up file if validation failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({ error: err.message });
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

    if (!certConfig || !certConfig.filename) {
      return res.status(400).json({ error: "Certificado digital não configurado." });
    }

    const certPath = path.join(certsDir, certConfig.filename);
    if (!fs.existsSync(certPath)) {
      return res.status(400).json({ error: "Arquivo físico do certificado não encontrado." });
    }

    const certBuffer = fs.readFileSync(certPath);
    const { privateKeyPem, certPemClean } = loadCertificate(certBuffer, certConfig.password);

    // 1. Generate XML
    const { xml, loteId, rpsId } = generateRpsXml(rps, settings);

    // 2. Sign XML
    const signedXml = signRpsXml({
      xml,
      rpsId,
      loteId,
      privateKeyPem,
      certPemClean
    });

    // 3. Wrap in SOAP Envelope
    const soapEnvelope = wrapInSoapEnvelope(signedXml, 'EnviarLoteRpsSincrono');

    // 4. Send to WebService (Mutual SSL)
    const isProd = settings.ambiente === '1';
    const soapUrl = isProd 
      ? 'https://fozdoiguacupr.gestaoiss.com.br/ws/nfse.asmx'
      : 'https://homologacao.gestaoiss.com.br/ws/nfse.asmx';

    // Log request
    console.log(`Enviando RPS ${rps.numeroRps} para ${soapUrl}...`);

    let responseData = '';
    let statusText = 'Erro';
    let responseObj = null;

    try {
      // Configuration for HTTPS Agent with client certificate (Mutual SSL)
      const agent = new https.Agent({
        pfx: certBuffer,
        passphrase: certConfig.password,
        rejectUnauthorized: false // Avoid SSL certificate validation issues typical of municipal servers
      });

      const response = await axios.post(soapUrl, soapEnvelope, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://ws.integration.pmfi.pr.gov.br/EnviarLoteRpsSincrono'
        },
        httpsAgent: agent,
        timeout: 25000 // 25 seconds timeout
      });

      responseData = response.data;

      // Parse Response to detect success or failure
      // Check for presence of <Protocolo> (success) or <ListaMensagemRetorno> (error)
      const hasProtocolo = responseData.includes('<Protocolo>') || responseData.includes('<protocolo>');
      const hasNumeroNfse = responseData.includes('<NumeroNfse>') || responseData.includes('<numeroNfse>');
      const hasListaMensagemRetorno = responseData.includes('<ListaMensagemRetorno>') || responseData.includes('<listaMensagemRetorno>');
      const hasErro = responseData.toLowerCase().includes('erro') || responseData.toLowerCase().includes('fault');

      if (hasProtocolo || hasNumeroNfse) {
        // Success: received Protocolo or NFS-e numbers
        statusText = 'Processado';
      } else if (hasListaMensagemRetorno || hasErro) {
        // Error: received messages or explicit error
        statusText = 'Erro';
      } else {
        // Unknown response format
        statusText = 'Erro';
      }

      responseObj = {
        success: statusText === 'Processado',
        soapResponse: responseData,
        soapRequest: soapEnvelope,
        signedXml: signedXml
      };

    } catch (sendErr) {
      console.error("Erro na transmissão SOAP:", sendErr.message);
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

    res.json({
      status: statusText,
      result: responseObj
    });

  } catch (err) {
    res.status(500).json({ error: "Erro ao assinar/enviar RPS: " + err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Backend rodando localmente na porta ${PORT}`);
});
