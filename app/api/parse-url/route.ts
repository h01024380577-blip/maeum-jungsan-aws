import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { fetchPageHtml } from '@/src/lib/fetchPage';
import { extractMetaTags, extractJsonLd, extractBodyText, hasEnoughData } from '@/src/lib/parseUrl';

const SYSTEM_INSTRUCTION = `너는 한국 경조사 초대장 분석 전문가야.
제공되는 데이터에서 경조사 정보를 추출해 JSON으로 반환해.

핵심 규칙:
1. 반드시 제공된 데이터에 있는 정보만 사용해.
2. 없는 정보는 빈 문자열("")로 반환해.
3. 절대 추측하지 마. 데이터에 명시되지 않은 이름, 날짜, 장소를 만들어내지 마.
4. 결혼식이면 targetName에 신랑 이름만 넣어.
5. 날짜는 반드시 YYYY-MM-DD 형식으로.
6. 계좌번호는 "은행명 계좌번호 예금주" 형식으로.`;

const OUTPUT_SCHEMA = `{
  "eventType": "wedding|funeral|birthday|other",
  "targetName": "주인공 이름 (결혼식이면 신랑 이름)",
  "date": "YYYY-MM-DD",
  "location": "장소명, 전체 주소",
  "relation": "",
  "account": "은행명 계좌번호 예금주",
  "type": "EXPENSE"
}`;

function buildPromptFromExtracted(
  meta: ReturnType<typeof extractMetaTags>,
  jsonLd: object | null,
  bodyText: string,
): string {
  const parts: string[] = [];

  if (meta.title || meta.description) {
    parts.push('=== 메타태그 ===');
    if (meta.title) parts.push(`제목: ${meta.title}`);
    if (meta.description) parts.push(`설명: ${meta.description}`);
    if (meta.siteName) parts.push(`사이트: ${meta.siteName}`);
  }

  if (jsonLd) {
    parts.push('\n=== JSON-LD ===');
    parts.push(JSON.stringify(jsonLd, null, 2));
  }

  if (bodyText) {
    parts.push('\n=== 본문 텍스트 ===');
    parts.push(bodyText);
  }

  parts.push(`\n위 데이터에서 다음 JSON을 추출해:\n${OUTPUT_SCHEMA}`);
  return parts.join('\n');
}

function parseAiResponse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  }
}

function calculateConfidence(data: any): 'high' | 'medium' | 'low' {
  const filled = [data.targetName, data.date, data.location]
    .filter((v: string) => v && v.trim() !== '').length;
  if (filled >= 3) return 'high';
  if (filled >= 2) return 'medium';
  return 'low';
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, reason: 'invalid_url', message: 'URL이 필요합니다.' },
        { status: 400 },
      );
    }

    try { new URL(url); } catch {
      return NextResponse.json(
        { success: false, reason: 'invalid_url', message: '올바른 URL 형식이 아닙니다.' },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, reason: 'ai_failed', message: 'API 키가 설정되지 않았습니다.' },
        { status: 500 },
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // ========== Phase 1: 서버사이드 HTML 파싱 시도 ==========
    let html = '';
    let fetchSuccess = false;
    try {
      html = await fetchPageHtml(url);
      fetchSuccess = true;
    } catch {}

    let source: 'og+body' | 'og-only' | 'body-only' | 'url-context' = 'url-context';

    if (fetchSuccess) {
      const meta = extractMetaTags(html);
      const jsonLd = extractJsonLd(html);
      const bodyText = extractBodyText(html);

      if (hasEnoughData(meta, bodyText)) {
        // 충분한 데이터 → 추출 텍스트 기반 분석
        const hasOg = !!(meta.title || meta.description);
        const hasBody = bodyText.length > 50;
        source = hasOg && hasBody ? 'og+body' : hasOg ? 'og-only' : 'body-only';

        try {
          const prompt = buildPromptFromExtracted(meta, jsonLd, bodyText);
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { systemInstruction: SYSTEM_INSTRUCTION, responseMimeType: 'application/json' },
          });

          const parsed = parseAiResponse(response.text || '{}');
          const data = {
            eventType: parsed.eventType || 'other',
            targetName: parsed.targetName || '',
            date: parsed.date || '',
            location: parsed.location || '',
            relation: parsed.relation || '',
            account: parsed.account || '',
            type: parsed.type || 'EXPENSE',
          };
          const confidence = calculateConfidence(data);

          if (confidence !== 'low') {
            return NextResponse.json({ success: true, data, confidence, source });
          }
          // confidence가 low면 Phase 2로 진행
        } catch {}
      }
    }

    // ========== Phase 2: Gemini URL 직접 접근 (SPA/동적 사이트 대응) ==========
    // Gemini에 URL을 제공하고 urlContext 도구로 실제 페이지 내용을 읽게 함
    try {
      const urlContextPrompt = `다음 URL은 한국 경조사(결혼식/부고/생일) 초대장 링크야.
이 URL의 실제 페이지 내용을 읽고 경조사 정보를 추출해줘.

URL: ${url}

반드시 페이지에서 읽은 실제 데이터만 사용해.
페이지를 읽을 수 없거나 정보가 없으면 모든 필드를 빈 문자열("")로 반환해.
절대 추측하거나 만들어내지 마.

다음 JSON 형식으로 반환해:
${OUTPUT_SCHEMA}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: urlContextPrompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          tools: [{ urlContext: {} }],
        },
      });

      const parsed = parseAiResponse(response.text || '{}');
      const data = {
        eventType: parsed.eventType || 'other',
        targetName: parsed.targetName || '',
        date: parsed.date || '',
        location: parsed.location || '',
        relation: parsed.relation || '',
        account: parsed.account || '',
        type: parsed.type || 'EXPENSE',
      };
      const confidence = calculateConfidence(data);
      source = 'url-context';

      return NextResponse.json({ success: true, data, confidence, source });
    } catch (err) {
      return NextResponse.json(
        { success: false, reason: 'ai_failed', message: 'AI 분석에 실패했습니다.' },
        { status: 500 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { success: false, reason: 'parse_failed', message: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
