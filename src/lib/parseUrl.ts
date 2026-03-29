import * as cheerio from 'cheerio';

export interface PageMeta {
  title: string;
  description: string;
  image: string;
  siteName: string;
}

export interface ExtractedPageData {
  url: string;
  meta: PageMeta;
  jsonLd: object | null;
  bodyText: string;
}

/**
 * Task 1: HTML에서 og 메타태그 추출
 */
export function extractMetaTags(html: string): PageMeta {
  const $ = cheerio.load(html);

  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  const ogDesc = $('meta[property="og:description"]').attr('content') || '';
  const ogImage = $('meta[property="og:image"]').attr('content') || '';
  const ogSiteName = $('meta[property="og:site_name"]').attr('content') || '';

  return {
    title: ogTitle || $('title').text().trim() || '',
    description: ogDesc || $('meta[name="description"]').attr('content') || '',
    image: ogImage,
    siteName: ogSiteName,
  };
}

/**
 * Task 2: JSON-LD 추출
 */
export function extractJsonLd(html: string): object | null {
  const $ = cheerio.load(html);
  const script = $('script[type="application/ld+json"]').first().html();
  if (!script) return null;

  try {
    return JSON.parse(script);
  } catch {
    return null;
  }
}

/**
 * Task 4: 추출 데이터가 Gemini 분석에 충분한지 판단
 * - og 태그에 경조사 키워드가 포함되어 있거나
 * - 본문 텍스트가 50자 이상이면 충분하다고 판단
 */
const MEANINGLESS_TITLES = ['loading', 'theirmood', 'redirect', '모바일청첩장', ''];
const EVENT_KEYWORDS = ['결혼', '부고', '장례', '돌잔치', '생일', '초대', '축하', '故', '별세', '발인'];

export function hasEnoughData(meta: PageMeta, bodyText: string): boolean {
  // 본문이 충분하면 OK
  if (bodyText.trim().length > 50) return true;

  // og 태그에 의미 있는 내용이 있는지 확인
  const titleLower = (meta.title || '').toLowerCase().trim();
  if (MEANINGLESS_TITLES.some(t => titleLower === t || titleLower.includes('loading'))) {
    return false;
  }

  // og title이나 description에 경조사 키워드가 있으면 충분
  const combined = `${meta.title} ${meta.description}`;
  if (EVENT_KEYWORDS.some(kw => combined.includes(kw))) return true;

  // description이 20자 이상이면 충분
  if ((meta.description || '').trim().length > 20) return true;

  return false;
}

/**
 * Task 3: 본문 텍스트 추출 (script/style/nav/footer 제거, 3000자 제한)
 */
export function extractBodyText(html: string): string {
  const $ = cheerio.load(html);

  $('script, style, nav, footer, header, noscript, iframe').remove();

  const text = $('body')
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  return text.slice(0, 3000);
}
