import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const RING_URL = '/assets/3D/ring_webgi.glb';

type Vec3 = [number, number, number];

const SCROLL_KEYS: { pos: Vec3; target: Vec3; rot: Vec3 }[] = [
  { pos: [1.28, -1.7, 5.86], target: [0.91, 0.03, -0.25], rot: [0, 0, 0] },
  { pos: [-1.83, -0.14, 6.15], target: [-0.78, -0.03, -0.12], rot: [0, 0, Math.PI / 2] },
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

function classifyMesh(name: string, material: THREE.Material | THREE.Material[]) {
  const n = name.toLowerCase();
  if (n.includes('diamond') || n.includes('gem') || n === 'object') return 'gem';
  if (n.includes('gold') || n.includes('entourage') || n.includes('yellow')) return 'gold';
  if (n.includes('silver') || n.includes('alliance') || n.includes('white') || n.includes('plat')) return 'silver';
  const mats = Array.isArray(material) ? material : [material];
  const metal = mats.find((m) => 'metalness' in m && (m as THREE.MeshStandardMaterial).metalness > 0.5);
  return metal ? 'metal' : 'other';
}

function applyColor(mesh: THREE.Mesh, hex: string) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mats.forEach((mat) => {
    if ('color' in mat && mat.color instanceof THREE.Color) {
      mat.color.set(hex);
    }
  });
}

function buildFallbackRing(metalHex: string, gemHex: string) {
  const group = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({ color: metalHex, metalness: 1, roughness: 0.16 });
  const gemMat = new THREE.MeshPhysicalMaterial({
    color: gemHex,
    metalness: 0.04,
    roughness: 0.03,
    transmission: 0.62,
    thickness: 0.55,
    ior: 2.4,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
  });
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.13, 40, 96), metalMat);
  band.rotation.x = Math.PI / 2.35;
  band.name = 'gold';
  group.add(band);
  const stone = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 1), gemMat);
  stone.position.y = 0.94;
  stone.name = 'diamonds';
  group.add(stone);
  return group;
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

  metalColorRef.current = metalColor;
  gemColorRef.current = gemColor;

  useEffect(() => {
    applyMaterialsRef.current();
  }, [metalColor, gemColor]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 280;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(mode === 'scroll' ? 32 : 28, width / height, 0.1, 80);
    camera.position.set(1.55, 1.35, 2.15);
    camera.lookAt(0, 0.2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const key = new THREE.DirectionalLight(0xfff4e0, 2.1);
    key.position.set(2.6, 3.4, 2.4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdbe7f3, 1.1);
    fill.position.set(-2.4, 0.9, 1.8);
    scene.add(fill);
    const rim = new THREE.PointLight(0xffffff, 1.3, 10);
    rim.position.set(0.1, 1.4, 1.2);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.32));

    const root = new THREE.Group();
    scene.add(root);

    const buckets = {
      gold: [] as THREE.Mesh[],
      silver: [] as THREE.Mesh[],
      metal: [] as THREE.Mesh[],
      gem: [] as THREE.Mesh[],
    };

    const paint = () => {
      buckets.gold.forEach((mesh) => applyColor(mesh, metalColorRef.current));
      buckets.silver.forEach((mesh) => applyColor(mesh, metalColorRef.current));
      buckets.metal.forEach((mesh) => applyColor(mesh, metalColorRef.current));
      buckets.gem.forEach((mesh) => applyColor(mesh, gemColorRef.current));
    };
    applyMaterialsRef.current = paint;

    const indexMeshes = (group: THREE.Object3D) => {
      group.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        const kind = classifyMesh(obj.name, obj.material);
        if (kind === 'gem') buckets.gem.push(obj);
        else if (kind === 'gold') buckets.gold.push(obj);
        else if (kind === 'silver') buckets.silver.push(obj);
        else if (kind === 'metal') buckets.metal.push(obj);
      });
      paint();
    };

    const loader = new GLTFLoader();
    loader.load(
      RING_URL,
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3()).length();
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        const scale = 2.4 / Math.max(size, 0.001);
        model.scale.setScalar(scale);
        root.add(model);
        indexMeshes(model);
      },
      undefined,
      () => {
        const fallback = buildFallbackRing(metalColorRef.current, gemColorRef.current);
        root.add(fallback);
        indexMeshes(fallback);
      }
    );

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let orbitY = -0.45;
    let orbitX = 0;
    root.rotation.y = orbitY;

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
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [mode, scrollRoot]);

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ touchAction: 'none', cursor: 'grab', width: '100%', height: '100%' }}
      aria-label="Interactive 3D ring. Drag to rotate."
    />
  );
};
