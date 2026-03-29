import { describe, it, expect } from 'vitest';
import { extractMetaTags, extractJsonLd, extractBodyText } from './parseUrl';

// ===== Mock HTML: 모바일 청첩장 =====
const WEDDING_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>김진호 ♥ 이수연 결혼합니다</title>
  <meta property="og:title" content="김진호 ♥ 이수연 결혼식에 초대합니다" />
  <meta property="og:description" content="2026년 3월 15일 오후 2시, 서울 강남구 역삼동 그랜드볼룸" />
  <meta property="og:image" content="https://example.com/wedding.jpg" />
  <meta property="og:site_name" content="모바일청첩장" />
  <meta name="description" content="김진호 이수연 결혼식 초대장" />
  <script type="application/ld+json">
  {
    "name": "김진호 ♥ 이수연 결혼식",
    "startDate": "2026-03-15T14:00:00+09:00",
    "location": { "name": "그랜드볼룸", "address": "서울 강남구 역삼동 123" }
  }
  </script>
</head>
<body>
  <nav>메뉴바</nav>
  <div class="content">
    <h1>결혼합니다</h1>
    <p>김진호 ♥ 이수연</p>
    <p>2026년 3월 15일 토요일 오후 2시</p>
    <p>서울 강남구 역삼동 그랜드볼룸 3층</p>
    <p>축의금 계좌: 신한은행 110-123-456789 김진호</p>
  </div>
  <script>console.log("tracking");</script>
  <style>.hidden { display: none; }</style>
  <footer>Copyright 2026</footer>
</body>
</html>`;

// ===== Mock HTML: 부고장 =====
const FUNERAL_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="故 박영수님 부고" />
  <meta property="og:description" content="2026년 4월 1일, 서울대학교병원 장례식장" />
</head>
<body>
  <div>
    <p>故 박영수님의 별세를 알려드립니다.</p>
    <p>발인: 2026년 4월 3일</p>
    <p>빈소: 서울대학교병원 장례식장 5호실</p>
    <p>부의금 계좌: 국민은행 999-21-0000000 박민수(장남)</p>
  </div>
</body>
</html>`;

// ===== Mock HTML: 메타태그 없는 경우 =====
const MINIMAL_HTML = `
<!DOCTYPE html>
<html>
<head><title>초대장</title></head>
<body><p>내용이 거의 없는 페이지</p></body>
</html>`;

// ========================================
// Task 1: extractMetaTags
// ========================================
describe('extractMetaTags', () => {
  it('청첩장 HTML에서 og 메타태그를 추출한다', () => {
    const meta = extractMetaTags(WEDDING_HTML);
    expect(meta.title).toBe('김진호 ♥ 이수연 결혼식에 초대합니다');
    expect(meta.description).toBe('2026년 3월 15일 오후 2시, 서울 강남구 역삼동 그랜드볼룸');
    expect(meta.image).toBe('https://example.com/wedding.jpg');
    expect(meta.siteName).toBe('모바일청첩장');
  });

  it('부고장 HTML에서 og 메타태그를 추출한다', () => {
    const meta = extractMetaTags(FUNERAL_HTML);
    expect(meta.title).toBe('故 박영수님 부고');
    expect(meta.description).toBe('2026년 4월 1일, 서울대학교병원 장례식장');
  });

  it('og 태그가 없으면 <title> 태그를 fallback으로 사용한다', () => {
    const meta = extractMetaTags(MINIMAL_HTML);
    expect(meta.title).toBe('초대장');
    expect(meta.description).toBe('');
    expect(meta.image).toBe('');
    expect(meta.siteName).toBe('');
  });
});

// ========================================
// Task 2: extractJsonLd
// ========================================
describe('extractJsonLd', () => {
  it('JSON-LD 데이터를 파싱하여 객체로 반환한다', () => {
    const jsonLd = extractJsonLd(WEDDING_HTML);
    expect(jsonLd).not.toBeNull();
    expect((jsonLd as any).name).toBe('김진호 ♥ 이수연 결혼식');
    expect((jsonLd as any).startDate).toBe('2026-03-15T14:00:00+09:00');
    expect((jsonLd as any).location.name).toBe('그랜드볼룸');
  });

  it('JSON-LD가 없으면 null을 반환한다', () => {
    const jsonLd = extractJsonLd(MINIMAL_HTML);
    expect(jsonLd).toBeNull();
  });

  it('잘못된 JSON-LD는 null을 반환한다', () => {
    const badHtml = `<html><head><script type="application/ld+json">{ broken json }</script></head><body></body></html>`;
    const jsonLd = extractJsonLd(badHtml);
    expect(jsonLd).toBeNull();
  });
});

// ========================================
// Task 3: extractBodyText
// ========================================
describe('extractBodyText', () => {
  it('script, style, nav, footer를 제거하고 본문 텍스트를 추출한다', () => {
    const text = extractBodyText(WEDDING_HTML);
    expect(text).toContain('결혼합니다');
    expect(text).toContain('김진호');
    expect(text).toContain('신한은행 110-123-456789');
    expect(text).not.toContain('console.log');
    expect(text).not.toContain('.hidden');
    expect(text).not.toContain('메뉴바');
    expect(text).not.toContain('Copyright');
  });

  it('부고장 본문에서 핵심 정보를 추출한다', () => {
    const text = extractBodyText(FUNERAL_HTML);
    expect(text).toContain('박영수');
    expect(text).toContain('서울대학교병원');
    expect(text).toContain('국민은행');
  });

  it('본문 텍스트를 3000자로 제한한다', () => {
    const longBody = '<html><body>' + '<p>가</p>'.repeat(2000) + '</body></html>';
    const text = extractBodyText(longBody);
    expect(text.length).toBeLessThanOrEqual(3000);
  });
});

// ========================================
// Task 4: hasEnoughData - 추출 데이터 충분성 판단
// ========================================
import { hasEnoughData } from './parseUrl';

// SPA 빈 HTML (theirmood.com 같은 케이스)
const SPA_EMPTY_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>theirmood</title>
  <script defer src="/assets/index.js"></script>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;

describe('hasEnoughData', () => {
  it('og 태그와 본문이 충분하면 true', () => {
    const meta = { title: '김진호 결혼식', description: '2026년 3월 15일', image: '', siteName: '' };
    const bodyText = '결혼합니다 김진호 이수연 서울 강남구 역삼동 그랜드볼룸';
    expect(hasEnoughData(meta, bodyText)).toBe(true);
  });

  it('SPA 빈 HTML에서 추출한 데이터는 false', () => {
    const meta = { title: 'theirmood', description: '', image: '', siteName: '' };
    const bodyText = '';
    expect(hasEnoughData(meta, bodyText)).toBe(false);
  });

  it('og 태그만 있고 본문이 없어도 og에 핵심 정보가 있으면 true', () => {
    const meta = { title: '故 박영수님 부고', description: '2026년 4월 1일, 서울대학교병원', image: '', siteName: '' };
    const bodyText = '';
    expect(hasEnoughData(meta, bodyText)).toBe(true);
  });

  it('title만 있고 의미 없는 사이트명이면 false', () => {
    const meta = { title: 'Loading...', description: '', image: '', siteName: '' };
    const bodyText = '';
    expect(hasEnoughData(meta, bodyText)).toBe(false);
  });
});
