import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';

/**
 * libraries.dev effects (MIT, npm): border-beam, thinking-orbs.
 * Each is code-split and mounted only when its host is within ~400px of the viewport,
 * so none of it touches the first screen or the LCP budget.
 */
const LazyBeam = lazy(() => import('border-beam').then((m) => ({ default: m.BorderBeam })));
const LazyOrb = lazy(() => import('thinking-orbs').then((m) => ({ default: m.ThinkingOrb })));

function useNear<T extends Element>(margin = '400px') {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [near, margin]);
  return [ref, near] as const;
}

/** Hairline light that travels the edge of its positioned parent (overlay; never re-mounts the content). */
export const EdgeBeam: React.FC<{ radiusClass: string; size?: 'line' | 'md' | 'sm'; theme?: 'light' | 'dark'; strength?: number; duration?: number; testId?: string }> = ({ radiusClass, size = 'md', theme = 'light', strength = 0.7, duration, testId }) => {
  const [ref, near] = useNear<HTMLDivElement>();
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-[3]" data-testid={testId}>
      {near && (
        <Suspense fallback={null}>
          <LazyBeam size={size} colorVariant="gold" staticColors theme={theme} strength={strength} duration={duration} style={{ width: '100%', height: '100%', display: 'block' }}>
            <div className={`h-full w-full ${radiusClass}`} />
          </LazyBeam>
        </Suspense>
      )}
    </div>
  );
};

/** Small dotted "listening" orb for the call-me button. */
export const ListeningOrb: React.FC<{ className?: string; theme?: 'light' | 'dark' | 'auto' }> = ({ className, theme = 'auto' }) => {
  const [ref, near] = useNear<HTMLSpanElement>();
  return (
    <span ref={ref} aria-hidden className={`inline-block h-5 w-5 shrink-0 ${className ?? ''}`} data-testid="call-orb">
      {near && (
        <Suspense fallback={null}>
          <LazyOrb state="listening" size={20} theme={theme} aria-hidden="true" />
        </Suspense>
      )}
    </span>
  );
};
