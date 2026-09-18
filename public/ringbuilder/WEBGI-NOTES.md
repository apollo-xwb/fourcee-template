# Crystal-Jewels / Ringbuilder bake notes

Source: https://github.com/VikasRana10/3D-app (Crystal-Jewels)
Live ref: https://3d-jewelapp.netlify.app/

## Build
- `npm install && npm run build` (parcel) produces static `dist/`
- WebGi runtime is vendored via npm tarball:
  `https://storage.googleapis.com/dist.pixotronics.com/webgi/runtime/bundle-0.4.6.tgz`
- Bundle is compiled INTO `src.*.js` — no runtime CDN required for the baked build.
- GLBs (`ring_webgi.glb`, `ring2_webgi.glb`, `ring2_webgi3.glb`) shipped under `assets/`.

## Offline / fallback
If the proprietary WebGi tarball is unreachable, rebuild fails. Closest Three.js scroll-camera
path is in vendor `src/index.ts` (GSAP ScrollTrigger camera position/target/ring.rotation).
A lightweight Three.js fallback can load the same GLBs without DiamondPlugin SSR/SSAO.

## Serve paths
- `/craft/fourcee-ring/` (primary)
- `/fourcee/ringbuilder/` (desk alias)
