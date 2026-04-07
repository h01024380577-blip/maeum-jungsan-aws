import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

function getUserId(req: NextRequest): string | null {
  return req.cookies.get('toss_user_id')?.value ?? null;
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ enabled: false });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationsEnabled: true },
  });

  return NextResponse.json({ enabled: user?.notificationsEnabled ?? false });
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { enabled } = await req.json();

  await prisma.user.update({
    where: { id: userId },
    data: { notificationsEnabled: !!enabled },
  });

  return NextResponse.json({ ok: true, enabled: !!enabled });
}
