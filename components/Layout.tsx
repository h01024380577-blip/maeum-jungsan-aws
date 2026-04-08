"use client";

import React, { useEffect, useRef, useCallback } from 'react';
import { Home, Calendar as CalendarIcon, History, BarChart3, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

type Tab = 'home' | 'calendar' | 'history' | 'stats' | 'contacts';

const tabs: { key: Tab; icon: typeof Home; label: string; path: string }[] = [
  { key: 'home', icon: Home, label: '홈', path: '/' },
  { key: 'calendar', icon: CalendarIcon, label: '달력', path: '/calendar' },
  { key: 'history', icon: History, label: '내역', path: '/history' },
  { key: 'contacts', icon: Users, label: '연락처', path: '/contacts' },
  { key: 'stats', icon: BarChart3, label: '통계', path: '/stats' },
];

const tabPathMap: Record<string, string> = Object.fromEntries(tabs.map(t => [t.key, t.path]));

function isAppsInToss(): boolean {
  return typeof window !== 'undefined' && window.navigator.userAgent.includes('TossApp');
}

export default function Layout({ children, activeTab }: { children: React.ReactNode; activeTab: Tab }) {
  const router = useRouter();
  const tabHistoryRef = useRef<Tab[]>([]);

  // 탭 히스토리 관리
  useEffect(() => {
    const history = tabHistoryRef.current;
    if (history[history.length - 1] !== activeTab) {
      history.push(activeTab);
      // 최대 20개까지만 보관
      if (history.length > 20) history.splice(0, history.length - 20);
    }
  }, [activeTab]);

  // 뒤로가기 (popstate) 시 이전 탭으로 이동
  const handlePopState = useCallback(() => {
    const history = tabHistoryRef.current;
    if (history.length > 1) {
      history.pop(); // 현재 탭 제거
      const prevTab = history[history.length - 1];
      if (prevTab && tabPathMap[prevTab]) {
        router.replace(tabPathMap[prevTab]);
      }
    }
  }, [router]);

  useEffect(() => {
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [handlePopState]);

  // 탭 전환 시 history.pushState로 브라우저 히스토리에 추가
  const navigateTab = useCallback((path: string) => {
    window.history.pushState(null, '', path);
    router.push(path);
  }, [router]);

  useEffect(() => {
    if (!isAppsInToss()) return;
    import('@apps-in-toss/web-framework').then((sdk: any) => {
      sdk.setNavigationBar?.({ title: '마음정산', visible: true });
    });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center md:py-6">


      <div className="w-full max-w-[430px] h-screen md:h-[880px] bg-gray-50 md:rounded-[44px] md:border-[7px] md:border-zinc-800 md:shadow-2xl relative overflow-hidden overflow-x-hidden flex flex-col">
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

        {/* Bottom Navigation */}
        <nav className="shrink-0 bg-white border-t border-gray-100 safe-bottom z-50">
          <div className="flex justify-around items-center pt-2.5 pb-2 px-3">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => navigateTab(tab.path)}
                  className="relative flex flex-col items-center justify-center w-14 py-1 rounded-xl transition-all active:scale-90"
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute -top-2.5 w-5 h-[3px] bg-blue-500 rounded-full"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
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
      </div>
    </div>
  );
}
