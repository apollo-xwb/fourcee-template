import { useEffect, useRef, useState } from 'react';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Counts up to `value` once. No Framer dependency, so the short page can ship it
 * in the first chunk. The accessible name is the final figure.
 */
export function CountUp({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const reduce = prefersReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const played = useRef(reduce);

  useEffect(() => {
    if (reduce || played.current) {
      setShown(value);
      played.current = true;
      return;
    }
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - t) ** 3;
      setShown(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else played.current = true;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);

  const display = reduce || played.current ? value : shown;
  return (
    <span className={className} aria-label={format(value)}>
      {format(display)}
    </span>
  );
}
