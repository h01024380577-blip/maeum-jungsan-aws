"use client";

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Onboarding from '@/src/components/Onboarding';

export default function IntroPage() {
  const router = useRouter();

  const handleComplete = useCallback(() => {
    router.push('/');
  }, [router]);

  return (
    <Onboarding onComplete={handleComplete} />
  );
}
