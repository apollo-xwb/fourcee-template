# Ring builder integration

Source: [VikasRana10/3D-app](https://github.com/VikasRana10/3D-app) **Crystal-Jewels** (WebGi 0.4.6 + GSAP ScrollTrigger).

## What was integrated (not the whole marketing site)
- Baked WebGi runtime + scroll camera experience → `public/ringbuilder/`
- GLBs: `assets/ring_webgi.glb`, `ring2_webgi.glb`, `ring2_webgi3.glb`
- Gem / material config UI (from Crystal-Jewels footer menus)
- React section: `components/RingBuilderShowcase.tsx` (`#ring-builder`) embeds the experience

## Ops preview
Lutho Ops craft tip `/craft/fourcee-ring/` may iframe the same bake; **primary product surface is this template section**.

## Rebuild (optional)
From a Crystal-Jewels checkout with WebGi tarball deps:

```bash
npm install
npm run build
# copy dist/ → public/ringbuilder/
```
