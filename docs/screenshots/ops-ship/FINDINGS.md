# Fourcee template — E2E / UX review findings

Date: 2026-10-01/02 (Africa/Johannesburg). Branch `ops/e2e-ar-tryon` off `main@615a58d`.
Method: Playwright 1.63 + Chromium (software GL, `--use-gl=swiftshader`), desktop 1440x900 and phone 390x844 (iPhone 14 profile, touch). axe-core 4 (wcag2a/aa). Production build served with `vite preview`.
**Not tested: real iPhone, real Android, real camera, Safari/WebKit, real GPU performance.** Frame rates measured under software GL are not representative.

Evidence: `screens/before/`, `screens/after/`, `screens/ar/`, `evidence/` (same set, curated, is committed under `docs/screenshots/ops-ship/`).

## Broken flows
| # | Finding | Status | Evidence |
|---|---|---|---|
| F1 | Hamburger menu (and theme toggle / utilities) missing on the Checkout view; `VIEWS_WITH_UTILITIES` excluded CHECKOUT, so a visitor on pricing could not open the menu or get back except via the dock | **Fixed** (CHECKOUT added). Verified on 390px: menu button present, menu opens, Home returns to landing, light-theme toggle works | `evidence/` menu check output in PR; `screens/after/phone-light-theme.png` |
| F2 | Page crashed to a blank screen when WebGL was unavailable (uncaught "Error creating WebGL context" thrown by 4 decorative three.js scenes) | **Fixed** (try/catch in dotted-surface, CrystalRingCanvas, Pendant3D, PendantFBX). Verified with `getContext('webgl')` forced to null: landing renders, try-on shows a clear message | `evidence/ar-edge-cases.json`, `screens/ar/no-webgl-phone.png` |
| F3 | Click-through of every landing control (31 per viewport) incl. side menu, dock, Book (Cal.com), pricing CTAs, audit CTAs, admin dot, terms | All 31 respond on desktop and phone (Home, "+1" flag, CALL (needs a number), Open chat open no new *view* by design — chat verified separately). No dead CTA found | `evidence/cta-phone.log`, `after-cta/` |
| F4 | Checkout steps 1→2→3→"Authorize" → "Deployment Started" | Works on phone and desktop, no console errors | `screens/after/*checkout*`, `evidence/checkout-flow*.json` |
| F5 | Portal tabs (Calls, Onboard, Handover, Studio), Admin, Blog, Terms | Render, no console errors | `screens/after/*portal*`, tour log |
| F6 | Ring-builder AR deep link `?ring=…&ar=1` only worked after the visitor scrolled to the (lazy) studio | **Fixed** while building Part 2 (studio mounts immediately for deep links) | `evidence/ar-edge-cases.json` |

## Console / build errors
| # | Finding | Status |
|---|---|---|
| C1 | `cdn.tailwindcss.com` runtime in production ("should not be used in production" warning, render-blocking third-party script) | **Fixed** — compiled Tailwind v4 `@theme`, CDN script removed |
| C2 | `@font-face` pointed at `/assets/SphereNextThin-WyR54.ttf` and `NextSphereBlack` (not in repo) → "Failed to decode downloaded font / OTS parsing error" on every load | **Fixed** — dead `@font-face` removed (falls back to the existing font stack) |
| C3 | `tsc` 3 errors (OBJLoader/HDRLoader import paths, `ease: string`) | **Fixed** — `npx tsc --noEmit` = 0 errors |
| C4 | Console after fixes: 0 errors / 0 warnings on desktop and phone tours, AR and try-on runs | Verified (`evidence/tour-after.log`, `ar-e2e.log`) |

