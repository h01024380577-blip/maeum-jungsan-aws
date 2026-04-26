'use client';

/**
 * 광고 시청 완료 후, 리워드(다음 액션 자동 재개) 진행 직전에 띄우는 확인 팝업.
 * - 서버 redeem이 끝나 잔고가 실제로 충전된 시점에 표시한다.
 * - 사용자가 "확인"을 눌러야 onConfirm이 호출되어 후속 흐름(예: AI 분석 재개)이 시작된다.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import type { RewardType } from '@prisma/client';

interface Props {
  open: boolean;
  rewardType: RewardType;
  onConfirm: () => void;
}

const MESSAGES: Record<RewardType, string> = {
  AI_CREDIT: 'AI 분석 1회가\n충전되었어요!',
  CSV_CREDIT: '대량 가져오기 1회가\n충전되었어요!',
};

export default function CreditGrantedDialog({ open, rewardType, onConfirm }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 z-[700] flex items-center justify-center px-8"
          onClick={onConfirm}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="bg-white rounded-2xl p-6 w-full max-w-[320px] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 size={24} className="text-green-600" />
              </div>
            </div>
            <p className="text-[15px] font-bold text-gray-800 text-center mb-5 whitespace-pre-line leading-relaxed">
              {MESSAGES[rewardType]}
            </p>
            <button
              type="button"
              onClick={onConfirm}
              className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-sm active:scale-[0.97] transition-all"
            >
              확인
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
