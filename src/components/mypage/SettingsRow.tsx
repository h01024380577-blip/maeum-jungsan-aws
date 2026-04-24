// src/components/mypage/SettingsRow.tsx
'use client';

import { ChevronRight, type LucideIcon } from 'lucide-react';
import React from 'react';

interface Props {
  Icon: LucideIcon;
  label: string;
  /** 우측 텍스트·pill·값 (string | React 노드) */
  trailing?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** 로그아웃 같은 위험 액션 — 텍스트 빨강 */
  danger?: boolean;
  /** ChevronRight 숨김 (비활성/정적 행) */
  hideChevron?: boolean;
}

export default function SettingsRow({
  Icon,
  label,
  trailing,
  onClick,
  disabled,
  danger,
  hideChevron,
}: Props) {
  const clickable = !!onClick && !disabled;
  const base =
    'flex items-center justify-between px-4 py-3.5 text-left transition-colors';
  const interactive = clickable
    ? 'active:bg-gray-50 hover:bg-gray-50'
    : '';
  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={`${base} ${interactive} w-full disabled:cursor-default`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center shrink-0">
          <Icon
            size={16}
            className={
              disabled
                ? 'text-gray-300'
                : danger
                ? 'text-red-400'
                : 'text-gray-500'
            }
          />
        </div>
        <span
          className={`text-sm font-bold ${
            disabled
              ? 'text-gray-400'
              : danger
              ? 'text-red-500'
              : 'text-gray-800'
          } truncate`}
        >
          {label}
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 text-gray-400">
        {trailing && (
          <span className="text-xs font-medium">{trailing}</span>
        )}
        {clickable && !hideChevron && <ChevronRight size={16} />}
      </div>
    </button>
  );
}
