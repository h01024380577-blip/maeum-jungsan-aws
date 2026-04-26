// src/components/mypage/CreditOverview.tsx
'use client';

import { Sparkles, Upload } from 'lucide-react';
import { useStore } from '@/src/store/useStore';
import RewardedAdButton from '@/src/components/ads/RewardedAdButton';

interface SlotProps {
  variant: 'ai' | 'csv';
}

function CreditSlot({ variant }: SlotProps) {
  const slot = useStore((s) => (variant === 'ai' ? s.credits.ai : s.credits.csv));
  const loaded = useStore((s) => s.credits.loaded);
  const Icon = variant === 'ai' ? Sparkles : Upload;
  const label = variant === 'ai' ? 'AI 분석' : '대량 가져오기';
  const rewardType = variant === 'ai' ? 'AI_CREDIT' : 'CSV_CREDIT';
  const tone =
    variant === 'ai'
      ? 'bg-blue-50 text-blue-700'
      : 'bg-violet-50 text-violet-700';

  if (!loaded) {
    return (
      <div className="flex-1 bg-gray-50 rounded-2xl p-4 h-28 animate-pulse" />
    );
  }

  return (
    <div className={`flex-1 rounded-2xl p-4 flex flex-col gap-2 ${tone}`}>
      <div className="flex items-center gap-1.5">
        <Icon size={14} />
        <span className="text-[11px] font-bold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-2xl font-black leading-none">
        {slot.balance}
        <span className="text-xs font-bold ml-0.5">회</span>
      </p>
      <p className="text-[10px] text-gray-500">
        최대 {slot.cap}회 보관
      </p>
      <RewardedAdButton
        rewardType={rewardType}
        label="광고 보고 +1회"
        className="mt-auto inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-none disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
      />
    </div>
  );
}

export default function CreditOverview() {
  return (
    <div className="flex gap-2">
      <CreditSlot variant="ai" />
      <CreditSlot variant="csv" />
    </div>
  );
}
