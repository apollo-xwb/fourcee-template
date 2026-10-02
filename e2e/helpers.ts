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
  const gotIt = page.getByRole('button', { name: 'Got it' });
  if (await gotIt.isVisible().catch(() => false)) await gotIt.evaluate((el: HTMLElement) => el.click()); // DOM click: a deep-linked sheet may already cover it
}

export async function axeSerious(page: Page, include: string, tags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']) {
  const r = await new AxeBuilder({ page }).include(include).withTags(tags).analyze();
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) }));
}

export const MEDIA = '/workspace/tmp-fourcee4-harness/media/';
