import crypto from 'crypto';
import { getPrisma } from './prisma.js';

export const novoToken = () => crypto.randomBytes(24).toString('hex');

// ---------- Emissor ----------
export const listEmissores = () =>
  getPrisma().emissor.findMany({ orderBy: { razaoSocial: 'asc' } });

export const getEmissor = (id) =>
  getPrisma().emissor.findUnique({ where: { id } });

export const getEmissorByToken = (apiToken) =>
  getPrisma().emissor.findUnique({ where: { apiToken } });

export const getEmissorByCnpj = (cnpj) =>
  getPrisma().emissor.findUnique({ where: { cnpj } });

export function createEmissor(data) {
  return getPrisma().emissor.create({
    data: { apiToken: novoToken(), ...data }
  });
}

export const updateEmissor = (id, data) =>
  getPrisma().emissor.update({ where: { id }, data });

export const deleteEmissor = (id) =>
  getPrisma().emissor.delete({ where: { id } });

export async function regenerateToken(id) {
  const apiToken = novoToken();
  await getPrisma().emissor.update({ where: { id }, data: { apiToken } });
  return apiToken;
}

export async function getSequencias(id) {
  const e = await getPrisma().emissor.findUnique({
    where: { id }, select: { proximoRps: true, proximoLote: true }
  });
  return e || { proximoRps: 1, proximoLote: 1 };
}

// Mantém o próximo número sempre à frente do usado: max(atual, usado+1)
export async function bumpSequencia(id, tipo, usado) {
  const col = tipo === 'lote' ? 'proximoLote' : 'proximoRps';
  const n = parseInt(usado, 10);
  if (!Number.isFinite(n)) return;
  await getPrisma().$executeRawUnsafe(
    `UPDATE "Emissor" SET "${col}" = GREATEST("${col}", $1) WHERE id = $2`,
    n + 1, id
  );
}

// ---------- Nota ----------
export function listNotas({ emissorId, status } = {}) {
  const where = {};
  if (emissorId) where.emissorId = emissorId;
  if (status) where.status = status;
  return getPrisma().nota.findMany({ where, orderBy: { createdAt: 'desc' } });
}

export const getNota = (id) =>
  getPrisma().nota.findUnique({ where: { id } });

export const createNota = (data) =>
  getPrisma().nota.create({ data });

export const updateNota = (id, data) =>
  getPrisma().nota.update({ where: { id }, data });

export const deleteNota = (id) =>
  getPrisma().nota.delete({ where: { id } });

// ---------- AdminUser ----------
export const adminCount = () => getPrisma().adminUser.count();

export const getAdminByUsername = (username) =>
  getPrisma().adminUser.findUnique({ where: { username } });

export const createAdmin = (username, passwordHash) =>
  getPrisma().adminUser.create({ data: { username, passwordHash } });
