import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { fetchPageHtml } from '@/src/lib/fetchPage';
import { extractMetaTags, extractJsonLd, extractBodyText } from '@/src/lib/parseUrl';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, reason: 'invalid_url', message: 'URL이 필요합니다.' },
        { status: 400 },
      );
    }

    // URL 유효성 검사
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, reason: 'invalid_url', message: '올바른 URL 형식이 아닙니다.' },
        { status: 400 },
      );
    }

    // 1. HTML fetch
    let html: string;
    try {
      html = await fetchPageHtml(url);
    } catch (err: any) {
      const reason = err.message === 'blocked' ? 'blocked' : 'fetch_failed';
      return NextResponse.json(
        { success: false, reason, message: '페이지를 가져올 수 없습니다.' },
        { status: 502 },
      );
    }

    // 2. 데이터 추출
    const meta = extractMetaTags(html);
    const jsonLd = extractJsonLd(html);
    const bodyText = extractBodyText(html);

    // 추출된 데이터가 너무 적은지 확인
    const hasContent = meta.title || meta.description || bodyText.length > 50;

    // 3. source 판정
    const hasOg = !!(meta.title || meta.description);
    const hasBody = bodyText.length > 50;
    const source = hasOg && hasBody ? 'og+body' : hasOg ? 'og-only' : 'body-only';

    // 4. Gemini 분석
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, reason: 'ai_failed', message: 'API 키가 설정되지 않았습니다.' },
        { status: 500 },
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `너는 한국 경조사 초대장 분석 전문가야.
아래 제공되는 웹페이지 데이터에서 경조사 정보를 추출해 JSON으로 반환해.
반드시 제공된 데이터에 있는 정보만 사용하고, 없는 정보는 빈 문자열("")로 반환해.
추측하지 마. 데이터에 명시되지 않은 이름, 날짜, 장소를 만들어내지 마.`;

    const contentParts: string[] = [];

    if (meta.title || meta.description) {
      contentParts.push(`=== 메타태그 ===`);
      if (meta.title) contentParts.push(`제목: ${meta.title}`);
      if (meta.description) contentParts.push(`설명: ${meta.description}`);
      if (meta.siteName) contentParts.push(`사이트: ${meta.siteName}`);
    }

    if (jsonLd) {
      contentParts.push(`\n=== JSON-LD ===`);
      contentParts.push(JSON.stringify(jsonLd, null, 2));
    }

    if (bodyText) {
      contentParts.push(`\n=== 본문 텍스트 ===`);
      contentParts.push(bodyText);
    }

    contentParts.push(`\n위 데이터에서 다음 JSON을 추출해:
{
  "eventType": "wedding|funeral|birthday|other",
  "targetName": "주인공 이름 (결혼식이면 신랑 이름)",
  "date": "YYYY-MM-DD",
  "location": "장소 전체 주소",
  "relation": "",
  "account": "은행명 계좌번호 예금주",
  "type": "EXPENSE"
}`);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contentParts.join('\n'),
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '{}';
      let parsed: any;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        const match = responseText.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : {};
      }

      const data = {
        eventType: parsed.eventType || 'other',
        targetName: parsed.targetName || '',
        date: parsed.date || '',
        location: parsed.location || '',
        relation: parsed.relation || '',
        account: parsed.account || '',
        type: parsed.type || 'EXPENSE',
      };

      // confidence 판정
      const filled = [data.targetName, data.date, data.location]
        .filter(v => v && v.trim() !== '').length;
      const confidence = filled >= 3 ? 'high' : filled >= 2 ? 'medium' : 'low';

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
