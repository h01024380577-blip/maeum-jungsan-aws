import { NextRequest, NextResponse } from 'next/server';
import { getExport, deleteExport } from '@/src/lib/exportCache';

/**
 * GET /api/export/download/[token]
 * - 토큰만으로 인증 (URL UUID 가 credential — 시스템 브라우저에 openURL 로 전달되므로 쿠키/JWT 없음)
 * - Content-Disposition:
 *     - text/calendar + iOS Safari → inline (Safari 가 즉시 native 캘린더 sheet 표시)
 *     - 그 외 → attachment (CSV 다운로드 + Android .ics 다운로드→알림 흐름)
 * - 1회 다운로드 후 캐시에서 제거 (privacy)
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const item = getExport(token);

  if (!item) {
    return new NextResponse('Not found or expired', { status: 404 });
  }

  const encodedName = encodeURIComponent(item.fileName);
  // iOS Safari + text/calendar → inline 으로 즉시 native 캘린더 sheet 발화
  // 그 외 (Android / CSV) → attachment 로 다운로드 강제 (검증된 기존 흐름)
  const ua = req.headers.get('user-agent') ?? '';
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isCalendar = item.mimeType.startsWith('text/calendar');
  const dispositionType = (isCalendar && isIOS) ? 'inline' : 'attachment';
  const headers = new Headers({
    'Content-Type': item.mimeType,
    'Content-Disposition': `${dispositionType}; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
    'Cache-Control': 'no-store',
  });

  // 1회 사용 후 즉시 삭제
  deleteExport(token);

  return new NextResponse(item.body, { status: 200, headers });
}
