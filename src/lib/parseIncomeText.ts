/**
 * SMS/송금 알림 텍스트 파싱 결과의 정규화
 * Gemini가 반환한 raw 객체를 검증/정제해 저장 가능한 형태로 변환
 */

import { calculateConfidence, type Confidence } from './geminiHelpers';

export interface ParsedIncome {
  senderName: string;
  amount: number;
  bank: string | null;
  date: string | null;
  confidence: Confidence;
}

const VALID_CONFIDENCE: readonly Confidence[] = ['high', 'medium', 'low'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Gemini 응답 배열의 각 아이템을 검증.
 * 필수 필드 누락/무효 시 null 반환 → 배열에서 필터링.
 */
export function normalizeItem(raw: unknown): ParsedIncome | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const senderName = typeof r.senderName === 'string' ? r.senderName.trim() : '';
  const amount = typeof r.amount === 'number' ? r.amount : Number(r.amount);
  if (!senderName || !Number.isFinite(amount) || amount <= 0) return null;

  const bank = typeof r.bank === 'string' && r.bank.trim() !== '' ? r.bank.trim() : null;
  const date = typeof r.date === 'string' && DATE_PATTERN.test(r.date) ? r.date : null;

  const rawConfidence = typeof r.confidence === 'string' ? r.confidence.toLowerCase() : '';
  const confidence: Confidence = VALID_CONFIDENCE.includes(rawConfidence as Confidence)
    ? (rawConfidence as Confidence)
    : calculateConfidence([senderName, amount, bank]);

  return { senderName, amount, bank, date, confidence };
}

/**
 * Gemini 응답 전체를 정규화된 배열로 변환.
 * data 필드가 배열이 아니거나 비어있으면 빈 배열.
 */
export function normalizeIncomeBatch(parsed: unknown): ParsedIncome[] {
  const data = (parsed as { data?: unknown[] } | null)?.data;
  if (!Array.isArray(data)) return [];
  return data
    .map(normalizeItem)
    .filter((item): item is ParsedIncome => item !== null);
}
