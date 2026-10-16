// Post-build: put a static copy of the splash (generic Fourcee branding, no prospect data) into dist/index.html so phones paint it
// before the app bundle has run. SplashScreen adopts and fades it (components/SplashScreen.tsx). Wide screens (>=1024px) hide it and
// render the React splash as before. The entry bundle starts right after that first paint.
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import fs from 'fs';
const exe = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p));
const server = await preview({ preview: { port: 4398, strictPort: true }, logLevel: 'silent' });
const b = await chromium.launch(exe ? { executablePath: exe } : {});
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto('http://localhost:4398/', { waitUntil: 'load' });
await p.waitForSelector('[data-testid=splash]');
await p.waitForTimeout(300);
const html = await p.evaluate(() => {
  const s = document.querySelector('[data-testid=splash]').cloneNode(true);
  s.id = 'static-splash';
  s.setAttribute('data-testid', 'splash');
  s.querySelectorAll('script, canvas').forEach((n) => n.remove());
  // The wordmark is on screen from the first paint (no fade-up) so it is the page's first, largest paint on phones.
  const logo = s.querySelector('img');
  const wrap = logo && logo.closest('.fx-splash-in');
  if (wrap) wrap.classList.remove('fx-splash-in');
  if (logo) logo.setAttribute('fetchpriority', 'high');
  return s.outerHTML;
});
await b.close(); await server.close();
const file = 'dist/index.html';
let out = fs.readFileSync(file, 'utf8');
if (out.includes('id="static-splash"')) throw new Error('already prerendered');
if (!out.includes('<div id="root"></div>')) throw new Error('root marker not found');
out = out.replace('<div id="root"></div>', `<div id="root"></div>${html}<style>@media (min-width:1024px){#static-splash{display:none}}</style><script>if(matchMedia('(min-width:1024px)').matches){var s=document.getElementById('static-splash');s&&s.remove()}</script>`);
// v3 utilities after the compiled v4 CSS: the same cascade the runtime CDN produced (it appended its <style> to <head>).
out = out.replace('</head>', '<link rel="stylesheet" href="/tw3.css"></head>');
const m = out.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
if (!m) throw new Error('entry script not found');
out = out.replace(m[0], `<script>requestAnimationFrame(function(){setTimeout(function(){var s=document.createElement('script');s.type='module';s.crossOrigin='';s.src='${m[1]}';document.head.appendChild(s)},0)})</script>`);
fs.writeFileSync(file, out);
console.log('static splash', Math.round(html.length / 1024), 'KB');
