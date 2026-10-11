import { useEffect, useState, type ComponentType } from 'react';
import type { HeroFieldProps } from './HeroField';
import type { CountUp, PressButton, Reveal, StaggerWords } from './motion-polish';

export type MotionPolish = {
  Reveal: typeof Reveal;
  StaggerWords: typeof StaggerWords;
  CountUp: typeof CountUp;
  PressButton: typeof PressButton;
};

/**
 * Landing-only chrome. Both chunks stay dynamic so a direct #/audit visit never requests them.
 * The hero module waits until the browser is idle, after first paint.
 */
export function useHeroField(): ComponentType<HeroFieldProps> | null {
  const [Comp, setComp] = useState<ComponentType<HeroFieldProps> | null>(null);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let live = true;
    const start = () => {
      void import('./HeroField').then((m) => {
        if (live) setComp(() => m.HeroField);
      });
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let cancel = () => {};
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(start, { timeout: 1600 });
      cancel = () => w.cancelIdleCallback?.(id);
    } else {
      const id = window.setTimeout(start, 450);
      cancel = () => window.clearTimeout(id);
    }
    return () => {
      live = false;
      cancel();
    };
  }, []);
  return Comp;
}

export function useMotionPolish(): MotionPolish | null {
  const [mod, setMod] = useState<MotionPolish | null>(null);
  useEffect(() => {
    let live = true;
    void import('./motion-polish').then((m) => {
      if (!live) return;
      setMod({
        Reveal: m.Reveal,
        StaggerWords: m.StaggerWords,
        CountUp: m.CountUp,
        PressButton: m.PressButton,
      });
    });
    return () => {
      live = false;
    };
  }, []);
  return mod;
}
