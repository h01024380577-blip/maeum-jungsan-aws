import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

/**
 * AdRewardGrant 만료 크론
 * - status='ISSUED'인 grant 중 expiresAt이 지난 레코드를 EXPIRED로 전환
 * - EC2 crontab에서 매 10분 단위로 호출 (scripts/cron-expire-grants.sh 참고)
 *
 * 인증: Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const result = await prisma.adRewardGrant.updateMany({
    where: { status: 'ISSUED', expiresAt: { lt: now } },
    data: { status: 'EXPIRED' },
  });

  return NextResponse.json({
    ok: true,
    expired: result.count,
    at: now.toISOString(),
  });
}
