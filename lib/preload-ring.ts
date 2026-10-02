import { assetUrl } from './asset-url';

const RING_URL = () => assetUrl('assets/3D/ring_webgi.glb');
const DRACO_FILES = () =>
  ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js'].map((f) =>
    assetUrl(`draco/gltf/${f}`)
  );

let started = false;
let ringPromise: Promise<Response | void> | null = null;

/** Kick off GLB + Draco + webgi warm during splash so canvas mounts painted. */
export function preloadRingAssets(): Promise<void> {
  if (started) return (ringPromise as Promise<void>) || Promise.resolve();
  started = true;
  if (typeof window === 'undefined') return Promise.resolve();

  const fetches = [
    fetch(RING_URL(), { credentials: 'same-origin', cache: 'force-cache' }).catch(() => undefined),
    ...DRACO_FILES().map((url) =>
      fetch(url, { credentials: 'same-origin', cache: 'force-cache' }).catch(() => undefined)
    ),
  ];

  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (gl) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  } catch {
    /* ignore */
  }

  // Warm webgi runtime only (RingBuilder is statically bundled into the main chunk).
  const chunkWarm = import('webgi').catch(() => undefined);

  ringPromise = Promise.all([...fetches, chunkWarm]).then(() => undefined);
  return ringPromise as Promise<void>;
}
