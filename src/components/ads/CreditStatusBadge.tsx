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
    label: 'AI분석 남은 횟수',
    colorHigh: 'bg-blue-100 text-blue-700 border border-blue-200 shadow-sm shadow-blue-100',
    colorLow: 'bg-amber-100 text-amber-800 border border-amber-300 shadow-sm shadow-amber-100',
    colorZero: 'bg-gray-100 text-gray-500 border border-gray-200',
  },
  csv: {
    Icon: Upload,
    label: '남은 횟수',
    colorHigh: 'bg-violet-100 text-violet-700 border border-violet-200 shadow-sm shadow-violet-100',
    colorLow: 'bg-amber-100 text-amber-800 border border-amber-300 shadow-sm shadow-amber-100',
    colorZero: 'bg-gray-100 text-gray-500 border border-gray-200',
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
        `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${tone}`
      }
    >
      <Icon size={13} />
      <span>
        {label} {slot.balance}회
      </span>
    </span>
  );
}
