/**
 * Gemini API 공통 헬퍼
 * parse-url, parse-income-text 등 여러 라우트에서 공유
 */

export type Confidence = 'high' | 'medium' | 'low';

/** Gemini 응답 텍스트를 JSON으로 안전하게 파싱. 실패 시 빈 객체 반환. */
export function parseAiResponse<T = unknown>(text: string): T | Record<string, never> {
  try {
    return JSON.parse(text) as T;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    try {
      return m ? (JSON.parse(m[0]) as T) : {};
    } catch {
      return {};
    }
  }
}

/** 필드 채움 개수로 confidence 계산. 기본 임계값: 3개 이상 high, 2개 medium, 나머지 low. */
export function calculateConfidence(
  fields: Array<string | number | null | undefined>,
  thresholds: { high: number; medium: number } = { high: 3, medium: 2 },
): Confidence {
  const filled = fields.filter((v) => {
    if (v == null) return false;
    if (typeof v === 'string') return v.trim() !== '';
    return true;
  }).length;

  if (filled >= thresholds.high) return 'high';
  if (filled >= thresholds.medium) return 'medium';
  return 'low';
}

/** Gemini API rate limit(429) 에러 판별. */
export function isRateLimitError(err: unknown): boolean {
  const anyErr = err as { message?: string } | null;
  const msg = anyErr?.message || JSON.stringify(err) || '';
  return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
}

/**
 * Gemini 일시적 장애(Transient). rate limit(429) + service unavailable(503) + overloaded.
 * 이 에러는 사용자 잘못이 아니므로 크레딧을 환불해야 함.
 */
export function isTransientGeminiError(err: unknown): boolean {
  const anyErr = err as { message?: string } | null;
  const msg = anyErr?.message || JSON.stringify(err) || '';
  return (
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('overloaded') ||
    msg.includes('high demand') ||
    msg.includes('quota')
  );
}

/** 클라이언트에 반환할 rate limit 응답 객체. */
export const RATE_LIMIT_RESPONSE = {
  success: false as const,
  reason: 'rate_limit' as const,
  message: '무료 분석 한도를 모두 이용하셨습니다. 잠시 후 다시 시도해 주세요.',
};

/** AI 서비스 일시 장애 응답 (503/UNAVAILABLE 용). */
export const TRANSIENT_RESPONSE = {
  success: false as const,
  reason: 'temporarily_unavailable' as const,
  message: 'AI 서비스가 잠시 혼잡해요. 잠시 후 다시 시도해 주세요. (분석 횟수는 차감되지 않아요)',
};

/**
 * 파싱 결과가 "유의미한 정보를 하나라도" 담고 있는지 판정.
 * targetName / date / location 중 최소 1개가 채워져야 true.
 * 전부 비어있으면 사용자에게 아무 도움도 안 되므로 크레딧 환불 대상.
 */
export function hasMeaningfulData(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  const fields = [d.targetName, d.date, d.location];
  return fields.some((v) => typeof v === 'string' && v.trim() !== '');
}

/** 유의미 필드 0개로 파싱이 사실상 실패한 경우의 사용자 응답. */
export const LOW_CONFIDENCE_RESPONSE = {
  success: false as const,
  reason: 'low_confidence' as const,
  message: '초대장 정보를 충분히 읽지 못했어요. 직접 입력을 이용해 주세요. (분석 횟수는 차감되지 않아요)',
};
