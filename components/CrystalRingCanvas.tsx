import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';

const RING_URL = '/assets/3D/ring_webgi.glb';
const DRACO_PATH = '/draco/gltf/';

type Vec3 = [number, number, number];

/** Camera / ring keys from VikasRana10/3D-app Crystal-Jewels (ringModel == 1). */
const SCROLL_KEYS: { pos: Vec3; target: Vec3; rot: Vec3 }[] = [
  { pos: [1.28, -1.7, 5.86], target: [0.91, 0.03, -0.25], rot: [0, 0, 0] },
  { pos: [-1.83, -0.14, 6.15], target: [-0.78, -0.03, -0.12], rot: [0, 0, Math.PI / 2] },
  { pos: [-0.06, -1.15, 4.42], target: [-0.01, 0.9, 0.07], rot: [0, 0, -Math.PI / 2] },
  { pos: [-0.17, -0.25, 8.5], target: [0, 0, 0], rot: [-Math.PI / 2, 0, -Math.PI / 2] },
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function sampleScroll(progress: number) {
  const clamped = Math.min(1, Math.max(0, progress));
  const scaled = clamped * (SCROLL_KEYS.length - 1);
  const i = Math.min(SCROLL_KEYS.length - 2, Math.floor(scaled));
  const t = scaled - i;
  const from = SCROLL_KEYS[i];
  const to = SCROLL_KEYS[i + 1];
  return {
    pos: lerpVec(from.pos, to.pos, t),
    target: lerpVec(from.target, to.target, t),
    rot: lerpVec(from.rot, to.rot, t),
  };
}

function classifyMesh(name: string) {
  const n = name.toLowerCase();
  if (n.includes('diamond') || n.includes('gem') || n === 'object') return 'gem';
  if (n.includes('gold') || n.includes('entourage') || n.includes('yellow')) return 'gold';
  if (n.includes('silver') || n.includes('alliance') || n.includes('white') || n.includes('plat')) {
    return 'silver';
  }
  return 'other';
}

function isPaleMetal(hex: string) {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.62;
}

function makeMetalMaterial(hex: string) {
  return new THREE.MeshStandardMaterial({
    color: hex,
    metalness: 1,
    roughness: 0.14,
    envMapIntensity: 1.35,
  });
}

function makeGemMaterial(hex: string) {
  return new THREE.MeshPhysicalMaterial({
    color: hex,
    metalness: 0,
    roughness: 0.04,
    transmission: 0.72,
    thickness: 0.55,
    ior: 2.4,
    reflectivity: 0.55,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    attenuationColor: hex,
    attenuationDistance: 0.85,
    envMapIntensity: 1.2,
  });
}

function applyHex(mesh: THREE.Mesh, hex: string) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mats.forEach((mat) => {
    if ('color' in mat && mat.color instanceof THREE.Color) {
      mat.color.set(hex);
    }
    if ('attenuationColor' in mat && (mat as THREE.MeshPhysicalMaterial).attenuationColor) {
      (mat as THREE.MeshPhysicalMaterial).attenuationColor.set(hex);
    }
  });
}

interface CrystalRingCanvasProps {
  metalColor: string;
  gemColor: string;
  mode?: 'scroll' | 'orbit';
  scrollRoot?: React.RefObject<HTMLElement | null>;
  className?: string;
}

