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
