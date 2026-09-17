import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { RingBuilderConfig, RingSwatch } from '../types/audit';

interface RingBuilderProps {
  config: Required<RingBuilderConfig>;
  isDarkMode?: boolean;
  compact?: boolean;
  businessName?: string;
}

function findSwatch(list: RingSwatch[], id: string, fallback: RingSwatch): RingSwatch {
  return list.find((item) => item.id === id) ?? fallback;
}

function metalParams(color: string) {
  const hex = color.toLowerCase();
  if (hex.includes('c9a08a') || hex.includes('e8b4')) {
    return { metalness: 1, roughness: 0.22 };
  }
  if (hex.includes('e8eef4') || hex.includes('c2ccd6')) {
    return { metalness: 1, roughness: 0.12 };
  }
  return { metalness: 1, roughness: 0.16 };
}

export const RingBuilder: React.FC<RingBuilderProps> = ({
  config,
  isDarkMode = true,
  compact = false,
  businessName,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const metalRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const gemRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const [metalId, setMetalId] = useState(config.defaultMetalId);
  const [gemId, setGemId] = useState(config.defaultGemId);

  const metal = useMemo(
    () => findSwatch(config.metals, metalId, config.metals[0]),
    [config.metals, metalId]
  );
  const gem = useMemo(
    () => findSwatch(config.gems, gemId, config.gems[0]),
    [config.gems, gemId]
  );

  useEffect(() => {
    metalRef.current?.color.set(metal.color);
    const shine = metalParams(metal.color);
    if (metalRef.current) {
      metalRef.current.metalness = shine.metalness;
      metalRef.current.roughness = shine.roughness;
    }
    gemRef.current?.color.set(gem.color);
    if (gemRef.current) {
      const isDiamond = gem.id === 'diamond' || gem.color.toLowerCase().includes('f4fbff');
      gemRef.current.transmission = isDiamond ? 0.72 : 0.35;
      gemRef.current.ior = isDiamond ? 2.42 : 1.77;
    }
  }, [metal.color, gem.color, gem.id]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 280;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 50);
    camera.position.set(0.2, 0.62, 3.35);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 1.2 : 1.6));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const key = new THREE.DirectionalLight(0xfff4e0, 2.2);
    key.position.set(2.6, 3.4, 2.4);
    scene.add(key);
    const ice = new THREE.DirectionalLight(0xdbe7f3, 1.15);
    ice.position.set(-2.4, 0.9, 1.8);
    scene.add(ice);
    const rim = new THREE.PointLight(0xffffff, 1.4, 8);
    rim.position.set(0.1, 1.4, 1.2);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.28));

    const metalMat = new THREE.MeshStandardMaterial({
      color: metal.color,
      metalness: 1,
      roughness: 0.16,
    });
    const gemMat = new THREE.MeshPhysicalMaterial({
      color: gem.color,
      metalness: 0.04,
      roughness: 0.03,
      transmission: 0.62,
      thickness: 0.55,
      ior: 2.4,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
    });
    metalRef.current = metalMat;
    gemRef.current = gemMat;

    const group = new THREE.Group();
    const geometries: THREE.BufferGeometry[] = [];

    const band = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.13, 40, 96), metalMat);
    band.rotation.x = Math.PI / 2.12;
    group.add(band);
    geometries.push(band.geometry);

    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.045, 16, 64), metalMat);
    inner.rotation.x = Math.PI / 2.12;
    inner.scale.set(1, 1, 0.92);
    group.add(inner);
    geometries.push(inner.geometry);

    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.1, 16), metalMat);
    gallery.position.y = 0.7;
    group.add(gallery);
    geometries.push(gallery.geometry);

    for (let i = 0; i < 6; i += 1) {
      const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.2, 8), metalMat);
      const angle = (i / 6) * Math.PI * 2;
      prong.position.set(Math.cos(angle) * 0.16, 0.82, Math.sin(angle) * 0.16);
      prong.rotation.z = Math.cos(angle) * -0.35;
      prong.rotation.x = Math.sin(angle) * 0.35;
      group.add(prong);
      geometries.push(prong.geometry);
    }

    const stone = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 1), gemMat);
    stone.position.y = 0.94;
    stone.rotation.y = Math.PI / 4;
    group.add(stone);
    geometries.push(stone.geometry);

    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.03, 8), gemMat);
    table.position.y = 1.12;
    group.add(table);
    geometries.push(table.geometry);

    for (let i = 0; i < 8; i += 1) {
      const accent = new THREE.Mesh(new THREE.OctahedronGeometry(0.042, 0), gemMat);
      const angle = (i / 8) * Math.PI * 2;
      accent.position.set(Math.cos(angle) * 0.36, 0.72, Math.sin(angle) * 0.16);
      group.add(accent);
      geometries.push(accent.geometry);
    }

    scene.add(group);

    let frame = 0;
    let dragging = false;
    let lastX = 0;
    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragging = true;
      lastX = event.clientX;
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
      event.preventDefault();
      event.stopPropagation();
      group.rotation.y += (event.clientX - lastX) * 0.01;
      lastX = event.clientX;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (!dragging) group.rotation.y += 0.005;
      group.rotation.x = Math.sin(performance.now() / 2600) * 0.07;
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
      geometries.forEach((geo) => geo.dispose());
      metalMat.dispose();
      gemMat.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [compact]);

  return (
    <div
      className={`overflow-hidden rounded-[2rem] border ${
        isDarkMode ? 'border-white/10 bg-black/30' : 'border-navy-200 bg-white/80'
      } ${compact ? 'p-4' : 'p-5 md:p-8'}`}
    >
      <div className={`flex flex-col ${compact ? 'gap-4' : 'gap-6 lg:flex-row lg:items-center'}`}>
        <div
          ref={mountRef}
          className={`relative w-full overflow-hidden rounded-2xl touch-none ${
            compact ? 'h-[220px]' : 'h-[280px] md:h-[360px] lg:max-w-[52%]'
          } ${isDarkMode ? 'bg-gradient-to-b from-white/[0.04] to-transparent' : 'bg-gradient-to-b from-white to-[#f3ead6]'}`}
          style={{ touchAction: 'none', cursor: 'grab' }}
          aria-label="Interactive ring preview. Drag to rotate."
        />
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-bold uppercase tracking-[0.28em] ${isDarkMode ? 'text-sky-200/80' : 'text-navy-500'}`}>
            {businessName ? `${businessName} · ` : ''}Configurator
          </p>
          <h3 className={`mt-2 text-xl font-semibold md:text-3xl ${isDarkMode ? 'text-white' : 'text-navy-900'}`}>
            {config.headline}
          </h3>
          <p className={`mt-2 text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-navy-700'}`}>
            {config.subhead}
          </p>
          <p className={`mt-3 text-xs ${isDarkMode ? 'text-slate-400' : 'text-navy-600'}`}>
            Showing {metal.label} · {gem.label}
          </p>
          <div className="mt-5">
            <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-500' : 'text-navy-500'}`}>
              Metal
            </p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Metal">
              {config.metals.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMetalId(item.id)}
                  aria-pressed={metalId === item.id}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] ${
                    metalId === item.id
                      ? isDarkMode
                        ? 'border-amber-300/50 bg-white/10 text-white'
                        : 'border-navy-900 bg-navy-900 text-white'
                      : isDarkMode
                        ? 'border-white/15 text-slate-300'
                        : 'border-navy-200 text-navy-700'
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full border border-white/30" style={{ background: item.color }} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-500' : 'text-navy-500'}`}>
              Center stone
            </p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Center stone">
              {config.gems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setGemId(item.id)}
                  aria-pressed={gemId === item.id}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] ${
                    gemId === item.id
                      ? isDarkMode
                        ? 'border-sky-300/40 bg-white/10 text-white'
                        : 'border-navy-900 bg-navy-900 text-white'
                      : isDarkMode
                        ? 'border-white/15 text-slate-300'
                        : 'border-navy-200 text-navy-700'
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full border border-white/30" style={{ background: item.color }} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
