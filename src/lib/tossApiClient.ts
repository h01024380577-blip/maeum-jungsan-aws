/**
 * 앱인토스 서버 API 공통 유틸
 * - fetch 재시도 (지수 백오프)
 * - AES-256-GCM 복호화
 * - scope 안전 파싱
 */
import { createDecipheriv } from 'crypto';

export const TOSS_API_BASE = 'https://apps-in-toss-api.toss.im';

// fetch with retry
interface FetchOptions extends RequestInit { retries?: number; baseDelay?: number; }

export async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<Response> {
  const { retries = 2, baseDelay = 300, ...fetchOpts } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, fetchOpts);
      if (res.status >= 500 && attempt < retries) { await sleep(baseDelay * 2 ** attempt); continue; }
      return res;
    } catch (e) {
      lastError = e;
      if (attempt < retries) await sleep(baseDelay * 2 ** attempt);
    }
  }
  throw lastError;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// AES-256-GCM 복호화 (키 없으면 null 반환, 로그에 암호문 남기지 않음)
export function decryptField(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null;
  const key = process.env.TOSS_DECRYPT_KEY;
  const aad = process.env.TOSS_DECRYPT_AAD;
  if (!key || !aad) return null;
  try {
    const IV_LENGTH = 12;
    const keyBuf = Buffer.from(key, 'base64');
    const decoded = Buffer.from(encrypted, 'base64');
    const iv = decoded.subarray(0, IV_LENGTH);
    const tag = decoded.subarray(decoded.length - 16);
    const ciphertext = decoded.subarray(IV_LENGTH, decoded.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', keyBuf, iv);
    decipher.setAuthTag(tag);
    decipher.setAAD(Buffer.from(aad));
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// scope 안전 파싱 (공백/쉼표 구분자, 알 수 없는 scope도 예외 없이 처리)
export function parseScopes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw.split(/[\s,]+/).filter(Boolean);
}

export function stringifyScopes(scopes: string[]): string {
  return scopes.join(' ');
}

// 만료 5분 전부터 갱신 대상으로 간주
export function isTokenExpiringSoon(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() - Date.now() < 5 * 60 * 1000;
}
