/**
 * TLS 인증서 만료 감시 — `/api/health` 에서 사용.
 *
 * 배경 (2026-08 로그인 전면 장애):
 * certbot 자동 갱신이 cron PATH 문제로 2026-07-17 부터 30일간 실패했는데,
 * 갱신 스크립트의 `-q` 플래그와 EC2 에 MTA 가 없다는 조합 때문에 아무도 몰랐다.
 * 08-16 에 인증서가 만료되자 AIT 번들의 모든 API 호출이 TLS 핸드셰이크에서 죽었고
 * 사용자는 로그인조차 할 수 없었다. 서버·DB 는 멀쩡했으므로 health 는 그 30일 내내
 * 200 을 반환했다 — 즉 기존 health 로는 이 장애를 조기에 잡을 수 없었다.
 *
 * 이 모듈은 nginx 가 **실제로 서빙 중인** 인증서를 TLS 핸드셰이크로 읽어,
 * 잔여일이 임계값 밑으로 떨어지면 health 를 503 으로 만든다.
 * `scripts/deploy.sh` 의 스모크 테스트가 매 배포마다 이를 확인하므로
 * 별도 알림 인프라 없이 조기 경보가 붙는다.
 *
 * 파일이 아니라 TLS 연결로 확인하는 이유:
 * `/etc/letsencrypt/live/*` 는 root 전용(0700)이라 앱 프로세스(ec2-user)가 읽을 수 없다.
 * 게다가 디스크의 파일보다 "지금 nginx 가 내보내는 인증서"가 검증 대상으로 더 정확하다
 * (갱신은 됐는데 reload 가 안 된 경우까지 잡힌다).
 *
 * 환경변수로 운영/로컬을 구분하지 않는 이유:
 * `NODE_ENV` 와 `NEXT_PUBLIC_API_URL` 은 Next.js 가 in-process 로 주입해서
 * 프로세스 바깥(`/proc/<pid>/environ`)에서 검증할 수 없다. 검증 못 하는 값에 게이트를
 * 걸면 "조용히 스킵되는" 이번 장애의 실패 모드가 그대로 재현된다.
 * 대신 **로컬 :443 에 TLS 종단이 존재하는지 자체**를 신호로 쓴다 —
 * 이 앱은 nginx 뒤에서만 TLS 를 종단하므로 :443 이 열려 있다는 것이 곧 운영 호스트라는 뜻이다.
 */

export const DEFAULT_CERT_MIN_DAYS = 20;

const MS_PER_DAY = 86_400_000;
const CONNECT_TIMEOUT_MS = 3_000;
const LOCAL_TLS_HOST = '127.0.0.1';
const LOCAL_TLS_PORT = 443;

/** ":443 에 아무도 없다" = 운영 호스트가 아니다 로 해석할 에러 코드 */
const NOT_LISTENING_CODES = new Set([
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EADDRNOTAVAIL',
]);

type Env = Record<string, string | undefined>;

export type CertExpiryStatus = {
  ok: boolean;
  detail: string;
  daysRemaining?: number;
};

export type CertProbeResult =
  | { status: 'ok'; validTo: Date }
  | { status: 'absent' }
  | { status: 'error'; message: string };

/**
 * 만료일만으로 판정하는 순수 함수 (TLS I/O 없음).
 *
 * certbot 은 만료 30일 전부터 12시간마다 갱신을 시도한다. 따라서 잔여일이
 * 임계값(기본 20일)까지 내려왔다는 것은 갱신이 최소 10일간 실패해왔다는 뜻이고,
 * 아직 20일의 대응 여유가 남은 시점이다.
 */
export function evaluateCertExpiry(
  validTo: Date | null,
  now: Date,
  minDays: number,
): CertExpiryStatus {
  if (!validTo || Number.isNaN(validTo.getTime())) {
    return { ok: false, detail: 'served certificate expiry could not be read' };
  }

  const daysRemaining = Math.floor((validTo.getTime() - now.getTime()) / MS_PER_DAY);
  const notAfter = validTo.toISOString();

  if (daysRemaining < 0) {
    return {
      ok: false,
      daysRemaining,
      detail: `certificate expired ${Math.abs(daysRemaining)}d ago (notAfter=${notAfter})`,
    };
  }

  if (daysRemaining < minDays) {
    return {
      ok: false,
      daysRemaining,
      detail:
        `certificate expires in ${daysRemaining}d, below ${minDays}d threshold (notAfter=${notAfter}) — ` +
        'renewal has been failing; check /var/log/letsencrypt/letsencrypt.log',
    };
  }

  return {
    ok: true,
    daysRemaining,
    detail: `expires in ${daysRemaining}d (notAfter=${notAfter})`,
  };
}

