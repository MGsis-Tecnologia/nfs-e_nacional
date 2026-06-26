import jwt from 'jsonwebtoken';
import { getEmissorByToken } from './repo.js';

const getSecret = () => process.env.JWT_SECRET || 'dev-secret-inseguro';

export function signAdminToken(admin) {
  return jwt.sign({ sub: admin.id, username: admin.username, role: 'admin' }, getSecret(), { expiresIn: '12h' });
}

// Protege rotas do painel (admin). Espera header Authorization: Bearer <jwt>.
export function requireAdmin(req, res, next) {
  const h = req.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    req.admin = jwt.verify(token, getSecret());
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

// Como requireAdmin, mas também aceita o JWT via ?token= (para abrir PDF em nova aba).
export function requireAdminAllowQuery(req, res, next) {
  const h = req.get('authorization') || '';
  const token = (h.startsWith('Bearer ') ? h.slice(7) : null) || req.query.token;
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    req.admin = jwt.verify(token, getSecret());
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

// Protege rotas do ERP. Resolve o emissor pelo header x-api-key (token do emissor).
export async function requireEmissorToken(req, res, next) {
  const key = req.get('x-api-key');
  if (!key) return res.status(401).json({ status: 'Erro', error: "Header 'x-api-key' ausente." });
  try {
    const emissor = await getEmissorByToken(key);
    if (!emissor || !emissor.ativo) return res.status(401).json({ status: 'Erro', error: 'Token inválido.' });
    req.emissor = emissor;
    next();
  } catch (err) {
    return res.status(500).json({ status: 'Erro', error: err.message });
  }
}
