import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { corsResponse, withCors } from '@/src/lib/cors';

export async function OPTIONS(req: NextRequest) {
  return corsResponse(req);
}

export async function POST(req: NextRequest) {
  try {
    const { message, userId } = await req.json();
    if (!message?.trim()) {
      return withCors(req, NextResponse.json({ error: 'Empty message' }, { status: 400 }));
    }

    // Prisma에 Feedback 모델이 없으므로 로그로 기록 + JSON 응답
    // 추후 DB 테이블 추가 시 prisma.feedback.create() 으로 전환
    console.log('[FEEDBACK]', JSON.stringify({ message, userId, timestamp: new Date().toISOString() }));

    return withCors(req, NextResponse.json({ ok: true }));
  } catch {
    return withCors(req, NextResponse.json({ error: 'Failed' }, { status: 500 }));
  }
}
