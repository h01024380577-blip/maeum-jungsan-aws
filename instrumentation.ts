/**
 * Next.js 서버 시작 훅.
 * pm2 + EC2 환경에 별도 cron 데몬이 없으므로 node-cron으로 in-process 스케줄링.
 * - 매 10분: AdRewardGrant 만료 처리
 * - 매일 09:00 KST: 경조사 리마인드 푸시
 *
 * 중복 실행 방지: register()는 서버 프로세스 당 1회만 호출됨.
 * fork 모드(pm2) 단일 인스턴스에서만 동작.
 */
export async function register() {
  // Edge/Client 런타임에서는 실행하지 않음
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // CSR 빌드 시엔 생략 (AIT 번들은 API 없음)
  if (process.env.NEXT_BUILD_CSR === '1') return;

  const cron = await import('node-cron');
  const baseUrl = `http://localhost:${process.env.PORT || process.env.APP_PORT || 3000}`;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('[scheduler] CRON_SECRET 미설정 — 스케줄러 비활성');
    return;
  }

  const call = async (path: string) => {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      const body = await res.json().catch(() => ({}));
      console.info(`[scheduler] ${path} → ${res.status} ${JSON.stringify(body)}`);
    } catch (err) {
      console.error(`[scheduler] ${path} failed:`, err instanceof Error ? err.message : err);
    }
  };

  // 매 10분: 만료된 광고 보상 nonce 정리
  cron.schedule('*/10 * * * *', () => {
    void call('/api/cron/expire-grants');
  });

  // 매일 KST 09:00 = UTC 00:00 : 경조사 리마인드 발송
  cron.schedule('0 0 * * *', () => {
    void call('/api/cron/event-reminder');
  });

  console.info('[scheduler] registered: expire-grants (*/10), event-reminder (daily 09:00 KST)');
}
