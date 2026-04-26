import { NextRequest, NextResponse } from 'next/server';
import { getExport, deleteExport } from '@/src/lib/exportCache';

/**
 * GET /api/export/download/[token]
 * - 토큰만으로 인증 (URL 자체가 unguessable UUID — 시스템 브라우저에 openURL 로 전달되므로 쿠키/JWT 없음)
 * - Content-Disposition: attachment 로 다운로드 강제
 * - 1회 다운로드 후 캐시에서 제거 (privacy)
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const item = getExport(token);

  if (!item) {
    return new NextResponse('Not found or expired', { status: 404 });
  }

  // 한글 파일명을 RFC 5987 encoded 로 — Content-Disposition 호환
  const encodedName = encodeURIComponent(item.fileName);
  const headers = new Headers({
    'Content-Type': item.mimeType,
    'Content-Disposition': `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
    'Cache-Control': 'no-store',
  });

  // 1회 사용 후 즉시 삭제
  deleteExport(token);

  return new NextResponse(item.body, { status: 200, headers });
}
