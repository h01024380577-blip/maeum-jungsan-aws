import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { validateEnv, formatValidationFailure, listMissingOptional } from '@/src/lib/env';
import { isCronRequestAuthorized } from '@/src/lib/cronAuth';
import { checkCertExpiry } from '@/src/lib/certExpiry';

type HealthChecks = Record<string, { ok: boolean; detail?: string }>;

/**
 * Health check endpoint — deploy.sh smoke test 와 외부 모니터링용.
 *
 * checks:
 *   - env:  필수 환경변수 검증
 *   - db:   prisma `SELECT 1`
 *   - cert: nginx 가 서빙 중인 TLS 인증서 잔여일 (로컬 :443 이 열려 있을 때만 — 로컬 dev 는 자동 skip)
 *
 * 모두 통과 → 200, 하나라도 실패 → 503.
 * 공개 응답은 ok/check 이름만 노출하고, detail은 내부 인증 요청에만 노출한다.
 */
export function buildHealthBody(
  checks: HealthChecks,
  optionalMissing: string[],
  includeDetails: boolean,
  timestamp = new Date().toISOString(),
): Record<string, unknown> {
  const allOk = Object.values(checks).every((c) => c.ok);

  if (includeDetails) {
    return {
      ok: allOk,
      checks,
      optionalMissing,
      timestamp,
    };
  }

  return {
    ok: allOk,
    checks: Object.fromEntries(
      Object.entries(checks).map(([name, check]) => [name, { ok: check.ok }]),
    ),
    timestamp,
  };
}

export async function GET(req: NextRequest) {
  const checks: HealthChecks = {};

  const envResult = validateEnv();
  checks.env = envResult.ok
    ? { ok: true }
    : { ok: false, detail: formatValidationFailure(envResult) };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = { ok: true };
  } catch (err) {
    checks.db = {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  // TLS 인증서 잔여일 — 만료되면 AIT 번들의 모든 API 호출이 핸드셰이크에서 죽는다.
  // 서버·DB 가 정상이어도 서비스는 전면 중단되므로 별도 check 로 감시한다.
  const cert = await checkCertExpiry();
  checks.cert = { ok: cert.ok, detail: cert.detail };

  const optionalMissing = listMissingOptional();
  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    buildHealthBody(checks, optionalMissing, isCronRequestAuthorized(req)),
    { status: allOk ? 200 : 503 },
  );
}
