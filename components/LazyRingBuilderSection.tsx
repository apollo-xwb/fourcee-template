import React, { useEffect, useRef, useState } from 'react';
import type { RingBuilderConfig } from '../types/audit';

const RingStudio = React.lazy(() =>
  import('./RingBuilder').then((mod) => ({ default: mod.RingBuilder }))
);

interface LazyRingBuilderSectionProps {
  config: Required<RingBuilderConfig>;
  isDarkMode?: boolean;
  compact?: boolean;
  businessName?: string;
}

/**
 * Defers the Three.js studio until the section is near the viewport.
 * Three is already used elsewhere in the template; this still avoids a second
 * WebGL context and the studio module until a jeweler scrolls to it.
 */
export const LazyRingBuilderSection: React.FC<LazyRingBuilderSectionProps> = (props) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    // QR / share deep link (?ring=…&ar=1|tryon=1): mount the studio straight away and bring it into view,
    // otherwise the AR / try-on sheet would only open after the visitor happened to scroll here.
    const q = new URLSearchParams(window.location.search);
    if (q.has('ring') && (q.get('ar') === '1' || q.get('tryon') === '1')) {
      setVisible(true);
      window.setTimeout(() => node.scrollIntoView({ block: 'start' }), 400);
      return;
    }
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

  const placeholderClass = `rounded-[2rem] border px-6 py-16 text-center text-xs uppercase tracking-[0.22em] ${
    props.isDarkMode ? 'border-white/10 text-neutral-300' : 'border-navy-200 text-neutral-700'
  }`;

  return (
    <div ref={hostRef} className="min-h-[240px]">
      {visible ? (
        <React.Suspense fallback={<div className={placeholderClass}>Loading studio</div>}>
          <RingStudio {...props} />
        </React.Suspense>
      ) : (
        <div className={placeholderClass}>Ring studio on approach</div>
      )}
    </div>
  );
};
