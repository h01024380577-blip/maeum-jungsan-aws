import { describe, it, expect } from 'vitest';
import { normalizeItem, normalizeIncomeBatch } from './parseIncomeText';

describe('normalizeItem', () => {
  it('KB 단일 알림 — 모든 필드 정상 통과', () => {
    const raw = {
      senderName: '김진호',
      amount: 50000,
      bank: 'KB국민은행',
      date: '2026-04-14',
      confidence: 'high',
    };
    expect(normalizeItem(raw)).toEqual({
      senderName: '김진호',
      amount: 50000,
      bank: 'KB국민은행',
      date: '2026-04-14',
      confidence: 'high',
    });
  });

  it('카카오페이 단일 알림 — date 없음 → null', () => {
    const raw = {
      senderName: '이나은',
      amount: 100000,
      bank: '카카오페이',
      date: null,
      confidence: 'high',
    };
    const result = normalizeItem(raw);
    expect(result?.bank).toBe('카카오페이');
    expect(result?.date).toBeNull();
  });

  it('토스 단일 알림 — confidence: medium 유지', () => {
    const raw = {
      senderName: '박서준',
      amount: 30000,
      bank: '토스',
      date: null,
      confidence: 'medium',
    };
    expect(normalizeItem(raw)?.confidence).toBe('medium');
  });

  it('amount가 문자열이어도 Number로 변환', () => {
    const raw = { senderName: '홍길동', amount: '75000', bank: '신한', confidence: 'high' };
    expect(normalizeItem(raw)?.amount).toBe(75000);
  });

  it('senderName 공백 trim', () => {
    const raw = { senderName: '  김민수  ', amount: 10000, confidence: 'high' };
    expect(normalizeItem(raw)?.senderName).toBe('김민수');
  });

  it('senderName 비어있으면 null', () => {
    expect(normalizeItem({ senderName: '', amount: 10000 })).toBeNull();
    expect(normalizeItem({ senderName: '   ', amount: 10000 })).toBeNull();
  });

  it('amount가 0이거나 음수면 null', () => {
    expect(normalizeItem({ senderName: '김', amount: 0 })).toBeNull();
    expect(normalizeItem({ senderName: '김', amount: -1000 })).toBeNull();
  });

  it('amount가 NaN이면 null (이름만 있는 알림 제외)', () => {
    expect(normalizeItem({ senderName: '김', amount: 'abc' })).toBeNull();
    expect(normalizeItem({ senderName: '김' })).toBeNull();
  });

  it('bank 공백/빈 문자열 → null', () => {
    expect(normalizeItem({ senderName: '김', amount: 1000, bank: '   ' })?.bank).toBeNull();
    expect(normalizeItem({ senderName: '김', amount: 1000, bank: '' })?.bank).toBeNull();
  });

  it('date 형식이 YYYY-MM-DD 아니면 null', () => {
    expect(normalizeItem({ senderName: '김', amount: 1000, date: '2026/04/14' })?.date).toBeNull();
    expect(normalizeItem({ senderName: '김', amount: 1000, date: '2026-4-14' })?.date).toBeNull();
    expect(normalizeItem({ senderName: '김', amount: 1000, date: '오늘' })?.date).toBeNull();
  });

  it('confidence 대소문자 정규화', () => {
    expect(normalizeItem({ senderName: '김', amount: 1000, confidence: 'HIGH' })?.confidence).toBe('high');
    expect(normalizeItem({ senderName: '김', amount: 1000, confidence: 'Medium' })?.confidence).toBe('medium');
  });

  it('confidence 무효 값이면 필드 개수로 재계산', () => {
    // senderName + amount + bank 3개 채워짐 → high
    const full = normalizeItem({ senderName: '김', amount: 1000, bank: 'KB', confidence: 'weird' });
    expect(full?.confidence).toBe('high');
    // senderName + amount 2개 → medium
    const half = normalizeItem({ senderName: '김', amount: 1000, confidence: 'weird' });
    expect(half?.confidence).toBe('medium');
  });

  it('null/undefined/비객체 입력 안전 처리', () => {
    expect(normalizeItem(null)).toBeNull();
    expect(normalizeItem(undefined)).toBeNull();
    expect(normalizeItem('string')).toBeNull();
    expect(normalizeItem(42)).toBeNull();
  });
});

describe('normalizeIncomeBatch', () => {
  it('여러 은행 혼합 (3건) 파싱 — 모두 유효', () => {
    const raw = {
      data: [
        { senderName: '김진호', amount: 50000, bank: 'KB국민은행', date: '2026-04-14', confidence: 'high' },
        { senderName: '이나은', amount: 100000, bank: '카카오페이', date: null, confidence: 'high' },
        { senderName: '박서준', amount: 30000, bank: '토스', date: null, confidence: 'medium' },
      ],
    };
    const result = normalizeIncomeBatch(raw);
    expect(result).toHaveLength(3);
    expect(result[0].senderName).toBe('김진호');
    expect(result[1].bank).toBe('카카오페이');
    expect(result[2].confidence).toBe('medium');
  });

  it('이름 없는 알림(예: 카드 결제)은 배열에서 제외', () => {
    const raw = {
      data: [
        { senderName: '김진호', amount: 50000 },
        { senderName: '', amount: 15000 }, // 카드 결제 "14,500원 결제"
        { senderName: '박서준', amount: 30000 },
      ],
    };
    expect(normalizeIncomeBatch(raw)).toHaveLength(2);
  });

  it('data가 없거나 배열이 아니면 빈 배열', () => {
    expect(normalizeIncomeBatch({})).toEqual([]);
    expect(normalizeIncomeBatch({ data: null })).toEqual([]);
    expect(normalizeIncomeBatch({ data: 'not array' })).toEqual([]);
    expect(normalizeIncomeBatch(null)).toEqual([]);
    expect(normalizeIncomeBatch(undefined)).toEqual([]);
  });

  it('빈 배열은 그대로 빈 배열', () => {
    expect(normalizeIncomeBatch({ data: [] })).toEqual([]);
  });

  it('부분 무효 아이템은 필터링, 유효 아이템만 반환', () => {
    const raw = {
      data: [
        { senderName: '김', amount: 1000 },
        null,
        { senderName: '', amount: 500 },
        { senderName: '박', amount: 'invalid' },
        { senderName: '이', amount: 3000 },
      ],
    };
    const result = normalizeIncomeBatch(raw);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.senderName)).toEqual(['김', '이']);
  });
});