export const CrystalRingCanvas: React.FC<CrystalRingCanvasProps> = ({
  metalColor,
  gemColor,
  mode = 'orbit',
  scrollRoot,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const metalColorRef = useRef(metalColor);
  const gemColorRef = useRef(gemColor);
  const applyMaterialsRef = useRef<() => void>(() => {});
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  metalColorRef.current = metalColor;
  gemColorRef.current = gemColor;

  useEffect(() => {
    applyMaterialsRef.current();
  }, [metalColor, gemColor]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let cancelled = false;
    setLoadState('loading');

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 280;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(mode === 'scroll' ? 25 : 28, width / height, 0.08, 80);
    if (mode === 'scroll') {
      camera.position.set(...SCROLL_KEYS[0].pos);
      camera.lookAt(...SCROLL_KEYS[0].target);
    } else {
      camera.position.set(1.55, 1.15, 2.05);
      camera.lookAt(0, 0.08, 0);
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // No WebGL (blocked / unsupported): skip the decorative 3D instead of crashing the whole app.
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();

    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(2.6, 3.4, 2.4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xe8e8e8, 0.85);
    fill.position.set(-2.4, 0.9, 1.8);
    scene.add(fill);
    const rim = new THREE.PointLight(0xffffff, 0.9, 12);
    rim.position.set(0.1, 1.4, 1.2);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.18));

    const root = new THREE.Group();
    scene.add(root);

    const buckets = {
      gold: [] as THREE.Mesh[],
      silver: [] as THREE.Mesh[],
      gem: [] as THREE.Mesh[],
    };

    const paint = () => {
      const metal = metalColorRef.current;
      const accent = isPaleMetal(metal) ? metal : '#f3f1ec';
      buckets.gold.forEach((mesh) => applyHex(mesh, metal));
      buckets.silver.forEach((mesh) => applyHex(mesh, accent));
      buckets.gem.forEach((mesh) => applyHex(mesh, gemColorRef.current));
    };
    applyMaterialsRef.current = paint;

    const indexMeshes = (group: THREE.Object3D) => {
      group.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        const kind = classifyMesh(obj.name);
        if (kind === 'gem') {
          obj.material = makeGemMaterial(gemColorRef.current);
          buckets.gem.push(obj);
        } else if (kind === 'gold') {
          obj.material = makeMetalMaterial(metalColorRef.current);
          buckets.gold.push(obj);
        } else if (kind === 'silver') {
          obj.material = makeMetalMaterial('#f3f1ec');
          buckets.silver.push(obj);
        }
      });
      paint();
    };

    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_PATH);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    loader.load(
      RING_URL,
      (gltf) => {
        if (cancelled) return;
        const model = gltf.scene;
        if (mode === 'orbit') {
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3()).length();
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);
          model.scale.setScalar(2.55 / Math.max(size, 0.001));
        }
        root.add(model);
        indexMeshes(model);
        setLoadState('ready');
      },
      undefined,
      (err) => {
        console.error('[CrystalRingCanvas] GLB load failed', err);
        if (!cancelled) setLoadState('error');
      }
    );

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let orbitY = mode === 'scroll' ? 0 : -0.45;
    let orbitX = 0;
    if (mode !== 'scroll') root.rotation.y = orbitY;

    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      renderer.domElement.style.cursor = 'grabbing';
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      renderer.domElement.style.cursor = 'grab';
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      orbitY += (event.clientX - lastX) * 0.01;
      orbitX += (event.clientY - lastY) * 0.006;
      orbitX = Math.max(-0.6, Math.min(0.6, orbitX));
      lastX = event.clientX;
      lastY = event.clientY;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (mode === 'scroll' && scrollRoot?.current) {
        const el = scrollRoot.current;
        const max = Math.max(1, el.scrollHeight - window.innerHeight);
        const progress = Math.min(1, Math.max(0, -el.getBoundingClientRect().top / max));
        const sample = sampleScroll(progress);
        camera.position.set(...sample.pos);
        camera.lookAt(sample.target[0], sample.target[1], sample.target[2]);
        if (!dragging) {
          root.rotation.set(sample.rot[0], sample.rot[1], sample.rot[2]);
        } else {
          root.rotation.y = orbitY;
          root.rotation.x = orbitX;
        }
      } else {
        if (!dragging) orbitY += 0.004;
        root.rotation.y = orbitY;
        root.rotation.x = orbitX + Math.sin(performance.now() / 2600) * 0.05;
      }
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const nextW = container.clientWidth || width;
      const nextH = container.clientHeight || height;
      camera.aspect = nextW / nextH;
      camera.updateProjectionMatrix();
      renderer.setSize(nextW, nextH);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      draco.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((mat) => mat.dispose());
        }
      });
      pmrem.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [mode, scrollRoot]);

  return (
    <div className={`relative ${className}`} style={{ width: '100%', height: '100%' }}>
      <div
        ref={mountRef}
        style={{ touchAction: 'none', cursor: 'grab', width: '100%', height: '100%' }}
        role="img"
        aria-label="Interactive 3D ring. Drag to rotate."
      />
      {loadState === 'loading' ? (
        <p className="pointer-events-none absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#b6b6b6]">
          Loading ring
        </p>
      ) : null}
      {loadState === 'error' ? (
        <p className="pointer-events-none absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-300">
          Ring mesh failed
        </p>
      ) : null}
    </div>
  );
};
