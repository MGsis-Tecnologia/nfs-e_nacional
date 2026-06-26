import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '.env');

// Lê o .env como objeto (chave -> valor). Ignora comentários.
export function readEnv() {
  const out = {};
  if (!fs.existsSync(ENV_PATH)) return out;
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

// Grava o .env preservando chaves existentes.
export function writeEnv(updates) {
  const merged = { ...readEnv(), ...updates };
  const body = Object.entries(merged)
    .map(([k, v]) => `${k}="${v}"`)
    .join('\n') + '\n';
  fs.writeFileSync(ENV_PATH, body, 'utf8');
  return merged;
}

export function buildDatabaseUrl({ host, port, user, password, database, schema }) {
  const enc = encodeURIComponent;
  const h = host || 'localhost';
  const p = port || '5432';
  const s = schema || 'public';
  return `postgresql://${enc(user)}:${enc(password)}@${h}:${p}/${enc(database)}?schema=${enc(s)}`;
}

// Garante um JWT_SECRET no .env (gera se não existir) e retorna o valor.
export function ensureJwtSecret() {
  const env = readEnv();
  if (env.JWT_SECRET && env.JWT_SECRET !== 'troque-por-um-valor-aleatorio-longo') {
    process.env.JWT_SECRET = env.JWT_SECRET;
    return env.JWT_SECRET;
  }
  const secret = crypto.randomBytes(48).toString('hex');
  writeEnv({ JWT_SECRET: secret });
  process.env.JWT_SECRET = secret;
  return secret;
}

// Cria/atualiza as tabelas no banco via `prisma db push`.
export function runDbPush(databaseUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['prisma', 'db', 'push', '--skip-generate'], {
      cwd: __dirname,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      shell: true
    });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    child.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error('Falha ao criar tabelas (prisma db push):\n' + out));
    });
    child.on('error', reject);
  });
}
