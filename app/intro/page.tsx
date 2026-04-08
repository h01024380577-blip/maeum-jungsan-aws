"use client";

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { tossLogin } from '@/src/lib/tossAuth';
import { apiFetch, setAuthToken } from '@/src/lib/apiClient';
import { toast } from 'sonner';
import Onboarding from '@/src/components/Onboarding';

export default function IntroPage() {
  const router = useRouter();

  const handleLogin = useCallback(async () => {
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
      router.push('/');
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || `로그인 실패 (${res.status})`);
    }
  }, [router]);

  const handleComplete = useCallback(() => {
    router.push('/');
  }, [router]);

  return (
    <Onboarding onComplete={handleComplete} onLogin={handleLogin} />
  );
}
