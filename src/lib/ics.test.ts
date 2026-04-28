import { describe, it, expect } from 'vitest';
import { renderIcs, eventToVevent, escapeIcsText, foldIcsLine, EventLike } from './ics';

const baseEvent: EventLike = {
  id: 'cuid_abc123',
  eventType: 'WEDDING',
  targetName: '김진호',
  date: new Date('2026-03-15T05:00:00Z'),
  location: '서울 강남 그랜드볼룸',
  relation: '친구',
  memo: '축의금 10만원',
  sourceUrl: null,
};

describe('escapeIcsText', () => {
  it('이스케이프: 콤마/세미콜론/백슬래시/개행', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });
  it('빈 문자열은 빈 문자열', () => {
    expect(escapeIcsText('')).toBe('');
  });
  it('한글은 그대로 통과', () => {
    expect(escapeIcsText('결혼식')).toBe('결혼식');
  });
});

describe('foldIcsLine', () => {
  it('75 octet 이하는 그대로', () => {
    expect(foldIcsLine('SUMMARY:결혼식')).toBe('SUMMARY:결혼식');
  });
  it('75 octet 초과 시 CRLF + space 로 접기', () => {
    const longText = 'SUMMARY:' + '가'.repeat(30);
    const folded = foldIcsLine(longText);
    expect(folded).toContain('\r\n ');
    for (const part of folded.split('\r\n')) {
      expect(Buffer.byteLength(part, 'utf-8')).toBeLessThanOrEqual(75);
    }
  });
});

describe('eventToVevent', () => {
  it('all-day VEVENT 생성', () => {
    const v = eventToVevent(baseEvent, new Date('2026-04-28T03:00:00Z'));
    expect(v).toContain('BEGIN:VEVENT');
    expect(v).toContain('UID:cuid_abc123@maeum-jungsan');
    expect(v).toContain('DTSTAMP:20260428T030000Z');
    expect(v).toContain('DTSTART;VALUE=DATE:20260315');
    expect(v).toContain('DTEND;VALUE=DATE:20260316');
    expect(v).toContain('SUMMARY:결혼식 - 김진호');
    expect(v).toContain('LOCATION:서울 강남 그랜드볼룸');
    expect(v).toContain('DESCRIPTION:관계: 친구\\n메모: 축의금 10만원');
    expect(v).toContain('CATEGORIES:경조사,결혼식');
    expect(v).toContain('END:VEVENT');
  });

  it('eventType 4종 라벨 매핑', () => {
    const types: Array<[EventLike['eventType'], string]> = [
      ['WEDDING', '결혼식'], ['FUNERAL', '장례식'],
      ['BIRTHDAY', '생일'], ['OTHER', '기타'],
    ];
    for (const [t, label] of types) {
      const v = eventToVevent({ ...baseEvent, eventType: t }, new Date('2026-04-28T03:00:00Z'));
      expect(v).toContain(`SUMMARY:${label} - 김진호`);
      expect(v).toContain(`CATEGORIES:경조사,${label}`);
    }
  });

  it('빈 location/relation/memo 시 해당 줄 생략', () => {
    const v = eventToVevent({
      ...baseEvent, location: '', relation: '', memo: '',
    }, new Date('2026-04-28T03:00:00Z'));
    expect(v).not.toContain('LOCATION:');
    expect(v).not.toContain('DESCRIPTION:');
  });

  it('sourceUrl 있으면 DESCRIPTION 에 초대장 줄', () => {
    const v = eventToVevent({
      ...baseEvent, memo: '', sourceUrl: 'https://card.example.com/abc',
    }, new Date('2026-04-28T03:00:00Z'));
    expect(v).toContain('DESCRIPTION:관계: 친구\\n초대장: https://card.example.com/abc');
  });

  it('description 콤마/세미콜론 escape', () => {
    const v = eventToVevent({
      ...baseEvent, relation: '', memo: '메모; 콤마, 백슬래시\\',
    }, new Date('2026-04-28T03:00:00Z'));
    expect(v).toContain('DESCRIPTION:메모: 메모\\; 콤마\\, 백슬래시\\\\');
  });
});

describe('renderIcs', () => {
  it('VCALENDAR 래핑 + 다중 VEVENT', () => {
    const events: EventLike[] = [
      { ...baseEvent, id: 'a', targetName: '김진호' },
      { ...baseEvent, id: 'b', targetName: '이수연', eventType: 'FUNERAL' },
    ];
    const ics = renderIcs(events, new Date('2026-04-28T03:00:00Z'));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//maeum-jungsan//KO');
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(2);
    expect(ics.match(/END:VEVENT/g)?.length).toBe(2);
  });

  it('빈 events 면 VCALENDAR 만', () => {
    const ics = renderIcs([], new Date('2026-04-28T03:00:00Z'));
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('모든 줄 CRLF 종료', () => {
    const ics = renderIcs([baseEvent], new Date('2026-04-28T03:00:00Z'));
    const lines = ics.split('\r\n');
    expect(lines[lines.length - 1]).toBe('');
    expect(lines.length).toBeGreaterThan(5);
  });
});
