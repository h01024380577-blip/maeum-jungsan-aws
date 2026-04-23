'use client';

import { Sparkles, Upload } from 'lucide-react';
import { useStore } from '@/src/store/useStore';

interface Props {
  variant: 'ai' | 'csv';
  className?: string;
}

const VARIANTS = {
  ai: {
    Icon: Sparkles,
    label: 'AI 분석',
    colorHigh: 'bg-blue-50 text-blue-700',
    colorLow: 'bg-amber-50 text-amber-700',
    colorZero: 'bg-gray-100 text-gray-500',
  },
  csv: {
    Icon: Upload,
    label: 'CSV 가져오기',
    colorHigh: 'bg-violet-50 text-violet-700',
    colorLow: 'bg-amber-50 text-amber-700',
    colorZero: 'bg-gray-100 text-gray-500',
  },
} as const;

export default function CreditStatusBadge({ variant, className }: Props) {
  const slot = useStore((s) => (variant === 'ai' ? s.credits.ai : s.credits.csv));
  const loaded = useStore((s) => s.credits.loaded);
  const { Icon, label, colorHigh, colorLow, colorZero } = VARIANTS[variant];

  if (!loaded) return null;

  const tone =
    slot.balance === 0 ? colorZero : slot.balance <= 1 ? colorLow : colorHigh;

  return (
    <span
      className={
        className ??
        `inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${tone}`
      }
    >
      <Icon size={12} />
      <span>
        {label} 남은 횟수 {slot.balance}회
      </span>
    </span>
  );
}
