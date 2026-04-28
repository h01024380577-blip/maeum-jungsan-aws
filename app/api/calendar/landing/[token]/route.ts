import { NextRequest, NextResponse } from 'next/server';
import { getExport } from '@/src/lib/exportCache';

/**
 * GET /api/calendar/landing/[token]
 * - Android 시스템 브라우저(Chrome) 가 처음 도착하는 안내 페이지
 * - 다운로드 후 캘린더 앱으로 import 하는 단계별 가이드 + 명시적 다운로드 버튼
 * - 토큰 자체는 여기서 소비하지 않음 (사용자가 다운로드 버튼 탭할 때 /api/export/download 가 1회 사용)
 * - iOS 는 이 라우트 거치지 않고 /api/export/download 직접 (Safari 가 즉시 캘린더 sheet)
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const item = getExport(token);

  if (!item) {
    return new NextResponse(htmlExpired(), {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  return new NextResponse(htmlLanding(token, item.fileName), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function htmlLanding(token: string, fileName: string): string {
  const downloadUrl = `/api/export/download/${token}`;
  const safeName = escapeHtml(fileName);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>마음정산 캘린더 가져오기</title>
  <style>
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    html,body{margin:0;padding:0;background:#f8fafc;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Pretendard','Noto Sans KR','Malgun Gothic',sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased}
    body{padding:20px 16px 40px;min-height:100vh}
    .card{max-width:430px;margin:0 auto;background:#fff;border-radius:24px;padding:24px;box-shadow:0 4px 20px rgba(0,0,0,0.04)}
    .badge{display:inline-flex;align-items:center;gap:6px;background:#dbeafe;color:#1e40af;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:700;margin-bottom:12px}
    h1{margin:0 0 6px;font-size:20px;font-weight:900;letter-spacing:-0.3px}
    .sub{margin:0 0 18px;font-size:13px;color:#64748b}
    .file{display:flex;align-items:center;gap:10px;background:#f1f5f9;border-radius:12px;padding:12px 14px;margin-bottom:20px;font-size:13px;color:#475569;font-weight:600;word-break:break-all}
    .file-icon{font-size:18px;flex-shrink:0}
    .steps{list-style:none;padding:0;margin:0 0 20px;counter-reset:step}
    .steps li{counter-increment:step;position:relative;padding-left:38px;margin-bottom:14px;font-size:14px;color:#334155}
    .steps li:last-child{margin-bottom:0}
    .steps li::before{content:counter(step);position:absolute;left:0;top:-1px;width:26px;height:26px;border-radius:50%;background:#3b82f6;color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center}
    strong{color:#0f172a;font-weight:800}
    .btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:16px;background:#3b82f6;color:#fff;text-align:center;text-decoration:none;border-radius:14px;font-weight:800;font-size:15px;border:none;cursor:pointer;transition:background 0.15s}
    .btn:active{background:#2563eb}
    .galaxy-tip{background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:14px;font-size:13px;color:#1e3a8a;margin:0 0 16px;line-height:1.55}
    .galaxy-tip-title{font-weight:800;margin-bottom:4px;display:flex;align-items:center;gap:6px}
    details{font-size:13px;color:#64748b;margin-top:14px;border-top:1px solid #e2e8f0;padding-top:14px}
    summary{cursor:pointer;padding:8px 0;font-weight:700;color:#475569;list-style:none;display:flex;align-items:center;gap:6px}
    summary::-webkit-details-marker{display:none}
    summary::before{content:'›';display:inline-block;transition:transform 0.15s;font-size:18px;line-height:1}
    details[open] summary::before{transform:rotate(90deg)}
    details p{margin:8px 0 0;padding:14px;background:#f8fafc;border-radius:10px;font-size:13px;color:#475569;line-height:1.6}
    .download-hint{margin-top:14px;font-size:12px;color:#94a3b8;text-align:center}
  </style>
</head>
<body>
  <main class="card">
    <span class="badge">📅 캘린더 가져오기</span>
    <h1>일정을 캘린더 앱에 추가하세요</h1>
    <p class="sub">아래 안내에 따라 진행해주세요</p>

    <div class="file"><span class="file-icon">📄</span><span>${safeName}</span></div>

    <ol class="steps">
      <li>아래 <strong>"캘린더 파일 받기"</strong> 버튼을 탭하세요</li>
      <li>화면 상단의 <strong>다운로드 알림</strong>을 탭하세요</li>
      <li><strong>Samsung 캘린더</strong> 또는 <strong>Google 캘린더</strong> 등 캘린더 앱을 선택하세요</li>
      <li>"가져오기" 또는 "추가" 버튼을 탭하면 일정이 등록돼요</li>
    </ol>

    <div class="galaxy-tip">
      <div class="galaxy-tip-title">💡 Galaxy 사용자께</div>
      알림에서 <strong>"Samsung 캘린더"</strong>를 고른 뒤 <strong>"항상"</strong>을 선택하면, 다음부터는 자동으로 Samsung 캘린더에서 열려요.
    </div>

    <a href="${downloadUrl}" class="btn" id="dl">캘린더 파일 받기</a>
    <p class="download-hint">파일은 1시간 동안만 받을 수 있어요</p>

    <details>
      <summary>다운로드 후 캘린더가 안 열리면?</summary>
      <p>"내 파일" 또는 "Files" 앱 → "다운로드" 폴더 → 받은 .ics 파일을 탭하세요. 캘린더 앱 선택 화면이 나옵니다.</p>
    </details>
  </main>
</body>
</html>`;
}

function htmlExpired(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>다운로드 만료</title>
  <style>
    body{margin:0;padding:60px 24px;background:#f8fafc;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Pretendard','Noto Sans KR','Malgun Gothic',sans-serif;text-align:center;min-height:100vh}
    .icon{font-size:48px;margin-bottom:12px}
    h1{margin:0 0 8px;font-size:20px;font-weight:900}
    p{margin:0;font-size:14px;color:#64748b;line-height:1.6}
  </style>
</head>
<body>
  <div class="icon">⏱️</div>
  <h1>다운로드 링크가 만료됐어요</h1>
  <p>마음정산 앱에서 다시 시도해주세요</p>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return s.replace(/[&<>"']/g, (c) => map[c] ?? c);
}
