/**
 * 임시 export 파일 캐시 — saveBase64Data 가 동작하지 않는 환경(예: Android Toss 앱)에서
 * "서버 임시 저장 + openURL 다운로드" 우회 경로용.
 *
 * pm2 fork mode 단일 프로세스 가정. 프로세스 재시작 시 데이터 손실되지만 TTL 1h 짧으므로 OK.
 */

export interface CachedExport {
  body: string;        // 파일 본문 (CSV 텍스트). UTF-8 BOM 포함.
  fileName: string;
  mimeType: string;
  userId: string;
  createdAt: number;
}

export const EXPORT_TTL_MS = 60 * 60 * 1000; // 1 hour

const cache = new Map<string, CachedExport>();

export function setExport(token: string, item: CachedExport): void {
  cache.set(token, item);
}

export function getExport(token: string): CachedExport | undefined {
  const item = cache.get(token);
  if (!item) return undefined;
  if (Date.now() - item.createdAt > EXPORT_TTL_MS) {
    cache.delete(token);
    return undefined;
  }
  return item;
}

export function deleteExport(token: string): void {
  cache.delete(token);
}

export function cleanupExpired(): number {
  const now = Date.now();
  let removed = 0;
  for (const [token, item] of cache.entries()) {
    if (now - item.createdAt > EXPORT_TTL_MS) {
      cache.delete(token);
      removed += 1;
    }
  }
  return removed;
}

export function exportCacheSize(): number {
  return cache.size;
}