/** probe 결과 → health check 판정 (순수 함수) */
export function evaluateProbe(
  probe: CertProbeResult,
  now: Date,
  minDays: number,
): CertExpiryStatus {
  if (probe.status === 'absent') {
    return { ok: true, detail: 'skipped (no local TLS endpoint on :443)' };
  }

  if (probe.status === 'error') {
    // :443 은 열려 있는데 핸드셰이크가 안 된다면 그 자체로 서비스 장애다.
    return { ok: false, detail: `TLS probe failed: ${probe.message}` };
  }

  return evaluateCertExpiry(probe.validTo, now, minDays);
}

/** `HEALTH_CERT_MIN_DAYS` 파싱. 0 은 "체크 비활성" 이라는 의도된 값이다. */
export function resolveMinDays(env: Env = process.env): number {
  const raw = env.HEALTH_CERT_MIN_DAYS;
  if (raw === undefined || raw.trim() === '') return DEFAULT_CERT_MIN_DAYS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_CERT_MIN_DAYS;
  return Math.floor(parsed);
}

/**
 * SNI 로 쓸 호스트. 없어도 동작하며(단일 인증서 구성), 있으면 더 정확하다.
 * 필수가 아니므로 여기서 실패시키지 않는다.
 */
export function resolveCertHost(env: Env = process.env): string | null {
  const raw = env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    return url.hostname || null;
  } catch {
    return null;
  }
}

/**
 * 로컬 nginx 에 TLS 핸드셰이크만 걸어 서빙 중인 인증서의 notAfter 를 읽는다.
 * DNS·외부 경로에 의존하지 않도록 127.0.0.1 로 붙는다.
 */
export async function probeServedCert(servername?: string): Promise<CertProbeResult> {
  // node:tls 를 정적 import 하면 CSR(AIT) 번들에 끌려들어갈 수 있어 동적 import 한다.
  const tls = await import('node:tls');

  return new Promise<CertProbeResult>((resolve) => {
    const socket = tls.connect({
      host: LOCAL_TLS_HOST,
      port: LOCAL_TLS_PORT,
      ...(servername ? { servername } : {}),
      // 만료된 인증서도 "읽어서 만료됐다고 보고"해야 하므로 검증하지 않는다.
      // 검증을 켜면 정작 잡아야 할 상황에서 연결이 끊겨 원인을 알 수 없게 된다.
      rejectUnauthorized: false,
      timeout: CONNECT_TIMEOUT_MS,
    });

    let settled = false;
    const done = (result: CertProbeResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate();
      if (!cert || !cert.valid_to) {
        return done({ status: 'error', message: 'peer certificate unavailable' });
      }
      const validTo = new Date(cert.valid_to);
      done(
        Number.isNaN(validTo.getTime())
          ? { status: 'error', message: `unparseable valid_to: ${cert.valid_to}` }
          : { status: 'ok', validTo },
      );
    });

    socket.once('timeout', () => done({ status: 'error', message: 'connection timed out' }));

    socket.once('error', (err: NodeJS.ErrnoException) => {
      done(
        err.code && NOT_LISTENING_CODES.has(err.code)
          ? { status: 'absent' }
          : { status: 'error', message: err.message },
      );
    });
  });
}

/** health 라우트가 호출하는 진입점. */
export async function checkCertExpiry(
  env: Env = process.env,
  now: Date = new Date(),
): Promise<CertExpiryStatus> {
  const minDays = resolveMinDays(env);
  if (minDays === 0) {
    return { ok: true, detail: 'skipped (HEALTH_CERT_MIN_DAYS=0)' };
  }

  const probe = await probeServedCert(resolveCertHost(env) ?? undefined);
  return evaluateProbe(probe, now, minDays);
}
