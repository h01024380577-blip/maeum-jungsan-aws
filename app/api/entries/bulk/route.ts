import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { corsResponse, withCors } from '@/src/lib/cors';
import {
  consumeCredit,
  refundCredit,
  resolveDbUserId,
  isGuardEnabled,
} from '@/src/lib/credits';

export async function OPTIONS(req: NextRequest) {
  return corsResponse(req);
}

interface BulkEntryInput {
  targetName?: string;
  amount?: number | string;
  date?: string;
  eventType?: string;
  location?: string;
  relation?: string;
  type?: 'INCOME' | 'EXPENSE';
  memo?: string;
  account?: string;
}

function normalizeEventType(raw: unknown): 'WEDDING' | 'FUNERAL' | 'BIRTHDAY' | 'OTHER' {
  const upper = String(raw ?? '').toUpperCase();
  if (upper === 'WEDDING' || upper === 'FUNERAL' || upper === 'BIRTHDAY' || upper === 'OTHER') {
    return upper;
  }
  const lower = String(raw ?? '').toLowerCase();
  if (lower.includes('결혼') || lower === 'wedding') return 'WEDDING';
  if (lower.includes('장례') || lower.includes('조의') || lower === 'funeral') return 'FUNERAL';
  if (lower.includes('생일') || lower.includes('돌') || lower === 'birthday') return 'BIRTHDAY';
  return 'OTHER';
}

export async function POST(req: NextRequest) {
  const userId = await resolveDbUserId(req);
  if (!userId) {
    return withCors(req, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  const body = await req.json().catch(() => ({}));
  const rawEntries = Array.isArray(body?.entries) ? body.entries : null;
  if (!rawEntries || rawEntries.length === 0) {
    return withCors(req, NextResponse.json({ error: 'empty_entries' }, { status: 400 }));
  }

  // 입력 정규화
  const entries: Array<{
    targetName: string;
    amount: number;
    date: Date;
    eventType: 'WEDDING' | 'FUNERAL' | 'BIRTHDAY' | 'OTHER';
    location: string;
    relation: string;
    type: 'INCOME' | 'EXPENSE';
    memo: string;
    account: string;
  }> = [];

  for (const raw of rawEntries as BulkEntryInput[]) {
    const targetName = String(raw.targetName ?? '').trim();
    const amount = Number(raw.amount) || 0;
    if (!targetName || amount <= 0) continue;
    const dateStr = String(raw.date ?? '').trim();
    const parsedDate = dateStr ? new Date(dateStr) : new Date();
    const date = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    entries.push({
      targetName,
      amount,
      date,
      eventType: normalizeEventType(raw.eventType),
      location: String(raw.location ?? '').trim() || '기타',
      relation: String(raw.relation ?? '').trim() || '지인',
      type: raw.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
      memo: String(raw.memo ?? '대량 불러오기'),
      account: String(raw.account ?? ''),
    });
  }

  if (entries.length === 0) {
    return withCors(req, NextResponse.json({ error: 'no_valid_entries' }, { status: 400 }));
  }

  // CSV 크레딧 가드 (env로 on/off)
  const guardOn = isGuardEnabled('CSV_CREDIT');
  if (guardOn) {
    const consumed = await consumeCredit(userId, 'CSV_CREDIT');
    if (!consumed) {
      return withCors(req, NextResponse.json(
        { success: false, reason: 'no_credits', rewardType: 'CSV_CREDIT' },
        { status: 402 },
      ));
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Contact name 목록에 대해 한 번에 조회
      const uniqueNames = Array.from(new Set(entries.map((e) => e.targetName)));
      const existingContacts = await tx.contact.findMany({
        where: { userId, name: { in: uniqueNames } },
        select: { id: true, name: true },
      });
      const contactByName = new Map<string, string>(
        existingContacts.map((c) => [c.name, c.id]),
      );

      // 누락된 contact 생성
      for (const name of uniqueNames) {
        if (!contactByName.has(name)) {
          const relation =
            entries.find((e) => e.targetName === name)?.relation || '지인';
          const created = await tx.contact.create({
            data: { userId, name, relation },
            select: { id: true },
          });
          contactByName.set(name, created.id);
        }
      }

      let inserted = 0;
      for (const entry of entries) {
        const contactId = contactByName.get(entry.targetName)!;
        const event = await tx.event.create({
          data: {
            userId,
            contactId,
            eventType: entry.eventType,
            targetName: entry.targetName,
            date: entry.date,
            location: entry.location,
            relation: entry.relation,
            memo: entry.memo,
            account: entry.account,
          },
          select: { id: true },
        });
        await tx.transaction.create({
          data: {
            eventId: event.id,
            userId,
            type: entry.type,
            amount: entry.amount,
            account: entry.account,
            relation: entry.relation,
            source: 'CSV',
          },
        });
        inserted += 1;
      }
      return { inserted };
    });

    return withCors(
      req,
      NextResponse.json({ success: true, inserted: result.inserted, attempted: entries.length }),
    );
  } catch (err) {
    // 0건 저장 실패 → CSV 크레딧 환불
    if (guardOn) await refundCredit(userId, 'CSV_CREDIT');
    const message = err instanceof Error ? err.message : String(err);
    console.error('[bulk] insert failed:', message);
    return withCors(
      req,
      NextResponse.json(
        { success: false, reason: 'insert_failed', message },
        { status: 500 },
      ),
    );
  }
}
