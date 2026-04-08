"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/src/store/useStore";
import Onboarding from "@/src/components/Onboarding";

const SKIP_ONBOARDING_PATHS = ['/terms', '/intro'];

export default function Providers({ children }: { children: React.ReactNode }) {
  const { loadFromSupabase, isLoaded, tossUserId } = useStore();
  const pathname = usePathname();

  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('heartbook-onboarding-seen') === 'true'
  );

  useEffect(() => {
    loadFromSupabase();
  }, [loadFromSupabase]);

  // 비로그인 상태면 온보딩 상태 초기화 (로그아웃 후 온보딩 재표시)
  useEffect(() => {
    if (isLoaded && !tossUserId) {
      localStorage.removeItem('heartbook-onboarding-seen');
      setHasSeenOnboarding(false);
    }
  }, [isLoaded, tossUserId]);

  const handleOnboardingComplete = useCallback(() => {
    setHasSeenOnboarding(true);
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400 font-medium">마음정산 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 비로그인이면 무조건 온보딩 표시 (로그인 강제)
  const showOnboarding = !tossUserId && !SKIP_ONBOARDING_PATHS.includes(pathname);

  return (
    <>
      {children}
      {showOnboarding && (
        <Onboarding onComplete={handleOnboardingComplete} />
      )}
    </>
  );
}
