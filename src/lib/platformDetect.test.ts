import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isSamsungGalaxyDevice, hasSeenSamsungCalendarHint, markSamsungCalendarHintSeen } from './platformDetect';

describe('isSamsungGalaxyDevice', () => {
  it('SamsungBrowser UA 매칭', () => {
    expect(isSamsungGalaxyDevice(
      'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S921N) AppleWebKit/537.36 SamsungBrowser/24.0 Chrome/115.0.0.0 Mobile Safari/537.36'
    )).toBe(true);
  });

  it('SM- 모델 코드 매칭 (Chrome 환경)', () => {
    expect(isSamsungGalaxyDevice(
      'Mozilla/5.0 (Linux; Android 14; SM-G998U) Chrome/120.0.0.0 Mobile'
    )).toBe(true);
  });

  it('Pixel UA 는 false', () => {
    expect(isSamsungGalaxyDevice(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120.0.0.0 Mobile'
    )).toBe(false);
  });

  it('iPhone UA 는 false', () => {
    expect(isSamsungGalaxyDevice(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
    )).toBe(false);
  });

  it('빈 UA 는 false', () => {
    expect(isSamsungGalaxyDevice('')).toBe(false);
  });
});

describe('Samsung hint seen flag', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    });
  });

  it('초기 상태는 false', () => {
    expect(hasSeenSamsungCalendarHint()).toBe(false);
  });

  it('mark 후 true', () => {
    markSamsungCalendarHintSeen();
    expect(hasSeenSamsungCalendarHint()).toBe(true);
  });
});
