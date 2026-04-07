import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { tossMessengerFetch } from '@/src/lib/tossMessengerFetch';

export async function POST(req: NextRequest) {
  const userId = req.cookies.get('toss_user_id')?.value;
  const userKey = req.cookies.get('toss_user_key')?.value;

  if (!userId || !userKey) {
    return NextResponse.json({ ok: false, reason: 'not_logged_in' });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationsEnabled: true },
  });

  if (!user?.notificationsEnabled) {
    return NextResponse.json({ ok: false, reason: 'not_enabled' });
  }

  const templateCode = process.env.TOSS_MSG_TEMPLATE_CODE;
  if (!templateCode) {
    return NextResponse.json({ ok: false, reason: 'no_template_configured' });
  }

  const body = await req.json().catch(() => ({}));
  const context = body.context ?? {};

  try {
    const result = await tossMessengerFetch(
      '/api-partner/v1/apps-in-toss/messenger/send-message',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-toss-user-key': userKey,
        },
        body: JSON.stringify({ templateSetCode: templateCode, context }),
      }
    );
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ ok: false, reason: 'send_failed' }, { status: 500 });
  }
}
