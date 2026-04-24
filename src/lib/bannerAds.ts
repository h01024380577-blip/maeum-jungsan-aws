'use client';

/**
 * 앱인토스 배너 광고 (Toss Ads) 훅.
 * - TossAds.initialize는 앱 전체에서 1회만 호출되면 됨
 * - useTossBanner를 여러 컴포넌트에서 호출해도 안전 (이미 init된 경우 중복 초기화 안 함)
 * - 토스앱 5.241.0+ 에서만 지원, 미지원 환경에서는 isInitialized=false로 머문다
 */

import { useCallback, useEffect, useState } from 'react';

export interface TossBannerOptions {
  theme?: 'auto' | 'light' | 'dark';
  tone?: 'blackAndWhite' | 'grey';
  variant?: 'card' | 'expanded';
  callbacks?: {
    onAdRendered?: (payload: unknown) => void;
    onAdViewable?: (payload: unknown) => void;
    onAdClicked?: (payload: unknown) => void;
    onAdImpression?: (payload: unknown) => void;
    onAdFailedToRender?: (payload: unknown) => void;
    onNoFill?: (payload: unknown) => void;
  };
}

export interface TossBannerHandle {
  destroy: () => void;
}

let initialized = false;
let initializing = false;

export function useTossBanner() {
  const [isInitialized, setIsInitialized] = useState(initialized);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (initialized) {
      setIsInitialized(true);
      return;
    }
    if (initializing) return;
    initializing = true;

    (async () => {
      try {
        const mod = await import('@apps-in-toss/web-framework');
        const TossAds = (mod as { TossAds?: { initialize: { (opts: unknown): void; isSupported?: () => boolean } } }).TossAds;
        if (!TossAds || typeof TossAds.initialize?.isSupported === 'function' && !TossAds.initialize.isSupported()) {
          setUnsupported(true);
          initializing = false;
          return;
        }
        TossAds.initialize({
          callbacks: {
            onInitialized: () => {
              initialized = true;
              initializing = false;
              setIsInitialized(true);
            },
            onInitializationFailed: (err: unknown) => {
              initializing = false;
              setUnsupported(true);
              console.error('[TossAds] init failed:', err);
            },
          },
        });
      } catch (err) {
        initializing = false;
        setUnsupported(true);
        console.warn('[TossAds] module load failed (probably non-toss env):', err);
      }
    })();
  }, []);

  const attachBanner = useCallback(
    async (
      adGroupId: string,
      element: HTMLElement,
      options?: TossBannerOptions,
    ): Promise<TossBannerHandle | null> => {
      if (!isInitialized) return null;
      try {
        const mod = await import('@apps-in-toss/web-framework');
        const TossAds = (mod as { TossAds?: { attachBanner: (id: string, el: HTMLElement, opts?: unknown) => TossBannerHandle } }).TossAds;
        if (!TossAds?.attachBanner) return null;
        return TossAds.attachBanner(adGroupId, element, options);
      } catch (err) {
        console.warn('[TossAds] attachBanner failed:', err);
        return null;
      }
    },
    [isInitialized],
  );

  return { isInitialized, unsupported, attachBanner };
}
