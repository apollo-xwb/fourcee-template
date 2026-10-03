import { describe, expect, it, vi, afterEach } from 'vitest';
import { resolveCtaVariant, toE164, wantsShortPage, readProof, CTA_LABEL, OFFER_LINE } from '../lib/cro';
import type { AuditData } from '../types/audit';

afterEach(() => vi.unstubAllEnvs());

describe('wantsShortPage', () => {
  it('is on at the root by default', () => {
    expect(wantsShortPage({ hash: '', search: '' })).toBe(true);
    expect(wantsShortPage({ hash: '#/', search: '' })).toBe(true);
    expect(wantsShortPage({ hash: '#', search: '?utm_source=instantly' })).toBe(true);
  });
  it('never takes over an existing hash route', () => {
    for (const h of ['#/audit', '#/checkout', '#/ops', '#/admin', '#/terms', '#/insights', '#/home']) expect(wantsShortPage({ hash: h, search: '?v=short' })).toBe(false);
  });
  it('?v=full / ?v=short override the build flag; VITE_CRO_SHORT=0 turns it off', () => {
    expect(wantsShortPage({ hash: '', search: '?v=full' })).toBe(false);
    vi.stubEnv('VITE_CRO_SHORT', '0');
    expect(wantsShortPage({ hash: '', search: '' })).toBe(false);
    expect(wantsShortPage({ hash: '', search: '?v=short' })).toBe(true);
  });
});

describe('CTA copy is truthful by construction', () => {
  it('defaults to the booking CTA', () => {
    expect(resolveCtaVariant('')).toBe('book');
    expect(CTA_LABEL.book).toBe('Book my free audit walkthrough');
  });
  it('"Go live in 5 minutes" needs BOTH the platform flag and a destination', () => {
    expect(resolveCtaVariant('?cta=golive')).toBe('book');
    vi.stubEnv('VITE_VOICE_ONBOARDING', '1');
    expect(resolveCtaVariant('?cta=golive')).toBe('book');
    vi.stubEnv('VITE_ONBOARDING_URL', 'https://example.test/start');
    expect(resolveCtaVariant('?cta=golive')).toBe('golive');
  });
  it('hear variant is opt-in', () => {
    expect(resolveCtaVariant('?cta=hear')).toBe('hear');
    vi.stubEnv('VITE_CRO_CTA', 'hear');
    expect(resolveCtaVariant('')).toBe('hear');
  });
  it('offer line matches the founder-assisted positioning (no "2 hours", no "5 minutes")', () => {
    expect(OFFER_LINE).toBe('Free audit · done-for-you setup · live within days');
    expect(OFFER_LINE + CTA_LABEL.book).not.toMatch(/2 hours|5 minutes|hands-off/i);
  });
});

describe('toE164 (demo-call webhook payload)', () => {
  it('drops the national trunk 0 and punctuation', () => {
    expect(toE164('+27', '082 123 4567')).toBe('+27821234567');
    expect(toE164('+27', '0821234567')).toBe('+27821234567');
    expect(toE164('+44', '(07700) 900123')).toBe('+447700900123');
    expect(toE164('+1', '415-555-0132')).toBe('+14155550132');
  });
  it('rejects too short / too long', () => {
    expect(toE164('+27', '12345')).toBeNull();
    expect(toE164('+27', '1234567890123')).toBeNull();
    expect(toE164('+27', '')).toBeNull();
  });
});

describe('readProof', () => {
  const base = { revenueModel: { monthlyLossMin: 16000, monthlyLossMax: 26000 }, callModel: { missedCallsPerWeekMin: 20, missedCallsPerWeekMax: 26, inboundCallsPerWeekMin: 30, inboundCallsPerWeekMax: 40, answerRateMin: 34, answerRateMax: 39 }, reviews: { rating: 4.5, count: 100 } } as unknown as AuditData;
  it('reads the existing content.json keys', () => {
    expect(readProof(base)).toMatchObject({ lossMin: 16000, lossMax: 26000, missedMin: 20, missedMax: 26, rating: 4.5, reviews: 100 });
  });
  it('returns null (no invented number) when the audit has none, and ignores placeholder-token ratings', () => {
    expect(readProof({ ...base, revenueModel: {} } as unknown as AuditData)).toBeNull();
    expect(readProof({ ...base, reviews: { rating: 'PLACEHOLDER_RATING_OUT_OF_5', count: 'PLACEHOLDER_REVIEWS_COUNT' } } as unknown as AuditData)?.rating).toBeNull();
  });
});
