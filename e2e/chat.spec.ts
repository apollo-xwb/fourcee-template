import { test, expect, type Page } from '@playwright/test';
import { openApp, watchConsole, axeSerious } from './helpers';

// Melissa chat (OpenRouter proxy). The browser only ever talks to /api/chat; here the proxy is mocked at the network layer.
const sse = (parts: string[]) => parts.map((d) => `data: ${JSON.stringify({ delta: d })}\n\n`).join('') + `data: ${JSON.stringify({ done: true, model: 'mock/model' })}\n\n`;
const health = (page: Page, enabled: boolean) => page.route('**/api/chat/health', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled }) }));

async function ask(page: Page, text: string) {
  await page.getByRole('button', { name: 'Open chat' }).click();
  const box = page.getByRole('textbox', { name: 'Message Melissa' });
  await expect(box).toBeVisible();
  const fs = await box.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fs, 'chat input must be >= 16px (no iOS zoom)').toBeGreaterThanOrEqual(16);
  await box.fill(text);
  await page.getByRole('button', { name: 'Send message' }).click();
}
const lastBubble = (page: Page) => page.locator('.whitespace-pre-wrap.break-words').last();

test('proxy on: answer streams in, HTML from the model is escaped, request carries only the messages', async ({ page }) => {
  const errors = watchConsole(page);
  await health(page, true);
  let posted: any = null;
  await page.route('**/api/chat', async (r) => {
    posted = r.request().postDataJSON();
    await r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(['Our **Pro** plan ', 'is $997/mo. ', '<img src=x onerror="window.__xss=1">']) });
  });
  await openApp(page);
  await ask(page, 'How much is Pro?');
  await expect(lastBubble(page)).toContainText('Our Pro plan is $997/mo.');
  await expect(lastBubble(page).locator('strong')).toHaveText('Pro');
  expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  expect(await page.locator('.whitespace-pre-wrap img').count()).toBe(0);
  expect(Object.keys(posted)).toEqual(['messages']); expect(posted.messages.at(-1)).toEqual({ role: 'user', content: 'How much is Pro?' });
  expect(errors.filter((e) => !/Failed to load resource|GPU stall|GL Driver/.test(e))).toEqual([]);
});

test('proxy disabled / unreachable: built-in answers, no error shown', async ({ page }) => {
  await health(page, false);
  await openApp(page);
  await ask(page, 'what are your plans and pricing');
  await expect(lastBubble(page)).toContainText('Starter');
});

test('proxy fails mid-flight (503 all_models_failed): falls back to built-in answer; 429 adds a busy note', async ({ page }) => {
  await health(page, true);
  await page.route('**/api/chat', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"all_models_failed"}' }));
  await openApp(page);
  await ask(page, 'pricing please');
  await expect(lastBubble(page)).toContainText('Starter');
  await page.unroute('**/api/chat');
  await page.route('**/api/chat', (r) => r.fulfill({ status: 429, headers: { 'retry-after': '20', 'content-type': 'application/json' }, body: '{"error":"rate_limited"}' }));
  await page.getByRole('textbox', { name: 'Message Melissa' }).fill('and nivoda?');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(lastBubble(page)).toContainText('a lot of questions');
});

test('the built bundle contains no provider key material and no direct provider URL', async ({ page, request }) => {
  await openApp(page);
  const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.src).filter(Boolean));
  expect(scripts.length).toBeGreaterThan(0);
  for (const src of scripts) {
    const body = await (await request.get(src)).text();
    expect(body, src).not.toMatch(/sk-or-[A-Za-z0-9]{8}|AIza[0-9A-Za-z_-]{20}|generativelanguage\.googleapis\.com|openrouter\.ai\/api/);
  }
});

test('chat panel: zero serious axe violations', async ({ page }) => {
  await health(page, false);
  await openApp(page);
  await page.getByRole('button', { name: 'Open chat' }).click();
  await expect(page.getByRole('textbox', { name: 'Message Melissa' })).toBeVisible();
  expect(await axeSerious(page, '.floating-ai-button, [aria-label="Message Melissa"], [aria-label="Close chat"], [aria-label="Send message"]')).toEqual([]);
});
