import { useEffect, useRef } from 'react';
import { heroMayAnimate } from '../lib/hero-field-budget';

export interface HeroFieldProps {
  variant?: 'hero' | 'accent';
}

/**
 * Canvas layer only. The CSS poster is a sibling that stays on top until the first frame.
 * three.js is a dynamic import so it is not in the initial bundle. Reduced motion never imports it.
 */
export function HeroField({ variant = 'hero' }: HeroFieldProps) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!heroMayAnimate(reduced)) return;
    let dead = false;
    let stop = () => {};
    void import('../lib/hero-field-scene').then((mod) => {
      if (dead || !host.current) return;
      stop = mod.mountHeroField(host.current, {
        variant,
        onReady: () => {
          host.current?.parentElement?.querySelector('[data-mesh-poster]')?.setAttribute('data-ready', '1');
        },
      });
    });
    return () => {
      dead = true;
      stop();
    };
  }, [variant]);

  return <div ref={host} className="absolute inset-0" data-hero-layer={variant} />;
}
