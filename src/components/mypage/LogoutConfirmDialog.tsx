// src/components/mypage/LogoutConfirmDialog.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  open: boolean;
  isLoggedIn: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function LogoutConfirmDialog({
  open,
  isLoggedIn,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 z-[600] flex items-center justify-center px-8"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="bg-white rounded-2xl p-6 w-full max-w-[300px] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[15px] font-bold text-gray-900 text-center mb-5">
              {isLoggedIn
                ? '로그아웃하시겠습니까?'
                : '데이터를 초기화하시겠습니까?'}
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={onCancel}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-500 bg-gray-100 active:scale-[0.97] transition-all"
              >
                취소
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-blue-500 shadow-sm shadow-blue-200 active:scale-[0.97] transition-all"
              >
                확인
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
