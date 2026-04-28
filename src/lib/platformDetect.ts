/**
 * Samsung Galaxy 기기 감지 + Samsung 캘린더 안내 모달 1회 노출 추적.
 *
 * 감지 의도: Galaxy 사용자에게 "Samsung 캘린더를 default 앱으로 설정" 안내를
 * 첫 사용 시 1회 띄워, 이후 .ics 다운로드 → 알림 탭 시 항상 Samsung 캘린더가
 * 자동 열리도록 유도한다.
 */

const SAMSUNG_HINT_KEY = 'heartbook-samsung-cal-hint-seen';

export function isSamsungGalaxyDevice(userAgent: string): boolean {
  if (!userAgent) return false;
  // Samsung Internet 브라우저 (가장 신뢰)
  if (/SamsungBrowser/i.test(userAgent)) return true;
  // Samsung 기기 모델 코드: SM- 접두 (Galaxy S/Note/A/Z 시리즈)
  if (/\bSM-[A-Z0-9]+/i.test(userAgent)) return true;
  return false;
}

export function hasSeenSamsungCalendarHint(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(SAMSUNG_HINT_KEY) === '1';
}

export function markSamsungCalendarHintSeen(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SAMSUNG_HINT_KEY, '1');
}

/** 디버그용 — 안내 다시 보고 싶을 때 호출 */
export function resetSamsungCalendarHint(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(SAMSUNG_HINT_KEY);
}
