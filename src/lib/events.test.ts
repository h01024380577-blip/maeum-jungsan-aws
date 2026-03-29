import { describe, it, expect } from 'vitest';
import { resolveUiTheme, validateCreateEventInput } from './events';

describe('resolveUiTheme', () => {
  it('FUNERAL이면 SOLEMN을 반환한다', () => {
    expect(resolveUiTheme('FUNERAL')).toBe('SOLEMN');
  });

  it('WEDDING이면 DEFAULT를 반환한다', () => {
    expect(resolveUiTheme('WEDDING')).toBe('DEFAULT');
  });

  it('BIRTHDAY이면 DEFAULT를 반환한다', () => {
    expect(resolveUiTheme('BIRTHDAY')).toBe('DEFAULT');
  });

  it('OTHER이면 DEFAULT를 반환한다', () => {
    expect(resolveUiTheme('OTHER')).toBe('DEFAULT');
  });
});

describe('validateCreateEventInput', () => {
  it('유효한 입력을 통과시킨다', () => {
    const input = {
      eventType: 'WEDDING',
      targetName: '김진호',
      date: '2026-01-03',
    };
    const result = validateCreateEventInput(input);
    expect(result.valid).toBe(true);
  });

  it('eventType이 없으면 실패한다', () => {
    const input = { targetName: '김진호', date: '2026-01-03' };
    const result = validateCreateEventInput(input);
    expect(result.valid).toBe(false);
  });

  it('targetName이 없으면 실패한다', () => {
    const input = { eventType: 'WEDDING', date: '2026-01-03' };
    const result = validateCreateEventInput(input);
    expect(result.valid).toBe(false);
  });

  it('date가 없으면 실패한다', () => {
    const input = { eventType: 'WEDDING', targetName: '김진호' };
    const result = validateCreateEventInput(input);
    expect(result.valid).toBe(false);
  });

  it('잘못된 eventType이면 실패한다', () => {
    const input = { eventType: 'PARTY', targetName: '김진호', date: '2026-01-03' };
    const result = validateCreateEventInput(input);
    expect(result.valid).toBe(false);
  });
});
