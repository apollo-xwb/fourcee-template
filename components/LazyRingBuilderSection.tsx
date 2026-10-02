import React, { useEffect, useRef, useState } from 'react';
import type { RingBuilderConfig } from '../types/audit';
import { ErrorBoundary } from './ErrorBoundary';
import { RingBuilder } from './RingBuilder';
import { schedulePreloadRing } from '../lib/preload-ring';

interface LazyRingBuilderSectionProps {
  config: Required<RingBuilderConfig>;
  isDarkMode?: boolean;
  compact?: boolean;
  heroEmbed?: boolean;
  /** Mount immediately (mobile scroll journey) — skip IO gate. */
  eager?: boolean;
  businessName?: string;
}

/**
 * Defers painting the Three.js / WebGi studio until near viewport.
 * RingBuilder is a STATIC import so Vite does not emit a separate hashed
 * RingBuilder-*.js chunk that can 404→SPA HTML (MIME text/html) after deploys.
 * Heavy webgi runtime stays dynamically imported inside WebGiRingCanvas.
 */
export const LazyRingBuilderSection: React.FC<LazyRingBuilderSectionProps> = (props) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(Boolean(props.heroEmbed || props.compact || props.eager));

  useEffect(() => {
    schedulePreloadRing(); // idempotent: network now, webgi runtime when idle / on first interaction
    if (props.heroEmbed || props.compact || props.eager) {
      setVisible(true);
      return;
    }
    const node = hostRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '480px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [props.heroEmbed, props.compact, props.eager]);

  const placeholderClass = `rounded-[2rem] border px-6 py-16 text-center text-xs uppercase tracking-[0.22em] ${
    props.isDarkMode ? 'border-white/10 text-slate-500' : 'border-navy-200 text-navy-500'
  }`;

  const fallback = (
    <div className={`rounded-[2rem] border px-6 py-12 text-center ${
      props.isDarkMode ? 'border-amber-300/30 bg-navy-950/50 text-slate-300' : 'border-navy-200 bg-white/70 text-navy-700'
    }`}>
      <p className="text-[10px] uppercase tracking-[0.22em] text-amber-700 dark:text-amber-200/80">
        Ring studio preview unavailable
      </p>
      <p className="mt-3 text-sm normal-case tracking-normal">
        3D assets could not load in this environment. Use the audit or book a call — the rest of the site works normally.
      </p>
    </div>
  );

  return (
    <div ref={hostRef} className="min-h-[240px]">
      {visible ? (
        <ErrorBoundary label="Ring Builder" fallback={fallback}>
          <RingBuilder {...props} />
        </ErrorBoundary>
      ) : (
        <div className={placeholderClass}>Ring studio preview</div>
      )}
    </div>
  );
};
