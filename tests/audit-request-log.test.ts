import { describe, expect, it } from 'vitest';
import { forbiddenAuditRequest, normalizeAuditRequest, normalizeAuditRequests } from '../lib/audit-request-log';

describe('audit request log', () => {
  it('collapses hashed build assets and drops query strings', () => {
    expect(normalizeAuditRequest('http://127.0.0.1:4199/assets/App-Dk3mN0pQ.js?v=1')).toBe(
      'http://127.0.0.1:4199/assets/App-*.js',
    );
    expect(normalizeAuditRequest('http://127.0.0.1:4199/content.json')).toBe('http://127.0.0.1:4199/content.json');
    expect(normalizeAuditRequest('data:image/png;base64,abc')).toBeNull();
    expect(
      normalizeAuditRequest(
        'https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/g/turnstile/f/av0/rch/lmte0/1x00000000000000000000AA/light/fbE/new/flexible',
      ),
    ).toBeNull();
  });

  it('sorts a unique set', () => {
    expect(
      normalizeAuditRequests([
        'http://127.0.0.1:4199/assets/index-AAAAAAAA.js',
        'http://127.0.0.1:4199/content.json',
        'http://127.0.0.1:4199/assets/index-BBBBBBBB.js',
      ]),
    ).toEqual(['http://127.0.0.1:4199/assets/index-*.js', 'http://127.0.0.1:4199/content.json']);
  });

  it('flags a new interest-capture call', () => {
    expect(forbiddenAuditRequest('http://127.0.0.1:4199/api/interest')).toBe(true);
    expect(forbiddenAuditRequest('http://127.0.0.1:4199/api/lead')).toBe(false);
    expect(forbiddenAuditRequest('http://127.0.0.1:4199/content.json')).toBe(false);
  });
});