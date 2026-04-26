import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { corsResponse, withCors } from '@/src/lib/cors';
import { getAuthenticatedUserId } from '@/src/lib/apiAuth';
import {
  parseAiResponse,
  isRateLimitError,
  RATE_LIMIT_RESPONSE,
} from '@/src/lib/geminiHelpers';

export async function OPTIONS(req: NextRequest) {
  return corsResponse(req);
}

const SYSTEM_INSTRUCTION = `너는 한국어 경조사 가계부 CSV 의 헤더와 샘플 데이터를 분석해서, 각 열을 표준 항목에 자동 매칭하는 도우미야.

표준 항목 (이 키를 그대로 출력해야 함):
- targetName: 사람 이름 (예: "보낸 사람", "수령인", "성명", "이름", "주신분", "고객명")
- amount: 금액 (예: "금액", "축의금", "조의금", "보낸금액", "원")
- date: 날짜 (예: "날짜", "일자", "송금일")
- eventType: 경조사 종류 (예: "구분", "종류", "사유", "행사", "이벤트")  → 값에 결혼/부고/장례/생일 등이 들어있는 열
- location: 장소 (예: "장소", "예식장", "식장", "주소")
- relation: 관계 (예: "관계", "친분", "구분")
- transactionType: 보냄/받음 구분 열 (예: "구분", "수입/지출", "INCOME/EXPENSE", "받음/보냄"). 단일 장부면 -1.

규칙:
1. 각 표준 항목에 대해 가장 적합한 열의 0-based 인덱스를 반환. 없으면 -1.
2. 한 열을 두 항목에 동시 매핑하지 말 것 (transactionType 은 예외 — eventType 과 다른 의미면 분리 가능).
3. 헤더 이름이 모호하면 sampleRows 의 값 패턴으로 판단 (예: 숫자만 → amount, YYYY-MM-DD/2024.5.3 → date).
4. transactionType 가 명확히 INCOME/EXPENSE 단일이면 detectedType 에 'INCOME' 또는 'EXPENSE' 반환. 혼합이거나 불명확하면 null.
5. confidence: high(헤더+샘플 모두 명확) / medium(헤더만 또는 샘플만) / low(추측).

출력 형식 (JSON, 다른 텍스트 금지):
{
  "mapping": {
    "targetName": <int>,
    "amount": <int>,
    "date": <int>,
    "eventType": <int>,
    "location": <int>,
    "relation": <int>,
    "transactionType": <int>
  },
  "detectedType": "INCOME" | "EXPENSE" | null,
  "confidence": "high" | "medium" | "low",
  "reason": "<짧은 한국어 설명, 50자 이내>"
}`;

interface MapBody {
  headers?: { name: string; index: number }[] | string[];
  sampleRows?: unknown[][];
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return withCors(req, NextResponse.json(
        { success: false, reason: 'unauthorized', message: '로그인이 필요합니다.' },
        { status: 401 },
      ));
    }

    const body = (await req.json().catch(() => null)) as MapBody | null;
    const rawHeaders = body?.headers;
    const sampleRows = Array.isArray(body?.sampleRows) ? body!.sampleRows : [];

    if (!Array.isArray(rawHeaders) || rawHeaders.length === 0) {
      return withCors(req, NextResponse.json(
        { success: false, reason: 'invalid_input', message: '헤더가 없습니다.' },
        { status: 400 },
      ));
    }

    const headers = rawHeaders.map((h, i) => {
      if (typeof h === 'string') return { name: h, index: i };
      return { name: String(h?.name ?? ''), index: typeof h?.index === 'number' ? h.index : i };
    });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return withCors(req, NextResponse.json(
        { success: false, reason: 'ai_failed', message: 'API 키가 설정되지 않았습니다.' },
        { status: 500 },
      ));
    }

    const trimmedRows = sampleRows.slice(0, 5).map((row) =>
      Array.isArray(row) ? row.slice(0, headers.length).map((c) => String(c ?? '').slice(0, 80)) : [],
    );

    const prompt = `## 헤더 (인덱스: 이름)
${headers.map((h) => `${h.index}: ${h.name}`).join('\n')}

## 샘플 행 (최대 5개)
${trimmedRows.length > 0 ? trimmedRows.map((r, i) => `[${i + 1}] ${JSON.stringify(r)}`).join('\n') : '(샘플 없음)'}

위 헤더와 샘플을 분석해 표준 항목 매핑을 JSON 으로 반환해.`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { systemInstruction: SYSTEM_INSTRUCTION, responseMimeType: 'application/json' },
    });

    const parsed = parseAiResponse(response.text || '{}') as {
      mapping?: Record<string, number>;
      detectedType?: 'INCOME' | 'EXPENSE' | null;
      confidence?: 'high' | 'medium' | 'low';
      reason?: string;
    };

    const maxIdx = headers.length - 1;
    const sanitize = (v: unknown): number => {
      const n = typeof v === 'number' ? v : parseInt(String(v), 10);
      if (!Number.isFinite(n)) return -1;
      if (n < 0 || n > maxIdx) return -1;
      return n;
    };

    const mapping = {
      targetName: sanitize(parsed.mapping?.targetName),
      amount: sanitize(parsed.mapping?.amount),
      date: sanitize(parsed.mapping?.date),
      eventType: sanitize(parsed.mapping?.eventType),
      location: sanitize(parsed.mapping?.location),
      relation: sanitize(parsed.mapping?.relation),
      transactionType: sanitize(parsed.mapping?.transactionType),
    };

    const detectedType =
      parsed.detectedType === 'INCOME' || parsed.detectedType === 'EXPENSE'
        ? parsed.detectedType
        : null;

    return withCors(req, NextResponse.json({
      success: true,
      mapping,
      detectedType,
      confidence: parsed.confidence ?? 'medium',
      reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 120) : undefined,
    }));
  } catch (e: unknown) {
    console.error('[csv-map] error:', (e as Error)?.message);
    if (isRateLimitError(e)) {
      return withCors(req, NextResponse.json(RATE_LIMIT_RESPONSE, { status: 429 }));
    }
    return withCors(req, NextResponse.json(
      { success: false, reason: 'ai_failed', message: 'AI 매칭에 실패했습니다.' },
      { status: 500 },
    ));
  }
}
