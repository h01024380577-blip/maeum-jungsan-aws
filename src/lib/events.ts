const VALID_EVENT_TYPES = ['WEDDING', 'FUNERAL', 'BIRTHDAY', 'OTHER'];

export function resolveUiTheme(eventType: string): 'DEFAULT' | 'SOLEMN' {
  return eventType === 'FUNERAL' ? 'SOLEMN' : 'DEFAULT';
}

export function validateCreateEventInput(input: any): { valid: boolean; message?: string } {
  if (!input.eventType || !VALID_EVENT_TYPES.includes(input.eventType)) {
    return { valid: false, message: '유효하지 않은 행사 종류입니다.' };
  }
  if (!input.targetName || typeof input.targetName !== 'string' || !input.targetName.trim()) {
    return { valid: false, message: '대상자 이름이 필요합니다.' };
  }
  if (!input.date) {
    return { valid: false, message: '행사 날짜가 필요합니다.' };
  }
  return { valid: true };
}
