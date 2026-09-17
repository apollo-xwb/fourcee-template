# Direction mockups (founder hold)

Visual direction only. **Neuro `content.json` wiring stays untouched conceptually** — field names, load order (`GET /content.json`), placeholders, and fallbacks do not change. Existing product code on this branch is left as-is until a frame is approved.

Open `index.html` locally, or review the exported 1440×810 frames in `frames/`.

| Frame | File | Caption |
| --- | --- | --- |
| 1 Landing / hero | `frames/01-landing-hero.png` | Cinematic restraint: one ring, ice status chip, copper CTA. Audit first, not a SaaS feature grid. |
| 2 Personalized audit | `frames/02-audit-lost-revenue.png` | Stark lost-revenue number, proof tiles, urgency card, recover CTA. Figures map to `revenueModel` / `callModel` / `auditMeta`. |
| 3 Concierge HUD | `frames/03-portal-hud.png` | Mission-control clock, channel chips, live transcript. Fed by `liveDemo.*`. |
| 4 Ring studio | `frames/04-ring-studio.png` | Metal/gem controls beside a 3D ring stage. Optional `ringBuilder` — older payloads omit it and still work. |

Atmosphere plates in `plates/` are text-free product photography. Type is HTML so spelling stays reviewable (earlier AI-only frames garbled “Fourcee”, “gold standard”, metal names).

Re-export frames after HTML edits:

```bash
python3 docs/mockups/capture.py
```
