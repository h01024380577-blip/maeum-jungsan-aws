"use client";

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Home, Calendar as CalendarIcon, ClipboardPaste, User, BookUser } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ConfirmDialog } from '@toss/tds-mobile';
import { consumeBackHandler } from '@/src/lib/backHandlers';
import { useBackHandler } from '@/src/hooks/useBackHandler';

type Tab = 'home' | 'calendar' | 'history' | 'stats' | 'contacts';

const tabs: { key: Tab; icon: typeof Home; label: string; path: string }[] = [
  { key: 'home', icon: Home, label: '홈', path: '/' },
  { key: 'calendar', icon: CalendarIcon, label: '달력', path: '/calendar' },
  { key: 'history', icon: ClipboardPaste, label: '내역', path: '/history' },
  { key: 'contacts', icon: BookUser, label: '연락처', path: '/contacts' },
  { key: 'stats', icon: User, label: 'MY', path: '/stats' },
];

function isAppsInToss(): boolean {
  return typeof window !== 'undefined' && window.navigator.userAgent.includes('TossApp');
}

export default function Layout({ children, activeTab }: { children: React.ReactNode; activeTab: Tab }) {
  const router = useRouter();
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  useBackHandler(showExitConfirm, () => {
    setShowExitConfirm(false);
    return true;
  });

  // 뒤로가기: 다른 탭 → 홈, 홈 → 종료 확인
  useEffect(() => {
    // 항상 pushState를 유지해서 popstate를 잡을 수 있게
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      if (consumeBackHandler()) {
        window.history.pushState(null, '', window.location.href);
        return;
      }

      if (activeTab === 'home') {
        // 홈에서 뒤로가기 → 종료 확인
        window.history.pushState(null, '', window.location.href);
        setShowExitConfirm(true);
      } else {
        // 다른 탭에서 뒤로가기 → 홈으로
        router.replace('/');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, router]);

  const handleExit = useCallback(async () => {
    if (isAppsInToss()) {
      try {
        const { closeView } = await import('@apps-in-toss/web-framework');
        await closeView();
      } catch {
        // closeView 실패 시 fallback
        window.history.go(-(window.history.length - 1));
      }
    } else {
      // 웹 브라우저: 탭 닫기 시도 → 안 되면 히스토리 초기화
      window.close();
      setTimeout(() => {
        window.history.go(-(window.history.length - 1));
      }, 100);
    }
  }, []);

  // 내비게이션바(로고·앱 이름)는 앱인토스 콘솔 + granite.config.ts brand 설정으로만 제어된다.
  // web-bridge SDK에 setNavigationBar 류의 API는 없으므로 클라이언트에서 덮어쓰지 않는다.

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center md:py-6">


      <div
        data-tour-frame="app"
        className="w-full max-w-[430px] h-screen md:h-[880px] bg-gray-50 md:rounded-[44px] md:border-[7px] md:border-zinc-800 md:shadow-2xl relative overflow-hidden overflow-x-hidden flex flex-col"
      >
        <main className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </main>

        {/* Bottom Navigation — 토스 미니앱 가이드: 플로팅 형태 탭바 (토스 기본 하단 탭과 형태가 겹치지 않도록) */}
        <nav className="pointer-events-none absolute inset-x-0 bottom-0 z-50 px-6 pb-[var(--tabbar-gap)]">
          <div className="pointer-events-auto mx-auto flex max-w-[380px] items-center justify-around rounded-full bg-white px-1.5 shadow-[0_6px_20px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.06)]">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => router.push(tab.path)}
                  aria-current={isActive ? 'page' : undefined}
                  className="flex flex-1 flex-col items-center justify-center rounded-full py-2 transition-transform active:scale-90"
                >
                  <Icon
                    size={21}
                    strokeWidth={isActive ? 2.4 : 1.6}
                    className={isActive ? 'text-blue-500' : 'text-gray-400'}
                  />
                  <span className={`text-[10px] mt-1 font-semibold ${isActive ? 'text-blue-500' : 'text-gray-400'}`}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* 앱 종료 확인 다이얼로그 */}
        <ConfirmDialog
          open={showExitConfirm}
          title="마음정산을 종료할까요?"
          closeOnDimmerClick
          onClose={() => setShowExitConfirm(false)}
          cancelButton={
            <ConfirmDialog.CancelButton
              variant="weak"
              onClick={() => setShowExitConfirm(false)}
            >
              닫기
            </ConfirmDialog.CancelButton>
          }
          confirmButton={
            <ConfirmDialog.ConfirmButton onClick={handleExit}>
              종료하기
            </ConfirmDialog.ConfirmButton>
          }
        />
      </div>
    </div>
  );
}
