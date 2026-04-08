"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/src/store/useStore";
import { tossLogin } from "@/src/lib/tossAuth";
import { apiFetch, setAuthToken } from "@/src/lib/apiClient";
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

  const handleTossLogin = useCallback(async () => {
    const result = await tossLogin();
    if (!result) return;
    const res = await apiFetch('/api/auth/toss', {
      method: 'POST',
      body: JSON.stringify(result),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.token) setAuthToken(data.token);
      await loadFromSupabase();
    }
  }, [loadFromSupabase]);

  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem('heartbook-onboarding-seen', 'true');
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

  const showOnboarding = !tossUserId && !hasSeenOnboarding && !SKIP_ONBOARDING_PATHS.includes(pathname);

  return (
    <>
      {children}
      {showOnboarding && (
        <Onboarding
          onComplete={handleOnboardingComplete}
          onLogin={handleTossLogin}
        />
      )}
    </>
  );
}
