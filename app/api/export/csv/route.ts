import { NextRequest, NextResponse } from 'next/server';
import { corsResponse, withCors } from '@/src/lib/cors';
import { getAuthenticatedUserId } from '@/src/lib/apiAuth';
import { setExport, cleanupExpired, EXPORT_TTL_MS } from '@/src/lib/exportCache';

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB

export async function OPTIONS(req: NextRequest) {
  return corsResponse(req);
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return withCors(req, NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  cleanupExpired();

  const body = await req.json().catch(() => null);
  const csv = typeof body?.csv === 'string' ? body.csv : '';
  const fileName = typeof body?.fileName === 'string'
    ? body.fileName.replace(/[\/\\]/g, '_')
    : `export_${Date.now()}.csv`;

  if (!csv) {
    return withCors(req, NextResponse.json({ error: 'empty_csv' }, { status: 400 }));
  }
  if (csv.length > MAX_BODY_BYTES) {
    return withCors(req, NextResponse.json({ error: 'csv_too_large' }, { status: 413 }));
  }

  const token = crypto.randomUUID();
  setExport(token, {
    body: csv,
    fileName,
    // Android MediaStore 가 text/csv 를 좁게 indexing 해 파일 피커·공유에서 안 보이는 문제 회피.
    // application/vnd.ms-excel 은 Excel 스프레드시트로 더 universal 하게 인식되며 CSV 도 정상 오픈됨.
    mimeType: 'application/vnd.ms-excel',
    userId,
    createdAt: Date.now(),
  });

  // 절대 URL — AIT 번들이 system 브라우저에 openURL 로 전달
  const proto = req.headers.get('x-forwarded-proto') || (req.nextUrl.protocol.replace(':', '') || 'https');
  const host = req.headers.get('host') || req.nextUrl.host;
  const url = `${proto}://${host}/api/export/download/${token}`;

  return withCors(req, NextResponse.json({
    success: true,
    url,
    token,
    fileName,
    expiresAt: Date.now() + EXPORT_TTL_MS,
  }));
}
