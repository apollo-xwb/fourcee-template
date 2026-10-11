import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AUDIT_CONTENT_URL, PLACEHOLDER_BUSINESS_NAME, PLACEHOLDER_REPORT_ID } from '../lib/audit-content';
import { GBP_PLACEHOLDER_TOKENS } from '../components/audit-placeholders';
import { GATE_FALLBACK, parseGatePrefix } from '../lib/audit-gate-brief';

/**
 * The Neuro injection slots stay literal and the shipped content.json still drives them.
 * Rendering is asserted in e2e/premium-surface.spec.ts and e2e/audit-identity.spec.ts.
 */
describe('placeholder injection contract', () => {
  const content = JSON.parse(readFileSync('public/content.json', 'utf8').replace(/^\uFEFF/, ''));
  const auditPage = readFileSync('components/AuditPage.tsx', 'utf8');
  const gate = readFileSync('components/AuditLeadGate.tsx', 'utf8');
  const app = readFileSync('App.tsx', 'utf8');

  it('keeps the content.json load path and the placeholder literals', () => {
    expect(AUDIT_CONTENT_URL).toBe('/content.json');
    expect(PLACEHOLDER_BUSINESS_NAME).toBe('PLACEHOLDER Business');
    expect(PLACEHOLDER_REPORT_ID).toBe('PLACEHOLDER');
    expect(GATE_FALLBACK.location).toBe('City, State');
    expect(GBP_PLACEHOLDER_TOKENS).toEqual({
      stars: 'PLACEHOLDER_REVIEW_STARS',
      ratingOutOf5: 'PLACEHOLDER_RATING_OUT_OF_5',
      reviewsCount: 'PLACEHOLDER_REVIEWS_COUNT',
    });
    expect(content.business.name).toBe('PLACEHOLDER Business');
    expect(content.business.location).toBe('City, State');
    expect(content.auditMeta.reportId).toBe('PLACEHOLDER');
    expect(content.liveDemo.ctaLabel).toBe('Try Fourcee on your phone');
  });

  it('still parses the showroom name and city from the gate prefix', () => {
    const brief = parseGatePrefix(readFileSync('public/content.json', 'utf8'));
    expect(brief?.businessName).toBe('PLACEHOLDER Business');
    expect(brief?.location).toBe('City, State');
  });

  it('does not drop the tokens from the audit surface or add a new capture API', () => {
    expect(auditPage).toContain('data.business.name');
    expect(auditPage).toContain('data.business.location');
    expect(gate).toContain('{businessName}');
    expect(gate).toContain('{location}');
    expect(app).toContain('PLACEHOLDER_BUSINESS_NAME');
    expect(app).not.toMatch(/register-interest|api\/interest|api\/subscribe/);
    expect(app).not.toMatch(/from ['"]three['"]/);
    expect(app).not.toMatch(/from ['"]framer-motion['"]/);
    expect(app).not.toMatch(/from ['"]\.\/components\/HeroField['"]/);
    expect(app).not.toMatch(/from ['"]\.\/components\/motion-polish['"]/);
  });
});
