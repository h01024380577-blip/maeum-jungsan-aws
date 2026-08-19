import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CERT_MIN_DAYS,
  evaluateCertExpiry,
  evaluateProbe,
  resolveCertHost,
  resolveMinDays,
} from './certExpiry';

const NOW = new Date('2026-08-19T06:00:00.000Z');

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * 86_400_000);
}

describe('evaluateCertExpiry', () => {
  it('여유가 충분한 인증서는 통과', () => {
    const result = evaluateCertExpiry(daysFromNow(89), NOW, 20);
    expect(result.ok).toBe(true);
    expect(result.daysRemaining).toBe(89);
  });

  it('임계값 경계(정확히 minDays)는 통과', () => {
    expect(evaluateCertExpiry(daysFromNow(20), NOW, 20).ok).toBe(true);
  });

  it('임계값 미만이면 실패 — 갱신 자동화가 멈춘 상태', () => {
    // certbot 은 만료 30일 전부터 12시간마다 갱신을 시도한다.
    // 20일 미만까지 내려왔다는 건 최소 10일간 갱신이 실패해왔다는 뜻.
    const result = evaluateCertExpiry(daysFromNow(19), NOW, 20);
    expect(result.ok).toBe(false);
    expect(result.daysRemaining).toBe(19);
    expect(result.detail).toContain('19');
  });

  it('이미 만료된 인증서는 음수 잔여일과 함께 실패', () => {
    const result = evaluateCertExpiry(daysFromNow(-3), NOW, 20);
    expect(result.ok).toBe(false);
    expect(result.daysRemaining).toBe(-3);
    expect(result.detail).toMatch(/expired/i);
  });

  it('만료일을 읽지 못하면 실패', () => {
    const result = evaluateCertExpiry(null, NOW, 20);
    expect(result.ok).toBe(false);
    expect(result.daysRemaining).toBeUndefined();
  });

  it('잔여일은 내림 처리 — 20.9일 남았으면 20일로 본다', () => {
    const result = evaluateCertExpiry(
      new Date(NOW.getTime() + 20.9 * 86_400_000),
      NOW,
      20,
    );
    expect(result.daysRemaining).toBe(20);
    expect(result.ok).toBe(true);
  });
});

describe('evaluateProbe', () => {
  it('인증서를 읽었으면 잔여일로 판정', () => {
    const result = evaluateProbe(
      { status: 'ok', validTo: daysFromNow(89) },
      NOW,
      20,
    );
    expect(result.ok).toBe(true);
    expect(result.daysRemaining).toBe(89);
  });

  it('로컬 :443 에 TLS 종단이 없으면 스킵 — 로컬 dev 환경', () => {
    // 이 앱은 nginx 뒤에서만 TLS 를 종단한다. :443 이 닫혀 있다는 건
    // 운영 호스트가 아니라는 뜻이므로 health 를 깨뜨리지 않는다.
    const result = evaluateProbe({ status: 'absent' }, NOW, 20);
    expect(result.ok).toBe(true);
    expect(result.detail).toMatch(/skip/i);
    expect(result.daysRemaining).toBeUndefined();
  });

  it('listen 중인데 핸드셰이크가 실패하면 진짜 문제이므로 실패 처리', () => {
    const result = evaluateProbe(
      { status: 'error', message: 'handshake timeout' },
      NOW,
      20,
    );
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('handshake timeout');
  });

  it('임계값 0 이어도 evaluateProbe 자체는 판정만 한다', () => {
    // 비활성 처리는 checkCertExpiry 의 책임 — 여기서는 경계만 확인.
    expect(evaluateProbe({ status: 'ok', validTo: daysFromNow(1) }, NOW, 0).ok).toBe(
      true,
    );
  });
});

describe('resolveMinDays', () => {
  it('미설정 시 기본 임계값', () => {
    expect(resolveMinDays({})).toBe(DEFAULT_CERT_MIN_DAYS);
  });

  it('환경변수로 임계값 조정', () => {
    expect(resolveMinDays({ HEALTH_CERT_MIN_DAYS: '35' })).toBe(35);
  });

  it('0 이면 체크 비활성 — 장애 중 긴급 배포를 막지 않기 위한 탈출구', () => {
    expect(resolveMinDays({ HEALTH_CERT_MIN_DAYS: '0' })).toBe(0);
  });

  it('숫자가 아니면 기본값으로 폴백', () => {
    expect(resolveMinDays({ HEALTH_CERT_MIN_DAYS: 'abc' })).toBe(
      DEFAULT_CERT_MIN_DAYS,
    );
  });

  it('음수면 기본값으로 폴백', () => {
    expect(resolveMinDays({ HEALTH_CERT_MIN_DAYS: '-5' })).toBe(
      DEFAULT_CERT_MIN_DAYS,
    );
  });
});

describe('resolveCertHost', () => {
  it('NEXT_PUBLIC_API_URL 에서 호스트 추출 (SNI 용, 없어도 동작해야 함)', () => {
    expect(
      resolveCertHost({
        NEXT_PUBLIC_API_URL: 'https://maeum-jungsan.duckdns.org',
      }),
    ).toBe('maeum-jungsan.duckdns.org');
  });

  it('경로·포트가 붙어도 호스트만 추출', () => {
    expect(
      resolveCertHost({ NEXT_PUBLIC_API_URL: 'https://example.com:8443/api' }),
    ).toBe('example.com');
  });

  it('http 는 검사 대상이 아님', () => {
    expect(
      resolveCertHost({ NEXT_PUBLIC_API_URL: 'http://localhost:3000' }),
    ).toBeNull();
  });

  it('미설정이면 null — SNI 없이 진행한다', () => {
    expect(resolveCertHost({})).toBeNull();
  });

  it('URL 로 파싱되지 않으면 null', () => {
    expect(resolveCertHost({ NEXT_PUBLIC_API_URL: 'not a url' })).toBeNull();
  });
});
