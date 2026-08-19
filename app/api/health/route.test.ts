import { describe, expect, it } from 'vitest';
import { buildHealthBody } from './route';

describe('/api/health response body', () => {
  const checks = {
    env: { ok: false, detail: 'missing=[JWT_SECRET]' },
    db: { ok: false, detail: 'password authentication failed' },
  };

  it('redacts diagnostic details for public responses', () => {
    const body = buildHealthBody(
      checks,
      ['NEXT_PUBLIC_AD_GROUP_ID_AI_CREDIT'],
      false,
      '2026-05-15T00:00:00.000Z',
    );

    expect(body).toEqual({
      ok: false,
      checks: {
        env: { ok: false },
        db: { ok: false },
      },
      timestamp: '2026-05-15T00:00:00.000Z',
    });
  });

  it('인증서 만료 detail 은 공개 응답에서 가려지되 실패한 check 이름은 남는다', () => {
    // 배포 스모크 테스트가 "무엇이" 깨졌는지는 알 수 있어야 하지만,
    // notAfter·로그 경로 같은 인프라 정보를 공개로 흘리지는 않는다.
    const body = buildHealthBody(
      {
        env: { ok: true },
        db: { ok: true },
        cert: {
          ok: false,
          detail: 'certificate expires in 19d, below 20d threshold (notAfter=...)',
        },
      },
      [],
      false,
      '2026-08-19T00:00:00.000Z',
    ) as { ok: boolean; checks: Record<string, unknown> };

    expect(body.ok).toBe(false);
    expect(body.checks.cert).toEqual({ ok: false });
    expect(JSON.stringify(body)).not.toContain('notAfter');
  });

  it('keeps diagnostic details for authorized internal responses', () => {
    const body = buildHealthBody(
      checks,
      ['NEXT_PUBLIC_AD_GROUP_ID_AI_CREDIT'],
      true,
      '2026-05-15T00:00:00.000Z',
    );

    expect(body).toEqual({
      ok: false,
      checks,
      optionalMissing: ['NEXT_PUBLIC_AD_GROUP_ID_AI_CREDIT'],
      timestamp: '2026-05-15T00:00:00.000Z',
    });
  });
});
