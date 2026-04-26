import Papa from 'papaparse';
import type { EventEntry, Contact } from '../store/useStore';
import { apiFetch } from '../lib/apiClient';

const eventTypeLabel = (t: string, custom?: string) => {
  if (t === 'wedding') return '결혼';
  if (t === 'funeral') return '부고';
  if (t === 'birthday') return '생일';
  return custom || '기타';
};

const sourceLabel = (s?: string) => {
  switch (s) {
    case 'URL': return 'URL 파싱';
    case 'OCR': return '이미지 OCR';
    case 'SMS_PASTE': return 'SMS 붙여넣기';
    case 'CSV': return 'CSV 가져오기';
    case 'MANUAL':
    default:
      return '직접 입력';
  }
};

const todayStamp = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
};

const CSV_MIME_BROWSER = 'text/csv';

export interface ExportOptions {
  entries: EventEntry[];
  // contacts 는 단일 CSV 한계로 제외 (필요 시 별도 export 옵션으로 분리)
  contacts?: Contact[];
}

export interface ExportResult {
  filename: string;
  rowCount: number;
  via: 'ait-openurl' | 'browser-blob';
}

export async function exportToCsv({ entries }: ExportOptions): Promise<ExportResult> {
  const sortedEntries = [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const rows = sortedEntries.map((e) => ({
    날짜: e.date || '',
    구분: e.type === 'INCOME' ? '받음' : '보냄',
    이름: e.targetName || '',
    금액: typeof e.amount === 'number' ? e.amount : 0,
    종류: eventTypeLabel(e.eventType, e.customEventName),
    관계: e.relation || '',
    장소: e.location || '',
    메모: e.memo || '',
    입력방식: sourceLabel(e.source),
  }));

  // Excel 한글 호환을 위해 UTF-8 BOM 첨부
  const csv = '\uFEFF' + Papa.unparse(rows, {
    header: true,
    columns: ['날짜', '구분', '이름', '금액', '종류', '관계', '장소', '메모', '입력방식'],
  });

  const filename = `마음정산_백업_${todayStamp()}.csv`;
  const rowCount = rows.length;

  // 1) AIT(토스 WebView) — saveBase64Data 가 Android 에서 silent fail 하는 문제로
  // 서버에 임시 저장 → openURL 로 시스템 브라우저 다운로드 우회 사용
  try {
    const mod = await import('@apps-in-toss/web-framework');
    const m = mod as {
      openURL?: (url: string) => Promise<void>;
      getPlatformOS?: () => string;
      getTossAppVersion?: () => string;
    };
    if (typeof m.openURL === 'function') {
      const platform = typeof m.getPlatformOS === 'function' ? m.getPlatformOS() : 'unknown';
      const appVersion = typeof m.getTossAppVersion === 'function' ? m.getTossAppVersion() : 'unknown';
      console.log('[export] AIT 우회 경로 시도', { platform, appVersion, csvBytes: csv.length });

      const res = await apiFetch('/api/export/csv', {
        method: 'POST',
        body: JSON.stringify({ csv, fileName: filename }),
      });
      const json: { success?: boolean; url?: string; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success || !json.url) {
        throw new Error(`server upload failed: ${json?.error ?? res.status}`);
      }
      console.log('[export] 서버 업로드 성공, openURL 호출:', json.url);
      await m.openURL(json.url);
      console.log('[export] openURL 완료 — 시스템 브라우저에서 다운로드');
      return { filename, rowCount, via: 'ait-openurl' };
    }
  } catch (err) {
    console.warn('[export] AIT 우회 경로 실패, 브라우저 폴백 사용:', err);
  }

  // 2) 브라우저 폴백 — Blob + a[download]
  const blob = new Blob([csv], { type: `${CSV_MIME_BROWSER};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { filename, rowCount, via: 'browser-blob' };
}
