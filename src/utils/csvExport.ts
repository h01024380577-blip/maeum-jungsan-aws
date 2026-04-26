import Papa from 'papaparse';
import type { EventEntry, Contact } from '../store/useStore';

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

function utf8ToBase64(str: string): string {
  // UTF-8 한글 안전 변환 — TextEncoder 로 byte 배열 → base64 (chunk 처리)
  const bytes = new TextEncoder().encode(str);
  const chunkSize = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize)),
    );
  }
  return btoa(bin);
}

// 브라우저 다운로드용 (정확한 csv MIME)
const CSV_MIME_BROWSER = 'text/csv';
// AIT 네이티브용 — Android Toss 앱이 text/csv 를 silent reject 하므로 octet-stream 으로
// 강제 바이너리 다운로드 (확장자 .csv 가 핸들러 결정). 시뮬레이터는 무관.
const CSV_MIME_AIT = 'application/octet-stream';

export interface ExportOptions {
  entries: EventEntry[];
  // contacts 는 단일 CSV 한계로 제외 (필요 시 별도 export 옵션으로 분리)
  contacts?: Contact[];
}

export interface ExportResult {
  filename: string;
  rowCount: number;
  via: 'ait-bridge' | 'browser-blob';
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

  // 1) AIT(토스 WebView) 우선 — saveBase64Data 브리지 사용
  try {
    const mod = await import('@apps-in-toss/web-framework');
    const m = mod as {
      saveBase64Data?: (p: { data: string; fileName: string; mimeType: string }) => Promise<void>;
      getPlatformOS?: () => string;
      getTossAppVersion?: () => string;
    };
    if (typeof m.saveBase64Data === 'function') {
      const platform = typeof m.getPlatformOS === 'function' ? m.getPlatformOS() : 'unknown';
      const appVersion = typeof m.getTossAppVersion === 'function' ? m.getTossAppVersion() : 'unknown';
      const base64 = utf8ToBase64(csv);
      console.log('[export] AIT saveBase64Data 호출', { platform, appVersion, fileName: filename, base64Bytes: base64.length });
      await m.saveBase64Data({ data: base64, fileName: filename, mimeType: CSV_MIME_AIT });
      console.log('[export] AIT saveBase64Data 성공');
      return { filename, rowCount, via: 'ait-bridge' };
    }
  } catch (err) {
    console.warn('[export] AIT saveBase64Data 실패, 브라우저 폴백 사용:', err);
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
