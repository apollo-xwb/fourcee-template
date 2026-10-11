import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { openApp, unlockAuditReport } from './helpers';
import { forbiddenAuditRequest, normalizeAuditRequests } from '../lib/audit-request-log';

/**
 * Proves the audit page still renders the same injection slots as commit 16eac5a.
 * AUDIT_IDENTITY_RECORD=1 rewrites e2e/fixtures/audit-identity-baseline.json from the running build.
 * The baseline checked in here was captured with the audit components unchanged from that commit.
 */
const BASELINE = path.join('e2e', 'fixtures', 'audit-identity-baseline.json');
const RECORD = process.env.AUDIT_IDENTITY_RECORD === '1';

const RAW_PATTERN = 'PLACEHOLDER|City, State';
const FIXTURE_NAME = 'AURUM TEST ATELIER';
const FIXTURE_CITY = 'Lisbon, PT';
const FIXTURE_REPORT = 'AT-2041';
const FIXTURE_QUOTE = 'AURUM_QUOTE_ONE';
const FIXTURE_BODY = 'AURUM_RECOVERY_BODY';
const FIXTURE_PATTERN = [FIXTURE_NAME, FIXTURE_CITY, FIXTURE_REPORT, FIXTURE_QUOTE, FIXTURE_BODY].join('|');

type Slot = { path: string; tag: string; text: string; attrs: Record<string, string> };
type Shot = { gate: Slot[]; report: Slot[]; requests: string[] };

function fixturePayload() {
  const raw = JSON.parse(readFileSync('public/content.json', 'utf8').replace(/^\uFEFF/, ''));
  raw.business.name = FIXTURE_NAME;
  raw.business.location = FIXTURE_CITY;
  raw.auditMeta.reportId = FIXTURE_REPORT;
  raw.reviews.quote1 = FIXTURE_QUOTE;
  raw.recoveryPlan.body = FIXTURE_BODY;
  const encoded = JSON.stringify(raw);
  if (encoded.indexOf(`"location"`) > 599) {
    throw new Error('fixture location fell outside the audit gate byte range');
  }
  return raw;
}

async function readSlots(page: Page, pattern: string, root: 'gate' | 'report'): Promise<Slot[]> {
  return page.evaluate(({ pattern: source, root: which }) => {
    const re = new RegExp(source, 'i');
    const gate = document.querySelector('[data-testid="audit-lead-gate"]');
    const reportHeading = document.querySelector('h1');
    const scope = which === 'gate'
      ? gate
      : (reportHeading?.closest('.min-h-screen') ?? document.body);
    if (!scope) return [];
    const hits: Element[] = [];
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode as Element | null;
    while (node) {
      if (node !== scope) {
        const own = [...node.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent || '').join('');
        const attrHit = [...node.attributes].some((a) => re.test(a.value) || re.test(a.name));
        if (re.test(own) || attrHit) hits.push(node);
      }
      node = walker.nextNode() as Element | null;
    }
    const innermost = hits.filter((el) => !hits.some((other) => other !== el && el.contains(other)));
    const pathOf = (el: Element) => {
      const parts: string[] = [];
      let n: Element | null = el;
      while (n && n !== scope) {
        const parent: HTMLElement | null = n.parentElement;
        if (!parent) break;
        const same = [...parent.children].filter((c) => c.tagName === n!.tagName);
        parts.push(`${n.tagName.toLowerCase()}:nth-of-type(${same.indexOf(n) + 1})`);
        n = parent;
      }
      return parts.reverse().join(' > ');
    };
    return innermost.map((el) => {
      const attrs: Record<string, string> = {};
      for (const a of [...el.attributes]) {
        if (a.name === 'style') continue;
        attrs[a.name] = a.value;
      }
      return {
        path: pathOf(el),
        tag: el.tagName,
        text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        attrs,
      };
    });
  }, { pattern, root });
}

async function capture(page: Page, mode: 'raw' | 'fixture'): Promise<Shot> {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  if (mode === 'fixture') {
    const body = fixturePayload();
    await page.route('**/content.json*', (route) => route.fulfill({ json: body }));
  }
  await page.route('**/api/lead', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, id: 'e2e-lead' }),
  }));
  await openApp(page, `?identity=${mode}#/audit`);
  await expect(page.getByTestId('audit-lead-gate')).toBeVisible({ timeout: 30_000 });
  const pattern = mode === 'raw' ? RAW_PATTERN : FIXTURE_PATTERN;
  const gate = await readSlots(page, pattern, 'gate');
  await unlockAuditReport(page);
  await expect(page.getByRole('heading', { name: /Phone Performance Audit Report/i })).toBeVisible();
  await page.waitForTimeout(600);
  const report = await readSlots(page, pattern, 'report');
  const normalised = normalizeAuditRequests(requests);
  expect(normalised.filter((url) => forbiddenAuditRequest(url)), 'no new capture endpoints').toEqual([]);
  expect(normalised.join('\n')).not.toMatch(/HeroField|hero-field-scene|motion-polish/i);
  return { gate, report, requests: normalised };
}

test('audit slots and network match the 16eac5a baseline (raw placeholders and a fixed content.json)', async ({ page }, info) => {
  const raw = await capture(page, 'raw');
  expect(JSON.stringify(raw.gate)).toContain('PLACEHOLDER Business');
  expect(JSON.stringify(raw.gate)).toContain('City, State');
  expect(JSON.stringify(raw.report)).toContain('PLACEHOLDER Business');
  expect(JSON.stringify(raw.report)).toContain('City, State');

  const fixture = await capture(page, 'fixture');
  expect(JSON.stringify(fixture.gate)).toContain(FIXTURE_NAME);
  expect(JSON.stringify(fixture.gate)).toContain(FIXTURE_CITY);
  expect(JSON.stringify(fixture.report)).toContain(FIXTURE_QUOTE);
  expect(JSON.stringify(fixture.report)).toContain(FIXTURE_BODY);
  expect(JSON.stringify(fixture.report)).toContain(FIXTURE_REPORT);

  const shot = { raw: { gate: raw.gate, report: raw.report, requests: raw.requests }, fixture: { gate: fixture.gate, report: fixture.report, requests: fixture.requests } };
  if (RECORD) {
    mkdirSync(path.dirname(BASELINE), { recursive: true });
    const prev = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
    prev[info.project.name] = shot;
    writeFileSync(BASELINE, JSON.stringify(prev, null, 2) + '\n');
    return;
  }
  const saved = JSON.parse(readFileSync(BASELINE, 'utf8'));
  expect(saved[info.project.name], `missing baseline for ${info.project.name}`).toEqual(shot);
});
