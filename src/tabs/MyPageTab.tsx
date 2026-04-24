// src/tabs/MyPageTab.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Palette,
  HelpCircle,
  MessageSquare,
  Info,
  LogOut,
  LogIn,
} from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '@/src/store/useStore';
import { useTheme } from '@/src/lib/theme';
import { apiFetch } from '@/src/lib/apiClient';

import ProfileCard from '@/src/components/mypage/ProfileCard';
import CreditOverview from '@/src/components/mypage/CreditOverview';
import SettingsRow from '@/src/components/mypage/SettingsRow';
import StatsOverview from '@/src/components/mypage/StatsOverview';
import ThemePickerSheet from '@/src/components/mypage/ThemePickerSheet';
import FaqSheet from '@/src/components/mypage/FaqSheet';
import FeedbackSheet from '@/src/components/mypage/FeedbackSheet';
import LogoutConfirmDialog from '@/src/components/mypage/LogoutConfirmDialog';
import InlineBanner from '@/src/components/ads/InlineBanner';

const STATS_BANNER_AD_GROUP_ID =
  process.env.NEXT_PUBLIC_AD_GROUP_ID_STATS_BANNER || 'ait-ad-test-banner-id';

export default function MyPageTab() {
  const router = useRouter();
  const tossUserId = useStore((s) => s.tossUserId);
  const isLoaded = useStore((s) => s.isLoaded);
  const notificationsEnabled = useStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useStore((s) => s.setNotificationsEnabled);
  const clearData = useStore((s) => s.clearData);
  const { mode: themeMode, resolved: resolvedTheme } = useTheme();

  const [themeOpen, setThemeOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  // MY 탭은 게스트 접근 허용 (통계/설정 열람)
  // 로그인 필요한 액션은 각 행에서 분기

  if (!isLoaded) return null;

  const themeLabel =
    themeMode === 'system'
      ? `시스템 · ${resolvedTheme === 'dark' ? '다크' : '라이트'}`
      : themeMode === 'dark'
      ? '다크'
      : '라이트';

  const handleNotifToggle = async () => {
    if (!tossUserId) return;
    setNotifLoading(true);
    try {
      const next = !notificationsEnabled;
      const res = await apiFetch('/api/notification-consent', {
        method: 'POST',
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error('failed');
      setNotificationsEnabled(next);
      toast.success(next ? '알림을 허용했어요' : '알림을 껐어요');
    } catch {
      toast.error('알림 설정 변경에 실패했어요');
    } finally {
      setNotifLoading(false);
    }
  };

  const handleLogoutConfirm = () => {
    clearData();
    try {
      localStorage.removeItem('heartbook-onboarding-seen');
    } catch {}
    setLogoutOpen(false);
    router.replace('/');
  };

  return (
    <div className="pb-8 min-h-screen bg-white">
      {/* 헤더 — 탭 진입이라 뒤로가기 불필요. 제목만 */}
      <div className="px-5 pt-14 pb-2">
        <h1 className="text-[22px] font-black text-gray-900 tracking-tight">MY</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {tossUserId ? '나의 활동과 설정' : '비로그인 · 활동은 로그인 후 저장돼요'}
        </p>
      </div>

      <div className="px-5 pt-4 space-y-6">
        {/* ① 프로필 */}
        <ProfileCard />

        {/* ② 내 크레딧 */}
        <section>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
            내 크레딧
          </p>
          <CreditOverview />
        </section>

        {/* ③ 나의 통계 */}
        <section>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
            나의 통계
          </p>
          <StatsOverview />
        </section>

        {/* ④ 앱 설정 */}
        <section>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
            앱 설정
          </p>
          <div className="rounded-2xl bg-white border border-gray-100 divide-y divide-gray-100 overflow-hidden">
            {/* 푸시 알림 — 우측 pill이 독립 버튼 */}
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center shrink-0">
                  <Bell size={16} className="text-gray-500" />
                </div>
                <span className="text-sm font-bold text-gray-800 truncate">
                  푸시 알림
                </span>
              </div>
              <button
                type="button"
                onClick={handleNotifToggle}
                disabled={notifLoading}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 disabled:cursor-wait ${
                  notifLoading
                    ? 'bg-gray-100 text-gray-400'
                    : notificationsEnabled
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-500 text-white shadow-sm shadow-blue-200'
                }`}
              >
                {notifLoading
                  ? '...'
                  : notificationsEnabled
                  ? '허용됨'
                  : '허용하기'}
              </button>
            </div>
            <SettingsRow
              Icon={Palette}
              label="화면 테마"
              trailing={themeLabel}
              onClick={() => setThemeOpen(true)}
            />
          </div>
        </section>

        {/* ⑤ 지원 */}
        <section>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
            지원
          </p>
          <div className="rounded-2xl bg-white border border-gray-100 divide-y divide-gray-100 overflow-hidden">
            <SettingsRow
              Icon={HelpCircle}
              label="자주 묻는 질문"
              onClick={() => setFaqOpen(true)}
            />
            <SettingsRow
              Icon={MessageSquare}
              label="개발자에게 의견 보내기"
              onClick={() => setFeedbackOpen(true)}
            />
            <SettingsRow
              Icon={Info}
              label="버전 정보"
              trailing="v1.0.0"
              hideChevron
            />
          </div>
        </section>

        {/* ⑥ 계정 액션 */}
        <section>
          <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
            {tossUserId ? (
              <SettingsRow
                Icon={LogOut}
                label="로그아웃"
                danger
                hideChevron
                onClick={() => setLogoutOpen(true)}
              />
            ) : (
              <SettingsRow
                Icon={LogIn}
                label="토스 로그인"
                hideChevron
                onClick={() => router.push('/intro')}
              />
            )}
          </div>
        </section>

        {/* 배너 광고 — 기존 통계 탭 하단 위치 승계 */}
        <InlineBanner
          adGroupId={STATS_BANNER_AD_GROUP_ID}
          className="mt-2"
        />
      </div>

      <ThemePickerSheet open={themeOpen} onClose={() => setThemeOpen(false)} />
      <FaqSheet open={faqOpen} onClose={() => setFaqOpen(false)} />
      <FeedbackSheet
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
      <LogoutConfirmDialog
        open={logoutOpen}
        isLoggedIn={!!tossUserId}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={handleLogoutConfirm}
      />
    </div>
  );
}
