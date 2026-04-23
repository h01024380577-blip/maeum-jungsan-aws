#!/usr/bin/env node
/**
 * 일회성 마이그레이션 적용 스크립트
 * prisma/manual-migrations/2026-04-23_add_credits_system.sql을 DIRECT_URL(세션 풀러)에 적용.
 *
 * 사용법:
 *   node scripts/apply-credits-migration.mjs
 *
 * 설계 이유:
 *   - psql CLI가 환경에 없어 대체 수단 필요
 *   - PgBouncer(DATABASE_URL, port 6543)은 DDL/prepared statement에 불안정 → DIRECT_URL 사용
 *   - 각 SQL statement를 순차적으로 실행, 실패 시 생성된 enum/테이블을 수동 드롭해야 함
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_PATH = resolve(__dirname, '../prisma/manual-migrations/2026-04-23_add_credits_system.sql');

if (!process.env.DIRECT_URL) {
  console.error('DIRECT_URL 환경변수가 .env에 설정돼 있어야 해요.');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

const raw = readFileSync(SQL_PATH, 'utf8');

// 주석 제거 → statement 단위 split → BEGIN/COMMIT 및 주석 기반 롤백 블록 제외
const stripped = raw
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

const statements = stripped
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !/^(BEGIN|COMMIT)$/i.test(s));

console.log(`[migration] ${statements.length}개 statement 적용 시작`);

let applied = 0;
try {
  // PostgreSQL의 DDL은 트랜잭션 내에서 안전하게 롤백 가능. Prisma $transaction 배열 사용.
  await prisma.$transaction(
    statements.map((s) => prisma.$executeRawUnsafe(s)),
  );
  applied = statements.length;
  console.log(`[migration] ${applied}개 statement 모두 적용 완료`);
} catch (err) {
  console.error('[migration] 실패 — 트랜잭션 롤백됨.');
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
}

// 검증 쿼리
try {
  const userCols = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'User' AND column_name IN
      ('aiCredits','csvImportCredits','adWatchesToday','adWatchesResetAt')
    ORDER BY column_name;
  `);
  console.log('[verify] User 신규 컬럼:', userCols);

  const enums = await prisma.$queryRawUnsafe(`
    SELECT typname FROM pg_type WHERE typname IN ('RewardType','GrantStatus') ORDER BY typname;
  `);
  console.log('[verify] 신규 enum:', enums);

  const tables = await prisma.$queryRawUnsafe(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'AdRewardGrant';
  `);
  console.log('[verify] 신규 테이블:', tables);

  const stats = await prisma.$queryRawUnsafe(`
    SELECT count(*)::int AS total, min("aiCredits")::int AS min_ai, min("csvImportCredits")::int AS min_csv
    FROM "User";
  `);
  console.log('[verify] 기존 사용자 웰컴 크레딧 반영 상태:', stats);
} catch (err) {
  console.warn('[verify] 검증 쿼리 실패 (마이그레이션 자체는 성공):', err);
}

await prisma.$disconnect();
