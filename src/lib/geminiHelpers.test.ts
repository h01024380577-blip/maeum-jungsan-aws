import { describe, it, expect } from 'vitest';
import {
  parseAiResponse,
  calculateConfidence,
  isRateLimitError,
  RATE_LIMIT_RESPONSE,
} from './geminiHelpers';

describe('parseAiResponse', () => {
  it('순수 JSON을 그대로 파싱한다', () => {
    expect(parseAiResponse('{"a":1}')).toEqual({ a: 1 });
  });

  it('텍스트에 섞인 JSON 블록을 추출한다', () => {
    expect(parseAiResponse('앞 설명 {"x":"y"} 뒷 설명')).toEqual({ x: 'y' });
  });

  it('JSON이 없으면 빈 객체를 반환한다', () => {
    expect(parseAiResponse('그냥 문자열')).toEqual({});
  });

  it('잘못된 JSON이면 빈 객체를 반환한다', () => {
    expect(parseAiResponse('{not json}')).toEqual({});
  });
});

describe('calculateConfidence', () => {
  it('3개 이상 채워지면 high', () => {
    expect(calculateConfidence(['a', 'b', 'c'])).toBe('high');
  });

  it('2개 채워지면 medium', () => {
    expect(calculateConfidence(['a', 'b', ''])).toBe('medium');
  });

  it('1개 이하면 low', () => {
    expect(calculateConfidence(['', '', 'c'])).toBe('low');
    expect(calculateConfidence(['', '', ''])).toBe('low');
  });

  it('null/undefined/공백문자열을 비어있는 것으로 취급', () => {
    expect(calculateConfidence([null, undefined, '  '])).toBe('low');
  });

  it('숫자 필드도 채워진 것으로 계산', () => {
    expect(calculateConfidence([50000, 'name', '2026-04-17'])).toBe('high');
  });

  it('커스텀 임계값 지원', () => {
    expect(calculateConfidence(['a', 'b'], { high: 2, medium: 1 })).toBe('high');
  });
});

describe('isRateLimitError', () => {
  it('429 문자열 포함 시 true', () => {
    expect(isRateLimitError({ message: 'Request failed with 429' })).toBe(true);
  });

  it('RESOURCE_EXHAUSTED 포함 시 true', () => {
    expect(isRateLimitError({ message: 'RESOURCE_EXHAUSTED' })).toBe(true);
  });

  it('quota 포함 시 true', () => {
    expect(isRateLimitError({ message: 'quota exceeded' })).toBe(true);
  });

  it('일반 에러는 false', () => {
    expect(isRateLimitError({ message: 'Network error' })).toBe(false);
  });

  it('null/undefined도 안전하게 처리', () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});

describe('RATE_LIMIT_RESPONSE', () => {
  it('success=false, reason="rate_limit"', () => {
    expect(RATE_LIMIT_RESPONSE.success).toBe(false);
    expect(RATE_LIMIT_RESPONSE.reason).toBe('rate_limit');
    expect(typeof RATE_LIMIT_RESPONSE.message).toBe('string');
  });
});
