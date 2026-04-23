/**
 * 앱인토스 리워드 광고 래퍼
 * - 토스앱 5.247.0 이상에서 지원 (인앱 광고 2.0 ver2)
 * - load → show 순서 강제, Promise 인터페이스로 캡슐화
 */

import type { RewardType } from '@prisma/client';

/** 환경변수에서 광고 그룹 ID 로드. 테스트 ID fallback. */
const AD_GROUP_IDS = {
  AI_CREDIT:
    process.env.NEXT_PUBLIC_AD_GROUP_ID_AI_CREDIT || 'ait-ad-test-rewarded-id',
  CSV_CREDIT:
    process.env.NEXT_PUBLIC_AD_GROUP_ID_CSV_CREDIT || 'ait-ad-test-rewarded-id',
} as const;

export function getAdGroupId(rewardType: RewardType): string {
  return AD_GROUP_IDS[rewardType];
}

/** 현재 환경에서 리워드 광고 사용 가능 여부. SSR/미지원 버전이면 false. */
export async function isRewardedAdSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const { loadFullScreenAd, showFullScreenAd } = await import(
      '@apps-in-toss/web-framework'
    );
    return (
      typeof loadFullScreenAd?.isSupported === 'function' &&
      loadFullScreenAd.isSupported() &&
      typeof showFullScreenAd?.isSupported === 'function' &&
      showFullScreenAd.isSupported()
    );
  } catch {
    return false;
  }
}

export interface ShowRewardedAdOutcome {
  earnedReward: boolean;
  unitType?: string;
  unitAmount?: number;
}

/**
 * 리워드 광고 1회 사이클: load → show → 리워드 획득 여부 반환.
 * - earnedReward=true 시에만 서버 redeem 호출.
 * - dismissed/failedToShow는 earnedReward=false로 resolve.
 * - 네트워크/지원안함 등 초기 실패는 reject.
 */
export async function showRewardedAd(
  adGroupId: string,
): Promise<ShowRewardedAdOutcome> {
  const { loadFullScreenAd, showFullScreenAd } = await import(
    '@apps-in-toss/web-framework'
  );

  // 1) load
  await new Promise<void>((resolve, reject) => {
    const unregister = loadFullScreenAd({
      options: { adGroupId },
      onEvent: (event) => {
        if (event.type === 'loaded') {
          resolve();
          try {
            unregister();
          } catch {}
        }
      },
      onError: (err) => {
        reject(err instanceof Error ? err : new Error(String(err)));
        try {
          unregister();
        } catch {}
      },
    });
  });

  // 2) show
  return await new Promise<ShowRewardedAdOutcome>((resolve, reject) => {
    let earnedReward = false;
    let rewardData: { unitType?: string; unitAmount?: number } = {};
    const unregister = showFullScreenAd({
      options: { adGroupId },
      onEvent: (event) => {
        switch (event.type) {
          case 'userEarnedReward':
            earnedReward = true;
            rewardData = {
              unitType: event.data?.unitType,
              unitAmount: event.data?.unitAmount,
            };
            break;
          case 'dismissed':
            resolve({ earnedReward, ...rewardData });
            try {
              unregister();
            } catch {}
            break;
          case 'failedToShow':
            resolve({ earnedReward: false });
            try {
              unregister();
            } catch {}
            break;
        }
      },
      onError: (err) => {
        reject(err instanceof Error ? err : new Error(String(err)));
        try {
          unregister();
        } catch {}
      },
    });
  });
}
