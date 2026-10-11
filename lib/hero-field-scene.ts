import * as THREE from 'three';
import { heroPixelRatio } from './hero-field-budget';

/**
 * One shared WebGL context for every hero-field instance (hero + accent).
 * The phone homepage already budgets at most three live contexts (ring, dotted wave, this).
 * Rendering pauses when every instance is offscreen or the tab is hidden. DPR is capped at 2.
 */

export interface MountOpts {
  variant: 'hero' | 'accent';
  onReady?: () => void;
}

interface FieldInstance {
  canvas: HTMLCanvasElement;
  variant: 'hero' | 'accent';
  host: HTMLElement;
  visible: boolean;
  pointer: { x: number; y: number };
  pointerTarget: { x: number; y: number };
  scroll: number;
  ready: boolean;
  onReady?: () => void;
}

const instances = new Set<FieldInstance>();
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.OrthographicCamera | null = null;
let material: THREE.ShaderMaterial | null = null;
let raf = 0;
let failed = false;

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = `
varying vec2 vUv;
uniform float uTime;
uniform vec2 uPointer;
uniform float uScroll;
uniform float uAccent;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  vec2 uv = vUv;
  vec2 p = uv * 2.2 + uPointer * 0.12;
  p.y += uScroll * 0.15;
  float t = uTime * 0.07;
  float n = noise(p + t);
  float n2 = noise(p * 1.8 - t * 1.2 + 3.0);
  float n3 = noise(p * 3.4 + vec2(t * 0.4, -t));
  vec3 cream = vec3(0.980, 0.961, 0.918);
  vec3 gold = vec3(0.784, 0.710, 0.561);
  vec3 copper = vec3(0.541, 0.451, 0.286);
  vec3 ink = vec3(0.047, 0.043, 0.035);
  vec3 col = mix(cream, gold, smoothstep(0.25, 0.85, n));
  col = mix(col, copper, smoothstep(0.45, 0.9, n2) * 0.55);
  float filament = smoothstep(0.62, 0.78, n3) * (1.0 - smoothstep(0.78, 0.9, n3));
  col += gold * filament * 0.35;
  float vignette = smoothstep(1.15, 0.25, length(uv - 0.5));
  col = mix(cream, col, 0.82 * vignette);
  float alpha = 0.92;
  if (uAccent > 0.5) {
    vec3 dark = mix(ink, copper, smoothstep(0.2, 0.9, n2));
    dark = mix(dark, gold, filament * 0.85 + smoothstep(0.55, 1.0, n) * 0.25);
    col = dark;
    alpha = 0.72 * vignette;
  }
  gl_FragColor = vec4(col, alpha);
}
`;

function ensure(): boolean {
  if (renderer || failed) return !!renderer;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
      failIfMajorPerformanceCaveat: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) {
      failed = true;
      return false;
    }
    const r = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: false });
    r.setClearColor(0x000000, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPointer: { value: new THREE.Vector2(0, 0) },
        uScroll: { value: 0 },
        uAccent: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const s = new THREE.Scene();
    s.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    renderer = r;
    material = mat;
    scene = s;
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
    return true;
  } catch {
    failed = true;
    return false;
  }
}

function anyVisible() {
  for (const inst of instances) if (inst.visible) return true;
  return false;
}

function draw(inst: FieldInstance, time: number) {
  if (!renderer || !material || !scene || !camera) return;
  const rect = inst.host.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  const dpr = heroPixelRatio(window.devicePixelRatio || 1);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  inst.pointer.x += (inst.pointerTarget.x - inst.pointer.x) * 0.06;
  inst.pointer.y += (inst.pointerTarget.y - inst.pointer.y) * 0.06;
  material.uniforms.uTime.value = time;
  material.uniforms.uPointer.value.set(inst.pointer.x, inst.pointer.y);
  material.uniforms.uScroll.value = inst.scroll;
  material.uniforms.uAccent.value = inst.variant === 'accent' ? 1 : 0;
  renderer.render(scene, camera);
  const ctx = inst.canvas.getContext('2d');
  if (!ctx) return;
  const bw = Math.round(w * dpr);
  const bh = Math.round(h * dpr);
  if (inst.canvas.width !== bw || inst.canvas.height !== bh) {
    inst.canvas.width = bw;
    inst.canvas.height = bh;
  }
  ctx.clearRect(0, 0, bw, bh);
  ctx.drawImage(renderer.domElement, 0, 0, bw, bh);
  if (!inst.ready) {
    inst.ready = true;
    inst.onReady?.();
    inst.onReady = undefined;
  }
}

function frame(now: number) {
  raf = 0;
  if (document.hidden || !anyVisible()) return;
  const time = now * 0.001;
  for (const inst of instances) {
    if (!inst.visible) continue;
    draw(inst, time);
  }
  raf = requestAnimationFrame(frame);
}

function kick() {
  if (raf || document.hidden || !anyVisible()) return;
  if (!ensure()) return;
  raf = requestAnimationFrame(frame);
}

function scrollOf(host: HTMLElement): number {
  let node: HTMLElement | null = host.parentElement;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if (oy === 'auto' || oy === 'scroll') {
      const max = node.scrollHeight - node.clientHeight;
      return max > 0 ? node.scrollTop / max : 0;
    }
    node = node.parentElement;
  }
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? window.scrollY / max : 0;
}

export function mountHeroField(host: HTMLElement, opts: MountOpts): () => void {
  const canvas = document.createElement('canvas');
  canvas.dataset.testid = opts.variant === 'hero' ? 'hero-field-canvas' : 'section-accent-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
  host.appendChild(canvas);

  const inst: FieldInstance = {
    canvas,
    variant: opts.variant,
    host,
    visible: false,
    pointer: { x: 0, y: 0 },
    pointerTarget: { x: 0, y: 0 },
    scroll: 0,
    ready: false,
    onReady: opts.onReady,
  };
  instances.add(inst);

  const io = new IntersectionObserver(([entry]) => {
    inst.visible = entry.isIntersecting && entry.intersectionRatio > 0.02;
    if (inst.visible) kick();
  }, { threshold: [0, 0.02, 0.2] });
  io.observe(host);

  const onVis = () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      return;
    }
    kick();
  };
  document.addEventListener('visibilitychange', onVis);

  const onPointer = (ev: PointerEvent) => {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    inst.pointerTarget.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    inst.pointerTarget.y = ((ev.clientY - r.top) / r.height) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  let scrollParent: HTMLElement | Window = window;
  let node: HTMLElement | null = host.parentElement;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if (oy === 'auto' || oy === 'scroll') {
      scrollParent = node;
      break;
    }
    node = node.parentElement;
  }
  const onScroll = () => {
    inst.scroll = scrollOf(host);
  };
  scrollParent.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    instances.delete(inst);
    io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pointermove', onPointer);
    scrollParent.removeEventListener('scroll', onScroll);
    canvas.remove();
    if (!instances.size) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}
