let _prisma: any = null;

export function getPrismaClient() {
  if (!_prisma) {
    const { PrismaClient } = require('@prisma/client');
    _prisma = new PrismaClient();
  }
  return _prisma;
}

// Proxy로 lazy 접근 — 빌드 시 DB 연결 방지
export const prisma: any = new Proxy({}, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
