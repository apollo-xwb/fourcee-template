import React, { useMemo, useRef, useState } from 'react';
import type { RingBuilderConfig, RingSwatch } from '../types/audit';
import { CrystalRingCanvas } from './CrystalRingCanvas';

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
  const scrollRoot = useRef<HTMLDivElement | null>(null);
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

  const chipClass = (active: boolean, accent: 'copper' | 'ice') =>
    `inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] ${
      active
        ? accent === 'copper'
          ? 'border-[#c8b58f] bg-white/10 text-[#f4efe4]'
          : 'border-[#8ec8e6] bg-white/10 text-[#f4efe4]'
        : isDarkMode
          ? 'border-white/15 text-[#c2ccd6]'
          : 'border-navy-200 text-navy-700'
    }`;

  const controls = (
    <>
      <p className="text-sm leading-relaxed text-[#8aa0b5]">{config.subhead}</p>
      <p className="mt-2 text-xs text-[#c2ccd6]">
        Showing {metal.label} · {gem.label}
      </p>
      <p className="fx-kicker mt-5">Metal</p>
      <div className="mt-3 flex flex-wrap items-center gap-3" role="group" aria-label="Metal">
        {config.metals.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMetalId(item.id)}
            aria-pressed={metalId === item.id}
            aria-label={item.label}
            title={item.label}
            className={`h-9 w-9 rounded-full border transition ${
              metalId === item.id ? 'border-[#c8b58f] scale-110' : 'border-white/20'
            }`}
            style={{ background: item.color, boxShadow: '0 8px 18px rgba(0,0,0,0.35)' }}
          />
        ))}
      </div>
      <p className="fx-kicker mt-5">Center stone</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Center stone">
        {config.gems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setGemId(item.id)}
            aria-pressed={gemId === item.id}
            className={chipClass(gemId === item.id, 'ice')}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
            {item.label}
          </button>
        ))}
      </div>
    </>
  );

  if (compact) {
    return (
      <div className="relative overflow-hidden rounded-[2rem] border border-[rgba(200,181,143,0.22)] bg-[#050910] p-4">
        <p className="fx-kicker">{businessName ? `${businessName} · ` : ''}Showroom demo</p>
        <p className="mt-1 text-[11px] text-[#8aa0b5]">3D ring · not the voice SOP</p>
        <div className="relative mt-3 h-[220px] w-full overflow-hidden rounded-2xl">
          <CrystalRingCanvas metalColor={metal.color} gemColor={gem.color} mode="orbit" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Metal">
          {config.metals.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMetalId(item.id)}
              aria-pressed={metalId === item.id}
              className={chipClass(metalId === item.id, 'copper')}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              {item.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRoot} className="relative">
      <div className="sticky top-0 z-[1] h-[100svh] overflow-hidden bg-[#07080c]">
        <CrystalRingCanvas
          metalColor={metal.color}
          gemColor={gem.color}
          mode="scroll"
          scrollRoot={scrollRoot}
          className="absolute inset-0"
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_38%_48%,rgba(58,36,28,0.15),transparent_42%)]" />
        <div className="relative z-10 flex h-full flex-col justify-between p-6 md:p-10">
          <div className="max-w-sm">
            <p className="fx-kicker">{businessName ? `${businessName} · ` : ''}Showroom demo</p>
            <h3 className="fx-display mt-3 text-3xl leading-[0.95] text-[#f4efe4] md:text-4xl">
              {config.headline}
            </h3>
            <p className="mt-3 max-w-xs text-[12px] leading-relaxed text-[#8aa0b5]">
              Scroll to turn the piece. Metal and stone swap live. This is merchandising — the voice agent is the product.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="fx-chip">01 Arrive</span>
              <span className="fx-chip">
                <span className="fx-dot" />
                02 Turn
              </span>
              <span className="fx-chip">03 Build</span>
            </div>
          </div>
          <div className="pointer-events-auto ml-auto w-full max-w-md">
            <div className="fx-tile p-5 md:p-6">{controls}</div>
          </div>
        </div>
      </div>
      <div className="h-[160vh]" aria-hidden />
    </div>
  );
};
