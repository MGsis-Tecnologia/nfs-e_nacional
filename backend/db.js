import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'database.json');

const defaultData = {
  settings: {
    cnpj: "",
    inscricaoMunicipal: "",
    razaoSocial: "",
    nomeFantasia: "",
    cnae: "",
    simplesNacional: false,
    incentivoFiscal: false,
    regimeEspecialTributacao: "0",
    optanteSimplesNacional: "2",
    endereco: {
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      codigoMunicipio: "4108304", // Foz do Iguaçu default
      uf: "PR",
      cep: ""
    },
    contato: {
      telefone: "",
      email: ""
    },
    ambiente: "2" // 1 = Produção, 2 = Homologação
  },
  cert: null,
  // Controle de numeração sequencial (para não repetir RPS/Lote)
  sequencias: {
    proximoRps: 1,
    proximoLote: 1
  },
  rps: []
};

function readDb() {
  try {
    if (!fs.existsSync(dbPath)) {
      writeDb(defaultData);
      return defaultData;
    }
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Erro ao ler banco de dados local:', err);
    return defaultData;
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Erro ao escrever no banco de dados local:', err);
  }
}

export const db = {
  getSettings() {
    const data = readDb();
    return data.settings || defaultData.settings;
  },
  saveSettings(settings) {
    const data = readDb();
    data.settings = { ...data.settings, ...settings };
    writeDb(data);
    return data.settings;
  },
  getCert() {
    const data = readDb();
    return data.cert;
  },
  saveCert(cert) {
    const data = readDb();
    data.cert = cert;
    writeDb(data);
    return data.cert;
  },
  getSequencias() {
    const data = readDb();
    return data.sequencias || { ...defaultData.sequencias };
  },
  // Garante que o próximo número fique sempre à frente do que já foi usado (evita duplicidade)
  bumpSequencia(tipo, usado) {
    const data = readDb();
    if (!data.sequencias) data.sequencias = { ...defaultData.sequencias };
    const key = tipo === 'lote' ? 'proximoLote' : 'proximoRps';
    const usadoNum = parseInt(usado, 10);
    const atual = parseInt(data.sequencias[key], 10) || 1;
    if (Number.isFinite(usadoNum)) {
      data.sequencias[key] = Math.max(atual, usadoNum + 1);
      writeDb(data);
    }
    return data.sequencias;
  },
  getRpsList() {
    const data = readDb();
    return data.rps || [];
  },
  saveRpsList(rpsList) {
    const data = readDb();
    data.rps = rpsList;
    writeDb(data);
    return data.rps;
  }
};
