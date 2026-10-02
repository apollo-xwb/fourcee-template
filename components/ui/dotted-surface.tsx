'use client';

import { cn } from '@/lib/utils';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type DottedSurfaceProps = React.ComponentPropsWithoutRef<'div'> & {
	/** true = white dots (dark mode), false = smooth black dots (light / beige) */
	isDarkMode?: boolean;
};

const SEPARATION = 100;
const AMOUNTX = 30;
const AMOUNTY = 28;

export function DottedSurface({ className, isDarkMode = false, ...props }: DottedSurfaceProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const rafIdRef = useRef<number>(0);
	const visibleRef = useRef(true);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const w = Math.max(container.clientWidth, 200);
		const h = Math.max(container.clientHeight, 200);

		const scene = new THREE.Scene();
		scene.fog = new THREE.Fog(isDarkMode ? 0x050504 : 0xfaf5ea, 1800, 9200);

		const camera = new THREE.PerspectiveCamera(55, w / h, 1, 10000);
		camera.position.set(0, 260, 960);
		camera.lookAt(0, 0, 0);

		const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(w, h);
		renderer.setClearColor(0x000000, 0);

		container.appendChild(renderer.domElement);
		renderer.domElement.style.display = 'block';
		renderer.domElement.style.width = '100%';
		renderer.domElement.style.height = '100%';

		const positions: number[] = [];
		const colors: number[] = [];
		for (let ix = 0; ix < AMOUNTX; ix++) {
			for (let iy = 0; iy < AMOUNTY; iy++) {
				positions.push(
					ix * SEPARATION - (AMOUNTX * SEPARATION) / 2,
					0,
					iy * SEPARATION - (AMOUNTY * SEPARATION) / 2
				);
				if (isDarkMode) {
					colors.push(1, 1, 1);
				} else {
					colors.push(0.04, 0.035, 0.03);
				}
			}
		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
		geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

		const material = new THREE.PointsMaterial({
			size: isDarkMode ? 9 : 14,
			vertexColors: true,
			transparent: true,
			opacity: isDarkMode ? 0.88 : 0.9,
			sizeAttenuation: true,
			depthWrite: false,
		});

		const points = new THREE.Points(geometry, material);
		scene.add(points);

		let count = 0;
		const positionAttr = geometry.attributes.position;
		const posArray = positionAttr.array as Float32Array;

		const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
		const animate = () => {
			if (!reduceMotion) rafIdRef.current = requestAnimationFrame(animate);
			// Stay mounted + painted: skip sim when offscreen, still keep canvas
			if (!visibleRef.current) return;
			let i = 0;
			for (let ix = 0; ix < AMOUNTX; ix++) {
				for (let iy = 0; iy < AMOUNTY; iy++) {
					posArray[i * 3 + 1] =
						Math.sin((ix + count) * 0.22) * 42 + Math.sin((iy + count) * 0.35) * 42;
					i++;
				}
			}
			positionAttr.needsUpdate = true;
			renderer.render(scene, camera);
			count += 0.055;
		};
		animate();

		const onResize = () => {
			if (!containerRef.current) return;
			const nw = Math.max(containerRef.current.clientWidth, 200);
			const nh = Math.max(containerRef.current.clientHeight, 200);
			camera.aspect = nw / nh;
			camera.updateProjectionMatrix();
			renderer.setSize(nw, nh);
		};
		window.addEventListener('resize', onResize);

		// Pause work when offscreen — NEVER dispose (dispose/recreate = flash on fast scroll)
		const io = new IntersectionObserver(
			([entry]) => {
				visibleRef.current = entry.isIntersecting;
				if (entry.isIntersecting) {
					renderer.render(scene, camera);
				}
			},
			{ rootMargin: '80px 0px', threshold: 0 }
		);
		io.observe(container);

		return () => {
			io.disconnect();
			window.removeEventListener('resize', onResize);
			cancelAnimationFrame(rafIdRef.current);
			geometry.dispose();
			material.dispose();
			renderer.dispose();
			if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
		};
	}, [isDarkMode]);

	return (
		<div
			ref={containerRef}
			className={cn('pointer-events-none absolute inset-0', className)}
			aria-hidden
			{...props}
		/>
	);
}