## Accessibility (axe wcag2a/aa)
| # | Finding | Status |
|---|---|---|
| A1 | `button-name` critical: dock icon buttons without names (3–4 per page) | **Fixed** (`aria-label`, `title`, `aria-current`) |
| A2 | `label` critical: 3 range inputs in ValueCalculator | **Fixed** |
| A3 | `color-contrast` serious: "Ring studio on approach" placeholder; call buttons (neutral-500 on white text) | **Fixed** |
| A4 | `scrollable-region-focusable`: FAQ carousel, CRM transcript | **Fixed** (`tabIndex=0`, `role=region`, label) |
| A5 | `aria-prohibited-attr`: `aria-label` on a plain div in the ring canvas | **Fixed** (`role="img"`) |
| A6 | Global focus ring was missing; no reduced-motion handling | **Fixed** (`:focus-visible`, `prefers-reduced-motion`) |
Result: axe wcag2a/aa on landing, audit, portal and pricing (390px) = **0 violations** after (before: 2 critical + 3 serious types). Not run: full manual keyboard / screen reader pass.

## Input zoom (phone)
| # | Finding | Status |
|---|---|---|
| Z1 | Phone-number input was 12px (14px desktop) → iOS zooms on focus | **Fixed** — CSS guard `font-size:max(16px,1em)` for all input/textarea/select ≤1024px |
| Z2 | Viewport meta | `width=device-width, initial-scale=1.0, viewport-fit=cover` — no `maximum-scale`, no `user-scalable=no`; pinch zoom stays enabled |
Measured on 390px: **25 fields** across landing, chat, checkout (name/email/select/card), admin, portal (all four tabs) and ring builder: every text/tel/email/select/textarea computed font-size ≥ 16px; focusing each one left `visualViewport.scale === 1`. (Range sliders excluded; no text entry.) Caveat: this is Chromium emulation — iOS Safari's own zoom behaviour was not tested; the 16px rule is what prevents it. Desktop (non-touch) keeps 14px on the tel input by design (CSS guard is ≤1024px).

## Layout
| # | Finding | Status |
|---|---|---|
| L1 | Horizontal overflow | None at document level on 390px (`docW=390`); overflow only inside intentional carousels/fixed layers |
| L2 | Tap targets <32px (walkthrough Got it/Hide/Reopen 29, Book 28, Get Fourcee 31, close-notification 28, admin dot 12, "Show the math" 20, "View others" 20, pricing toggles 31) | **Mostly fixed**: nav/walkthrough/Book/Get Fourcee ≥36–40px, "Show the math" and "View others" ≥36px, admin dot has a 36px hit area. **Open:** pricing monthly/annual toggle (31px) and notification close (28px) not enlarged |

## Colour (brief: black-and-white liquid glass, no colour accents)
| # | Finding | Status |
|---|---|---|
| K1 | Gold/copper `#c8b58f`, ice-blue dot, emerald badge/status, blue chat FAB gradient, green "secure access" pill, navy page backgrounds, coloured plate images/GIFs/photos | **Fixed** — palette neutralised; hero/plate/GIF/audit images and the 3D pendant greyscaled; three.js light tints and gold pendant neutralised; navy `@theme` replaced by neutral greys |
| K2 | Ring product swatches (yellow/rose gold, ruby, sapphire, emerald…) | **Kept on purpose** — they are the product being sold (metal and gem finish), not UI accents. Call out to Floor Watch if a pure-mono ring is wanted |
| K3 | Measured with a saturated-pixel script on 37 matched screenshot pairs: mean share of saturated pixels **46.8% → 1.4%** (max 99% → 25%, the remainder is the gold ring in the hero shot) | `evidence/saturation-before-after.json` |
`public/content.json` untouched; the `branding.theme` keys remain in the contract but no longer write colour variables (they would re-introduce colour).

## Performance
| # | Finding | Status |
|---|---|---|
| P1 | Main JS bundle 1.2 MB (340 kB gzip) | **Open** — not split further in this PR; AR code (model-viewer, MediaPipe, QR) is lazy-loaded so it adds nothing to first load |
| P2 | `placeholder.gif` 3.8 MB, `nivoda.gif` 5.2 MB | **Open** — recommend converting to video/WebP |
| P3 | Removed the render-blocking Tailwind CDN script | Fixed |
| P4 | FPS (software GL): landing ~13, ring studio ~6, try-on ~1 | Not representative of devices; real-device performance **untested** |
