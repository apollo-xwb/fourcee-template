import React from 'react';

interface RingBuilderShowcaseProps {
  isDarkMode?: boolean;
}

/**
 * Showcases the Crystal-Jewels WebGi ring experience (viewer, scroll camera,
 * GLBs, gem/material UI) inside the Fourcee template — not a cloned marketing site.
 * Runtime is the baked WebGi bundle under /ringbuilder/ (from VikasRana10/3D-app Crystal-Jewels).
 */
export const RingBuilderShowcase: React.FC<RingBuilderShowcaseProps> = ({ isDarkMode = true }) => {
  const shell = isDarkMode
    ? 'border-white/10 bg-white/5 text-white'
    : 'border-navy-200 bg-white/80 text-navy-900';
  const muted = isDarkMode ? 'text-navy-300' : 'text-navy-600';

  return (
    <section
      id="ring-builder"
      className="snap-start snap-always min-h-screen flex flex-col justify-center py-16 md:py-24 px-4 sm:px-6 bg-transparent relative"
    >
      <div className="w-full max-w-6xl mx-auto">
        <div className="mb-8 md:mb-10 max-w-2xl">
          <p className={`text-[10px] font-bold uppercase tracking-[0.28em] ${muted}`}>Product experience</p>
          <h2 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-bold serif tracking-tight">
            Our ring builder
          </h2>
          <p className={`mt-3 text-sm sm:text-base leading-relaxed ${muted}`}>
            Scroll-driven WebGi viewer with real GLB rings, gem color picks, and metal finishes —
            the same Crystal-Jewels experience embedded as a Fourcee showcase (not a standalone site clone).
          </p>
        </div>

        <div className={`rounded-3xl border overflow-hidden shadow-2xl ${shell}`}>
          <div className={`flex flex-wrap gap-2 sm:gap-3 px-4 sm:px-5 py-3 border-b text-[10px] uppercase tracking-[0.18em] font-bold ${isDarkMode ? 'border-white/10 text-navy-200' : 'border-navy-100 text-navy-500'}`}>
            <span>Ring viewer</span>
            <span className="opacity-40">·</span>
            <span>Scroll camera</span>
            <span className="opacity-40">·</span>
            <span>Gem UI</span>
            <span className="opacity-40">·</span>
            <span>Material UI</span>
          </div>
          <iframe
            title="Fourcee ring builder — WebGi"
            src="/ringbuilder/"
            className="w-full border-0 bg-[#eeb7b5]"
            style={{ minHeight: 'min(70vh, 680px)', height: '70vh' }}
            allow="fullscreen"
            loading="lazy"
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-3 items-center justify-between">
          <ul className={`text-xs sm:text-sm space-y-1 ${muted}`}>
            <li>Unique → Forever → Emotions scroll sections</li>
            <li>Diamond / emerald / sapphire gem menu · gold / rose / platinum materials</li>
            <li>Bundled GLBs: ring_webgi, ring2_webgi, ring2_webgi3</li>
          </ul>
          <a
            href="/ringbuilder/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-navy-900 text-white dark:bg-white dark:text-navy-950 px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.22em] shadow-lg hover:scale-105 transition-all"
          >
            Open full builder
          </a>
        </div>
      </div>
    </section>
  );
};
