import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { openApp, watchConsole } from './helpers';
import { DEFAULT_BOOKING_URL } from '../lib/prospect-fixes';

const SHOTS = '/opt/cursor/artifacts/screenshots';
const noise = /GPU stall|GL Driver|Failed to load resource|cdn\.tailwindcss|fonts\.g/i;

test('landing renders, placeholders and content.json copy are present, Book opens the calendar', async ({ page }, info) => {
  mkdirSync(SHOTS, { recursive: true });
  const errors = watchConsole(page);
  await openApp(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('gold standard');
  await expect(page.getByText('PLACEHOLDER Business').first()).toBeVisible();
  await expect(page.getByText('Try Fourcee on your phone').first()).toBeVisible();
  await expect(page.getByText('No charge.').first()).toBeVisible();
  const book = page.getByRole('link', { name: 'Book' });
  await expect(book).toHaveAttribute('href', DEFAULT_BOOKING_URL);
  await expect(book).toHaveAttribute('target', '_blank');
  await expect(book).toHaveAttribute('rel', /noopener/);

  const fields = page.locator('input, textarea, select');
  const tooSmall = await fields.evaluateAll((els) =>
    els
      .filter((el) => {
        const type = (el as HTMLInputElement).type;
        return !['checkbox', 'radio', 'range', 'color', 'file', 'button', 'submit', 'hidden'].includes(type);
      })
      .map((el) => ({ tag: el.tagName, size: parseFloat(getComputedStyle(el).fontSize) }))
      .filter((row) => row.size < 16),
  );
  if ((page.viewportSize()?.width ?? 0) < 768) {
    expect(tooSmall, 'inputs stay at least 16px so iOS does not zoom').toEqual([]);
  }

  await page.getByTestId('hero-field-canvas').waitFor({ state: 'attached', timeout: 20_000 }).catch(() => {});
  const tag = info.project.name;
  await page.locator('#hero').screenshot({ path: `${SHOTS}/hero-${tag}.png` });
  await page.locator('#demo').scrollIntoViewIfNeeded();
  await page.locator('#demo').screenshot({ path: `${SHOTS}/demo-${tag}.png` });
  await page.locator('#roi-calculator').scrollIntoViewIfNeeded();
  await page.locator('#roi-calculator').screenshot({ path: `${SHOTS}/roi-${tag}.png` });
  const silence = page.locator('section').filter({ hasText: 'Silence is Expensive' }).first();
  await silence.scrollIntoViewIfNeeded();
  await silence.screenshot({ path: `${SHOTS}/silence-${tag}.png` });

  if (info.project.name.startsWith('chromium')) {
    await expect(page.getByTestId('hero-field-canvas')).toBeAttached({ timeout: 20_000 });
  }
  expect(errors.filter((e) => !noise.test(e))).toEqual([]);
});

test('reduced motion shows the hero poster and does not start a canvas', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = watchConsole(page);
  await openApp(page);
  const poster = page.getByTestId('hero-field-poster');
  await expect(poster).toBeVisible();
  await page.waitForTimeout(1800);
  await expect(page.getByTestId('hero-field-canvas')).toHaveCount(0);
  await expect(page.getByTestId('section-accent-canvas')).toHaveCount(0);
  expect(await poster.getAttribute('data-ready')).not.toBe('1');
  const lcpTag = await page.evaluate(() => {
    const img = document.querySelector('[data-testid="hero-lcp-poster"]');
    const canvas = document.querySelector('[data-testid="hero-field-canvas"]');
    return { img: !!img, canvas: !!canvas };
  });
  expect(lcpTag.canvas).toBe(false);
  expect(errors.filter((e) => !noise.test(e))).toEqual([]);
});
