import React, { useEffect, useRef } from 'react';

/**
 * Page fade between hash views. The first view paints at full opacity (LCP stays on the text/poster).
 * Framer Motion is imported only after a later navigation, so the audit page's first load does not
 * request it from this wrapper. Reduced motion is an opacity fade with no transform.
 */
export function ViewFade({ viewKey, children }: { viewKey: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const skip = useRef(true);

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    el.style.opacity = '0';
    let cancel = false;
    void import('framer-motion').then(({ animate }) => {
      if (cancel || !ref.current) return;
      animate(ref.current, { opacity: 1 }, { duration: reduce ? 0.18 : 0.45, ease: [0.22, 1, 0.36, 1] });
    });
    return () => {
      cancel = true;
    };
  }, [viewKey]);

  return (
    <div ref={ref} className="fc-view">
      {children}
    </div>
  );
}
