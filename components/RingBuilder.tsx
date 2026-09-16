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
    gemRef.current?.color.set(gem.color);
  }, [metal.color, gem.color]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 280;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 50);
    camera.position.set(0.15, 0.55, 3.1);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 1.25 : 1.75));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    const key = new THREE.DirectionalLight(0xfff4e0, 2.1);
    key.position.set(2.4, 3.2, 2.6);
    scene.add(key);
    const ice = new THREE.DirectionalLight(0xdbe7f3, 1.1);
    ice.position.set(-2.2, 0.8, 1.6);
    scene.add(ice);
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    const metalMat = new THREE.MeshStandardMaterial({
      color: metal.color,
      metalness: 1,
      roughness: 0.18,
    });
    const gemMat = new THREE.MeshPhysicalMaterial({
      color: gem.color,
      metalness: 0.05,
      roughness: 0.04,
      transmission: 0.55,
      thickness: 0.6,
      ior: 2.4,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    });
    metalRef.current = metalMat;
    gemRef.current = gemMat;

    const group = new THREE.Group();
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.14, 32, 80), metalMat);
    band.rotation.x = Math.PI / 2.15;
    group.add(band);

    const setting = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 12), metalMat);
    setting.position.y = 0.68;
    group.add(setting);

    const stone = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), gemMat);
    stone.position.y = 0.92;
    stone.rotation.y = Math.PI / 4;
    group.add(stone);

    for (let i = 0; i < 6; i += 1) {
      const accent = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), gemMat);
      const angle = (i / 6) * Math.PI * 2;
      accent.position.set(Math.cos(angle) * 0.34, 0.74, Math.sin(angle) * 0.18);
      group.add(accent);
    }

    scene.add(group);

    let frame = 0;
    let dragging = false;
    let lastX = 0;
    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
    };
    const onPointerUp = () => {
      dragging = false;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      group.rotation.y += (event.clientX - lastX) * 0.01;
      lastX = event.clientX;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointermove', onPointerMove);

    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (!dragging) group.rotation.y += 0.006;
      group.rotation.x = Math.sin(performance.now() / 2400) * 0.08;
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
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.dispose();
      band.geometry.dispose();
      setting.geometry.dispose();
      stone.geometry.dispose();
      metalMat.dispose();
      gemMat.dispose();
      container.removeChild(renderer.domElement);
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
          className={`relative w-full overflow-hidden rounded-2xl ${
            compact ? 'h-[220px]' : 'h-[280px] md:h-[360px] lg:max-w-[52%]'
          } ${isDarkMode ? 'bg-gradient-to-b from-white/[0.04] to-transparent' : 'bg-gradient-to-b from-white to-[#f3ead6]'}`}
          aria-label="Interactive ring preview"
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
          <div className="mt-5">
            <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-500' : 'text-navy-500'}`}>
              Metal
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {config.metals.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMetalId(item.id)}
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
            <div className="mt-2 flex flex-wrap gap-2">
              {config.gems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setGemId(item.id)}
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

export const LazyRingBuilderSection: React.FC<RingBuilderProps> = (props) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '160px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="min-h-[240px]">
      {visible ? (
        <React.Suspense
          fallback={
            <div className={`rounded-[2rem] border px-6 py-16 text-center text-xs uppercase tracking-[0.22em] ${
              props.isDarkMode ? 'border-white/10 text-slate-500' : 'border-navy-200 text-navy-500'
            }`}>
              Loading studio
            </div>
          }
        >
          <RingBuilder {...props} />
        </React.Suspense>
      ) : (
        <div className={`rounded-[2rem] border px-6 py-16 text-center text-xs uppercase tracking-[0.22em] ${
          props.isDarkMode ? 'border-white/10 text-slate-500' : 'border-navy-200 text-navy-500'
        }`}>
          Ring studio on approach
        </div>
      )}
    </div>
  );
};
