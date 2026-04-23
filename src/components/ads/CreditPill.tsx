'use client';

/**
 * 잔고에 따라 "배지 ↔ 광고 버튼"을 자동으로 전환하는 pill 컴포넌트.
 * - 잔고 ≥ 1: CreditStatusBadge (남은 횟수 표시)
 * - 잔고 === 0: RewardedAdButton (바로 광고 시청 CTA로 변신)
 *
 * 헤더처럼 공간이 좁아 두 상태가 번갈아 들어가야 하는 곳에 사용.
 */

import { useStore } from '@/src/store/useStore';
import CreditStatusBadge from './CreditStatusBadge';
import RewardedAdButton from './RewardedAdButton';

interface Props {
  variant: 'ai' | 'csv';
}

export default function CreditPill({ variant }: Props) {
  const balance = useStore((s) =>
    variant === 'ai' ? s.credits.ai.balance : s.credits.csv.balance,
  );
  const loaded = useStore((s) => s.credits.loaded);

  if (!loaded) return null;

  if (balance === 0) {
    const rewardType = variant === 'ai' ? 'AI_CREDIT' : 'CSV_CREDIT';
    const label = variant === 'ai' ? '광고 보고 +1회' : '광고 보고 +1회';
    return (
      <RewardedAdButton
        rewardType={rewardType}
        label={label}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-sm shadow-blue-200 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      />
    );
  }

  return <CreditStatusBadge variant={variant} />;
}
