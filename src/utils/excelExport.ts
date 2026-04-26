import * as XLSX from 'xlsx';
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

export interface ExportOptions {
  entries: EventEntry[];
  contacts: Contact[];
}

export function exportToExcel({ entries, contacts }: ExportOptions): { filename: string; rowCount: number } {
  const sortedEntries = [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const entryRows = sortedEntries.map((e) => ({
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

  const contactRows = [...contacts]
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'))
    .map((c) => ({
      이름: c.name || '',
      연락처: c.phone || '',
      카카오ID: c.kakaoId || '',
      관계: c.relation || '',
      즐겨찾기: c.isFavorite ? 'Y' : '',
    }));

  const wb = XLSX.utils.book_new();

  const entrySheet = XLSX.utils.json_to_sheet(entryRows, {
    header: ['날짜', '구분', '이름', '금액', '종류', '관계', '장소', '메모', '입력방식'],
  });
  entrySheet['!cols'] = [
    { wch: 12 }, { wch: 6 }, { wch: 14 }, { wch: 12 },
    { wch: 8 }, { wch: 10 }, { wch: 18 }, { wch: 24 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, entrySheet, '내역');

  const contactSheet = XLSX.utils.json_to_sheet(contactRows, {
    header: ['이름', '연락처', '카카오ID', '관계', '즐겨찾기'],
  });
  contactSheet['!cols'] = [
    { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 8 },
  ];
  XLSX.utils.book_append_sheet(wb, contactSheet, '연락처');

  const filename = `마음정산_백업_${todayStamp()}.xlsx`;
  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { filename, rowCount: entryRows.length + contactRows.length };
}
