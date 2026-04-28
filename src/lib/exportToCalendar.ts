import { apiFetch } from './apiClient';

export interface ExportToCalendarResult {
  fileName: string;
  eventCount: number;
  via: 'ait-openurl' | 'browser-redirect';
}

interface ServerResponse {
  success?: boolean;
  url?: string;
  token?: string;
  fileName?: string;
  eventCount?: number;
  error?: string;
}

async function requestIcs(
  scope: 'single' | 'all',
  eventId?: string,
): Promise<{ url: string; fileName: string; eventCount: number }> {
  const res = await apiFetch('/api/calendar/ics', {
    method: 'POST',
    body: JSON.stringify({ scope, eventId }),
  });
  const json: ServerResponse = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success || !json.url || !json.fileName) {
    throw new Error(json?.error ?? `http_${res.status}`);
  }
  return {
    url: json.url,
    fileName: json.fileName,
    eventCount: json.eventCount ?? 0,
  };
}

async function openInSystemBrowser(url: string): Promise<'ait-openurl' | 'browser-redirect'> {
  // 1) AIT openURL — 시스템 브라우저로 위임 (CSV export 와 동일 패턴)
  try {
    const mod = await import('@apps-in-toss/web-framework');
    const m = mod as { openURL?: (url: string) => Promise<void> };
    if (typeof m.openURL === 'function') {
      await m.openURL(url);
      return 'ait-openurl';
    }
  } catch (err) {
    console.warn('[ics] AIT openURL 실패, 브라우저 폴백 시도:', err);
  }
  // 2) 브라우저 폴백 — 같은 창에서 attachment 다운로드 트리거
  if (typeof window !== 'undefined') {
    window.location.href = url;
    return 'browser-redirect';
  }
  throw new Error('no_open_method');
}

export async function exportEventToCalendar(eventId: string): Promise<ExportToCalendarResult> {
  const { url, fileName, eventCount } = await requestIcs('single', eventId);
  const via = await openInSystemBrowser(url);
  return { fileName, eventCount: eventCount || 1, via };
}

export async function exportAllEventsToCalendar(): Promise<ExportToCalendarResult> {
  const { url, fileName, eventCount } = await requestIcs('all');
  const via = await openInSystemBrowser(url);
  return { fileName, eventCount, via };
}
