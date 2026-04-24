#!/usr/bin/env node
/**
 * 일회성 디버깅 스크립트 — 로그인 사용자(JWT) 경로에서 /api/analyze 차감 동작 검증.
 */
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import 'dotenv/config';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!BASE_URL) {
  console.error('NEXT_PUBLIC_API_URL 필요');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

function base64url(data) {
  return Buffer.from(data).toString('base64url');
}

function signJwt(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14,
  }));
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET || 'heartbook-dev-jwt-secret')
    .update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

const user = await prisma.user.findFirst({
  where: { tossUserKey: { not: null } },
  select: { id: true, tossUserKey: true, aiCredits: true, csvImportCredits: true, name: true },
});
if (!user) {
  console.error('토스 로그인 User 없음 — 게스트 경로만 가능');
  process.exit(1);
}
console.log('[사용자]', user);

const token = signJwt({ userId: user.id, userKey: user.tossUserKey });
console.log('[JWT] 서명 완료');

console.log('\n=== 1. Bearer /api/credits ===');
const r1 = await fetch(`${BASE_URL}/api/credits`, { headers: { Authorization: `Bearer ${token}` } });
console.log(`  HTTP ${r1.status}  body:`, await r1.json());

console.log('\n=== 2. Bearer /api/analyze type=text ===');
const r2 = await fetch(`${BASE_URL}/api/analyze`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'text', data: '김진호 결혼합니다 2026-05-17 오후 1시 더채플 강남' }),
});
const b2 = await r2.json();
console.log(`  HTTP ${r2.status}`);
console.log(`  body: ${JSON.stringify(b2).slice(0, 200)}`);

console.log('\n=== 3. 차감 후 Bearer /api/credits ===');
const r3 = await fetch(`${BASE_URL}/api/credits`, { headers: { Authorization: `Bearer ${token}` } });
const b3 = await r3.json();
console.log(`  HTTP ${r3.status}  body:`, b3);

// 3. DB 직접 확인
const fresh = await prisma.user.findUnique({
  where: { id: user.id },
  select: { aiCredits: true },
});
console.log('\n=== 4. DB 직접 조회 ===');
console.log(`  User.aiCredits = ${fresh?.aiCredits}`);

console.log(`\n결론: API 응답의 balance와 DB 값이 일치: ${b3.ai?.balance === fresh?.aiCredits}`);
console.log(`차감 발생 여부: 초기=${user.aiCredits} → 현재=${fresh?.aiCredits}`);

await prisma.$disconnect();
