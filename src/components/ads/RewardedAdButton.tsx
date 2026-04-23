'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PlayCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '@/src/lib/apiClient';
import { getAdGroupId, isRewardedAdSupported, showRewardedAd } from '@/src/lib/ads';
import { useStore } from '@/src/store/useStore';
import type { RewardType } from '@prisma/client';

interface Props {
  rewardType: RewardType;
  className?: string;
  /** 성공 콜백 (크레딧 충전 완료 후) */
  onCharged?: (newBalance: number) => void;
}

const LABELS: Record<RewardType, { idle: string; success: string }> = {
  AI_CREDIT: {
    idle: '광고 보고 AI 분석 +1회',
    success: 'AI 분석 1회 충전 완료',
  },
  CSV_CREDIT: {
    idle: '광고 보고 CSV 가져오기 +1회',
    success: 'CSV 가져오기 1회 충전 완료',
  },
};

export default function RewardedAdButton({ rewardType, className, onCharged }: Props) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const credits = useStore((s) => s.credits);
  const refreshCredits = useStore((s) => s.refreshCredits);

  useEffect(() => {
    isRewardedAdSupported().then(setSupported);
  }, []);

  if (supported === false) return null;

  const slot = rewardType === 'AI_CREDIT' ? credits.ai : credits.csv;
  const disabled = busy || supported === null || !slot.canWatchAd;

  const handleClick = async () => {
    if (disabled) return;
    setBusy(true);
    try {
      // 1) 서버에서 nonce 발급
      const nonceRes = await apiFetch('/api/credits/ad-nonce', {
        method: 'POST',
        body: JSON.stringify({
          rewardType,
          adGroupId: getAdGroupId(rewardType),
        }),
      });
      if (!nonceRes.ok) {
        const err = await nonceRes.json().catch(() => ({}));
        if (err.error === 'daily_ad_limit') {
          toast.message('오늘 광고 시청을 모두 사용했어요. 내일 다시 받을 수 있어요.');
        } else if (err.error === 'cap_reached_ai' || err.error === 'cap_reached_csv') {
          toast.message(`최대 ${slot.cap}회까지 보관할 수 있어요. 사용 후 다시 충전해 주세요.`);
        } else {
          toast.error('광고 준비에 실패했어요. 잠시 후 다시 시도해 주세요.');
        }
        await refreshCredits();
        return;
      }
      const { nonce } = await nonceRes.json();

      // 2) 광고 load+show
      const outcome = await showRewardedAd(getAdGroupId(rewardType));
      if (!outcome.earnedReward) {
        toast.message('광고를 끝까지 시청해야 보상을 받을 수 있어요.');
        return;
      }

      // 3) 서버 redeem
      const redeemRes = await apiFetch('/api/credits/ad-redeem', {
        method: 'POST',
        body: JSON.stringify({
          nonce,
          reward: { unitType: outcome.unitType, unitAmount: outcome.unitAmount },
        }),
      });
      if (!redeemRes.ok) {
        toast.error('보상 지급에 실패했어요. 잠시 후 다시 시도해 주세요.');
        await refreshCredits();
        return;
      }
      const result = await redeemRes.json();
      await refreshCredits();
      toast.success(`${LABELS[rewardType].success} ✨`);
      onCharged?.(result.balance);
    } catch {
      toast.error('광고 로드에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={
        className ??
        `inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all ${
          disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md shadow-blue-100 active:scale-95'
        }`
      }
    >
      {busy ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          <span>광고 준비 중…</span>
        </>
      ) : (
        <>
          <PlayCircle size={14} />
          <span>{LABELS[rewardType].idle}</span>
        </>
      )}
    </button>
  );
}
