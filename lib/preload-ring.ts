import { assetUrl } from './asset-url';

const RING_URL = () => assetUrl('assets/3D/ring_webgi.glb');
const DRACO_FILES = () =>
  ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js'].map((f) => assetUrl(`draco/gltf/${f}`));

let networkPromise: Promise<void> | null = null;
let runtimePromise: Promise<void> | null = null;
let runtimeReady = false;

/** Fetch (and fully read, so the HTTP cache entry completes) a same-origin asset. Never throws. */
function warmFetch(url: string): Promise<void> {
  return fetch(url, { credentials: 'same-origin', cache: 'force-cache' })
    .then((r) => (r.ok ? r.blob() : undefined))
    .then(() => undefined)
    .catch(() => undefined);
}

/**
 * Network half of the preload: GLB (~1 MB) + Draco decoder (~760 KB) into the HTTP cache. Costs almost no main-thread time, so it is
 * safe to run while the splash animates. (There is no separate env map: the studio lighting is built into the WebGi pipeline.)
 */
export function preloadRingNetwork(): Promise<void> {
  if (networkPromise) return networkPromise;
  if (typeof window === 'undefined') return Promise.resolve();
  networkPromise = Promise.all([RING_URL(), ...DRACO_FILES()].map(warmFetch)).then(() => undefined);
  return networkPromise;
}

/** CPU half: download + parse the 2 MB webgi runtime. Run when the main thread is idle (after the splash / on first interaction). */
export function preloadRingRuntime(): Promise<void> {
  if (runtimePromise) return runtimePromise;
  if (typeof window === 'undefined') return Promise.resolve();
  runtimePromise = import('webgi')
    .then(() => {
      runtimeReady = true;
    })
    .catch(() => undefined);
  return runtimePromise;
}

export const ringRuntimeReady = () => runtimeReady;

/** Everything (network + runtime). Idempotent. */
export function preloadRingAssets(): Promise<void> {
  return Promise.all([preloadRingNetwork(), preloadRingRuntime()]).then(() => undefined);
}

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };

/**
 * Schedule the heavy preload: network now, runtime when idle (max 1.5 s wait), or immediately on the first user interaction,
 * whichever comes first. Returns a cleanup. Safe to call more than once.
 */
export function schedulePreloadRing(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  void preloadRingNetwork();
  let done = false;
  const events = ['pointerdown', 'touchstart', 'keydown', 'wheel'] as const;
  const run = () => {
    if (done) return;
    done = true;
    cleanup();
    void preloadRingAssets();
  };
  const onScroll = () => run();
  events.forEach((e) => window.addEventListener(e, run, { once: true, passive: true }));
  window.addEventListener('scroll', onScroll, { once: true, passive: true, capture: true });
  const w = window as IdleWindow;
  const idle = w.requestIdleCallback ? w.requestIdleCallback(run, { timeout: 1500 }) : window.setTimeout(run, 600);
  function cleanup() {
    events.forEach((e) => window.removeEventListener(e, run));
    window.removeEventListener('scroll', onScroll, true);
    if (w.requestIdleCallback && (window as { cancelIdleCallback?: (n: number) => void }).cancelIdleCallback) {
      (window as { cancelIdleCallback?: (n: number) => void }).cancelIdleCallback!(idle);
    } else window.clearTimeout(idle);
  }
  return cleanup;
}
