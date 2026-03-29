let prismaInstance: any = null;

export function getPrisma() {
  if (!prismaInstance) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require('@prisma/client');
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

// 호환성을 위한 export
export const prisma = new Proxy({} as any, {
  get(_target, prop) {
    return getPrisma()[prop];
  },
});
