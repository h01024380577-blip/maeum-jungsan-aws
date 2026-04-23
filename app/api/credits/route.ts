import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { corsResponse, withCors } from '@/src/lib/cors';
import {
  CREDITS_CONFIG,
  resetAdWatchesIfNeeded,
  resolveDbUserId,
} from '@/src/lib/credits';

export async function OPTIONS(req: NextRequest) {
  return corsResponse(req);
}

export async function GET(req: NextRequest) {
  const userId = await resolveDbUserId(req);
  if (!userId) {
    return withCors(req, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  const { adWatchesToday, adWatchesResetAt } = await resetAdWatchesIfNeeded(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiCredits: true, csvImportCredits: true },
  });
  if (!user) {
    return withCors(req, NextResponse.json({ error: 'User not found' }, { status: 404 }));
  }

  const watchesRemaining = Math.max(
    0,
    CREDITS_CONFIG.ad.dailyLimit - adWatchesToday,
  );
  // 다음 KST 자정 (리셋 시점)
  const nextResetAt = new Date(adWatchesResetAt.getTime() + 24 * 60 * 60 * 1000);

  return withCors(
    req,
    NextResponse.json({
      ai: {
        balance: user.aiCredits,
        cap: CREDITS_CONFIG.ai.cap,
        canWatchAd: user.aiCredits < CREDITS_CONFIG.ai.cap && watchesRemaining > 0,
      },
      csv: {
        balance: user.csvImportCredits,
        cap: CREDITS_CONFIG.csv.cap,
        canWatchAd:
          user.csvImportCredits < CREDITS_CONFIG.csv.cap && watchesRemaining > 0,
      },
      ad: {
        watchesRemaining,
        dailyLimit: CREDITS_CONFIG.ad.dailyLimit,
        resetAt: nextResetAt.toISOString(),
      },
    }),
  );
}
