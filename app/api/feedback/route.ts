import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { corsResponse, withCors } from '@/src/lib/cors';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function OPTIONS(req: NextRequest) {
  return corsResponse(req);
}

export async function POST(req: NextRequest) {
  try {
    const { message, userId } = await req.json();
    if (!message?.trim()) {
      return withCors(req, NextResponse.json({ error: 'Empty message' }, { status: 400 }));
    }

    const timestamp = new Date().toISOString();
    console.log('[FEEDBACK]', JSON.stringify({ message, userId, timestamp }));

    await resend.emails.send({
      from: '마음정산 피드백 <onboarding@resend.dev>',
      to: 'h01024380577@gmail.com',
      subject: `[마음정산 피드백] ${message.slice(0, 50)}`,
      html: `
        <h2>마음정산 사용자 피드백</h2>
        <p><strong>사용자 ID:</strong> ${userId || '알 수 없음'}</p>
        <p><strong>시간:</strong> ${timestamp}</p>
        <hr />
        <p>${message.replace(/\n/g, '<br />')}</p>
      `,
    });

    return withCors(req, NextResponse.json({ ok: true }));
  } catch (e: any) {
    console.error('[FEEDBACK] 이메일 전송 실패:', e?.message);
    return withCors(req, NextResponse.json({ error: 'Failed' }, { status: 500 }));
  }
}
