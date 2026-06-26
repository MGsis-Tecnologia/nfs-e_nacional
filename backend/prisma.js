import { PrismaClient } from '@prisma/client';

// Cliente Prisma com inicialização tardia: começa nulo (modo setup) e é criado
// quando há DATABASE_URL (no boot, se já configurado; ou após o wizard de setup).
let prisma = null;

export function isDbReady() {
  return !!prisma;
}

export function getPrisma() {
  if (!prisma) throw new Error('Banco de dados não configurado. Conclua o setup.');
  return prisma;
}

// Testa uma URL de conexão sem afetar o client ativo.
export async function testConnection(url) {
  const client = new PrismaClient({ datasources: { db: { url } } });
  try {
    await client.$queryRaw`SELECT 1`;
    return true;
  } finally {
    await client.$disconnect().catch(() => {});
  }
}

// (Re)inicializa o client com a URL informada e valida a conexão.
export async function initPrisma(url) {
  if (url) process.env.DATABASE_URL = url;
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL ausente.');
  if (prisma) {
    await prisma.$disconnect().catch(() => {});
    prisma = null;
  }
  const client = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
  await client.$queryRaw`SELECT 1`;
  prisma = client;
  return prisma;
}
