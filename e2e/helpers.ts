import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Collect console errors / page errors. */
export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  return errors;
}

/** The splash blocks the page for ~3.5 s; wait for it to unmount, then dismiss the Portal tip so it can't overlap anything. */
export async function openApp(page: Page, query = '') {
  await page.goto('/' + query);
  await page.locator('[data-testid=splash]').waitFor({ state: 'detached', timeout: 60_000 });
  // DOM click, no auto-wait: the tip can auto-dismiss between the check and the click, and a deep-linked sheet may already cover it
  await page.getByRole('button', { name: 'Got it' }).evaluateAll((els) => els.forEach((el) => (el as HTMLElement).click()));
}

export async function axeSerious(page: Page, include: string, tags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']) {
  const r = await new AxeBuilder({ page }).include(include).withTags(tags).analyze();
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) }));
}

import fs from 'node:fs';
import path from 'node:path';
/** Folder with woman_hands.jpg / woman_hands.y4m (a back-of-hand photo and the same as a Y4M for Chromium's fake camera). Not committed
 *  (third-party stock image): set E2E_MEDIA=/path/to/folder. Tests that need it are skipped when it is missing. */
export const MEDIA = (process.env.E2E_MEDIA || '').replace(/([^\\/])$/, '$1/');
export const hasMedia = (f: string) => !!MEDIA && fs.existsSync(path.join(MEDIA, f));
