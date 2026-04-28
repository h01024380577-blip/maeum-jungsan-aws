import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getAuthenticatedUserId } from '@/src/lib/apiAuth';
import { corsResponse, withCors } from '@/src/lib/cors';
import { setExport, cleanupExpired, EXPORT_TTL_MS } from '@/src/lib/exportCache';
import { renderIcs, EventLike, EVENT_TYPE_KO } from '@/src/lib/ics';

function todayStamp(): string {
  const d = new Date();
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function sanitizeFilename(s: string): string {
  return s.replace(/[\/\\?%*:|"<>]/g, '_').slice(0, 80);
}

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
  const scope = body?.scope === 'single' || body?.scope === 'all' ? body.scope : null;
  if (!scope) {
    return withCors(req, NextResponse.json({ error: 'invalid_scope' }, { status: 400 }));
  }

  let events: EventLike[] = [];
  let fileName: string;

  if (scope === 'single') {
    const eventId = typeof body?.eventId === 'string' ? body.eventId : null;
    if (!eventId) {
      return withCors(req, NextResponse.json({ error: 'missing_event_id' }, { status: 400 }));
    }
    const e = await prisma.event.findUnique({ where: { id: eventId } });
    if (!e || e.userId !== userId) {
      return withCors(req, NextResponse.json({ error: 'not_found' }, { status: 404 }));
    }
    events = [{
      id: e.id,
      eventType: e.eventType,
      targetName: e.targetName,
      date: e.date,
      location: e.location,
      relation: e.relation,
      memo: e.memo,
      sourceUrl: e.sourceUrl,
    }];
    const label = EVENT_TYPE_KO[e.eventType] ?? '경조사';
    fileName = sanitizeFilename(`${label}_${e.targetName}_${todayStamp()}.ics`);
  } else {
    const list = await prisma.event.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });
    if (list.length === 0) {
      return withCors(req, NextResponse.json({ error: 'no_events' }, { status: 400 }));
    }
    events = list.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      targetName: e.targetName,
      date: e.date,
      location: e.location,
      relation: e.relation,
      memo: e.memo,
      sourceUrl: e.sourceUrl,
    }));
    fileName = sanitizeFilename(`마음정산_경조사_${todayStamp()}.ics`);
  }

  const ics = renderIcs(events);
  const token = crypto.randomUUID();
  setExport(token, {
    body: ics,
    fileName,
    mimeType: 'text/calendar; charset=utf-8',
    userId,
    createdAt: Date.now(),
  });

  const proto = req.headers.get('x-forwarded-proto') || (req.nextUrl.protocol.replace(':', '') || 'https');
  const host = req.headers.get('host') || req.nextUrl.host;
  const url = `${proto}://${host}/api/export/download/${token}`;

  return withCors(req, NextResponse.json({
    success: true,
    url,
    token,
    fileName,
    expiresAt: Date.now() + EXPORT_TTL_MS,
    eventCount: events.length,
  }));
}
