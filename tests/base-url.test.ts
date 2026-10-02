import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

async function load(base: string) {
  vi.stubEnv('BASE_URL', base);
  vi.resetModules();
  return import('../lib/base-url');
}

describe('base-url (default root base is a no-op)', () => {
  it('returns inputs unchanged for base "/"', async () => {
    const { withBase, rebaseAssetStrings } = await load('/');
    expect(withBase('/assets/a.png')).toBe('/assets/a.png');
    const j = { a: '/assets/x.gif', b: ['/assets/y'] };
    expect(rebaseAssetStrings(j)).toEqual(j);
  });
});

describe('base-url under /fourcee-template/', () => {
  it('prefixes root-relative paths only', async () => {
    const { withBase } = await load('/fourcee-template/');
    expect(withBase('/assets/a.png')).toBe('/fourcee-template/assets/a.png');
    expect(withBase('/draco/gltf/')).toBe('/fourcee-template/draco/gltf/');
    expect(withBase('https://x.test/a.png')).toBe('https://x.test/a.png');
    expect(withBase('//cdn.test/a.png')).toBe('//cdn.test/a.png');
    expect(withBase('data:image/png;base64,AA')).toBe('data:image/png;base64,AA');
    expect(withBase('relative/a.png')).toBe('relative/a.png');
  });
  it('does not double-prefix', async () => {
    const { withBase } = await load('/fourcee-template/');
    expect(withBase('/fourcee-template/assets/a.png')).toBe('/fourcee-template/assets/a.png');
  });
  it('rebases /assets/ strings deep inside content.json, leaves others', async () => {
    const { rebaseAssetStrings } = await load('/fourcee-template/');
    const out = rebaseAssetStrings({ business: { logoUrl: '/assets/logo.png', site: 'https://x.test/' }, list: ['/assets/1.jpg', 'text', 3], n: null });
    expect(out).toEqual({ business: { logoUrl: '/fourcee-template/assets/logo.png', site: 'https://x.test/' }, list: ['/fourcee-template/assets/1.jpg', 'text', 3], n: null });
  });
  it('AR asset URLs follow the base', async () => {
    vi.stubEnv('BASE_URL', '/fourcee-template/'); vi.resetModules();
    const ar = await import('../lib/ar-assets');
    expect(ar.arGlbUrl('platinum')).toBe('/fourcee-template/assets/ar/ring-platinum.glb');
    expect(ar.arUsdzUrl('rose-gold')).toBe('/fourcee-template/assets/ar/ring-rose-gold.usdz');
    expect(ar.HAND_MODEL_URL).toBe('/fourcee-template/ar/hand_landmarker.task');
    expect(ar.MEDIAPIPE_WASM_URL).toBe('/fourcee-template/mediapipe/wasm');
  });
});
