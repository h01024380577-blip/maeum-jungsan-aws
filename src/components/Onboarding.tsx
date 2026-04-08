"use client";

import { useState, useCallback } from "react";
import { MessageSquareText, Sparkles, BarChart3, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/src/store/useStore";
import { tossLogin } from "@/src/lib/tossAuth";
import { apiFetch, setAuthToken } from "@/src/lib/apiClient";
import { toast } from "sonner";

const SLIDES = [
  {
    icon: MessageSquareText,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-500",
    headline: "경조사비, 아직도\n메모장에 적고 계세요?",
    description:
      "누가, 언제, 얼마를 줬는지 헷갈리지 않도록\n마음정산이 도와드릴게요",
  },
  {
    icon: Sparkles,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
    headline: "청첩장 링크 하나로\n자동 입력",
    description:
      "AI가 URL·이미지를 분석해서 이름, 날짜,\n장소, 계좌번호까지 자동으로 채워줘요",
  },
  {
    icon: BarChart3,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-500",
    headline: "관계별 통계로\n한눈에 정리",
    description:
      "누구에게 얼마를 주고받았는지\n연락처별로 깔끔하게 관리돼요",
  },
  {
    icon: Heart,
    iconBg: "bg-rose-50",
    iconColor: "text-rose-500",
    headline: "지금 바로\n시작해보세요",
    description: "토스 계정으로 3초 만에 시작할 수 있어요",
  },
] as const;

const TOTAL = SLIDES.length;

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { loadFromSupabase } = useStore();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isLogging, setIsLogging] = useState(false);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= TOTAL) return;
      setDirection(next > current ? 1 : -1);
      setCurrent(next);
    },
    [current],
  );

  const handleNext = useCallback(() => {
    if (current < TOTAL - 1) goTo(current + 1);
  }, [current, goTo]);

  const handleLogin = async () => {
    setIsLogging(true);
    try {
      const result = await tossLogin();
      if (!result) {
        toast.error('토스 로그인이 취소되었습니다.');
        return;
      }
      const res = await apiFetch('/api/auth/toss', {
        method: 'POST',
        body: JSON.stringify(result),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) setAuthToken(data.token);
        localStorage.setItem('heartbook-onboarding-seen', 'true');
        await loadFromSupabase();
        onComplete();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || err.error || `로그인 실패 (${res.status})`);
      }
    } catch (e) {
      console.error('[Onboarding] login error:', e);
      toast.error('로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLogging(false);
    }
  };

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      const threshold = 50;
      if (info.offset.x < -threshold || info.velocity.x < -500) {
        if (current < TOTAL - 1) goTo(current + 1);
      } else if (info.offset.x > threshold || info.velocity.x > 500) {
        if (current > 0) goTo(current - 1);
      }
    },
    [current, goTo],
  );

  const slide = SLIDES[current];
  const Icon = slide.icon;
  const isLast = current === TOTAL - 1;

  const variants = {
    enter: (d: number) => ({ x: d * 80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d * -80, opacity: 0 }),
  };

  return (
    <div className="fixed inset-0 bg-white z-[500] flex items-center justify-center">
      <div className="w-full max-w-[430px] h-screen flex flex-col px-6 py-12">
        {/* Header — 건너뛰기 */}
        <div className="flex justify-end h-10 items-center">
          {!isLast && (
            <button
              onClick={() => goTo(TOTAL - 1)}
              className="text-sm text-gray-400 font-medium active:text-gray-600 transition-colors"
            >
              건너뛰기
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={current}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              className="flex flex-col items-center text-center px-4 select-none"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className={`w-20 h-20 rounded-full flex items-center justify-center mb-8 ${slide.iconBg}`}
              >
                <Icon size={36} className={slide.iconColor} />
              </motion.div>

              <h2 className="text-2xl font-black text-gray-900 leading-tight whitespace-pre-line">
                {slide.headline}
              </h2>
              <p className="text-sm text-gray-400 mt-3 leading-relaxed whitespace-pre-line">
                {slide.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mb-6">
          {SLIDES.map((_, i) => (
            <motion.div
              key={i}
              className={`h-2 rounded-full ${i === current ? "bg-blue-500 w-5" : "bg-gray-200 w-2"}`}
              layout
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          ))}
        </div>

        {/* Bottom buttons */}
        <div className="space-y-3 pb-4">
          {isLast ? (
            <button
              onClick={handleLogin}
              disabled={isLogging}
              className="w-full py-4 bg-blue-500 text-white rounded-2xl font-bold text-base shadow-lg shadow-blue-200 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {isLogging ? "로그인 중..." : "토스로 시작하기"}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="w-full py-4 bg-blue-500 text-white rounded-2xl font-bold text-base shadow-lg shadow-blue-200 active:scale-[0.98] transition-all"
            >
              다음
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
