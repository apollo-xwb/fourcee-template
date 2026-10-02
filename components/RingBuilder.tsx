import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pickArMetal, readRingDeepLink } from '../lib/ar-assets';
import { warmTryOn } from '../lib/tryon-preload';
import type { RingBuilderConfig, RingSwatch } from '../types/audit';
import { CrystalRingCanvas } from './CrystalRingCanvas';
import { WebGiRingCanvas } from './WebGiRingCanvas';

// AR + camera try-on are loaded on demand: model-viewer and MediaPipe never touch the first paint.
const ArViewSheet = lazy(() => import('./ArViewSheet').then((m) => ({ default: m.ArViewSheet })));
const RingTryOn = lazy(() => import('./RingTryOn').then((m) => ({ default: m.RingTryOn })));

interface RingBuilderProps {
  config: Required<RingBuilderConfig>;
  isDarkMode?: boolean;
  compact?: boolean;
  /** Taller left-rail embed for desktop hero (no cinematic scroll). */
  heroEmbed?: boolean;
  businessName?: string;
}


function RingCanvas(props: React.ComponentProps<typeof CrystalRingCanvas>) {
  const [useWebGi, setUseWebGi] = useState(true);
  const onFatal = React.useCallback(() => setUseWebGi(false), []);
  if (!useWebGi) return <CrystalRingCanvas {...props} />;
  return <WebGiRingCanvas {...props} onFatal={onFatal} />;
}

/** Lower edge of the docked ring as a fraction of the sticky viewport height (measured, iPhone 14 + Pixel). */
const RING_BOTTOM_RATIO = 0.63;
/** The docked ring is ~5-8% wider than a phone screen; 0.84 leaves a small margin on both sides (checked on iPhone 14 / Pixel). */
const RING_PHONE_SCALE = 0.84;

function findSwatch(list: RingSwatch[], id: string, fallback: RingSwatch): RingSwatch {
  return list.find((item) => item.id === id) ?? fallback;
}

function scrollToNextSection() {
  const next =
    document.getElementById('demo') ||
    document.getElementById('roi-calculator') ||
    document.querySelector<HTMLElement>('#ring-studio ~ section');
  next?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export const RingBuilder: React.FC<RingBuilderProps> = ({
  config,
  isDarkMode = false,
  compact = false,
  heroEmbed = false,
  businessName,
}) => {
  const scrollRoot = useRef<HTMLDivElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const [metalId, setMetalId] = useState(config.defaultMetalId);
  const [gemId, setGemId] = useState(config.defaultGemId);
  const [docked, setDocked] = useState(false);
  const [sheet, setSheet] = useState<'ar' | 'tryon' | null>(null);
  const dockedRef = useRef(false);
  const progressRef = useRef(0);
  const lastUiRef = useRef(0);

  // QR / share deep link: ?ring=metal,gem[&ar=1|tryon=1]
  useEffect(() => {
    const link = readRingDeepLink();
    if (link.metalId && config.metals.some((m) => m.id === link.metalId)) setMetalId(link.metalId);
    if (link.gemId && config.gems.some((g) => g.id === link.gemId)) setGemId(link.gemId);
    if (link.openAr) setSheet('ar');
    else if (link.openTryOn) setSheet('tryon');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phones: how far to lift the ring so its lower edge clears the studio HUD. Measured from layout (offset sizes, unaffected by the
  // HUD's own enter transform). The ring's lower edge sits at ~RING_BOTTOM_RATIO of the sticky viewport height in the docked pose
  // (measured on iPhone 14 / Pixel, see the PR evidence); keep 16 px of air above the HUD card.
  useEffect(() => {
    const sticky = stickyRef.current;
    const hud = hudRef.current;
    if (!sticky || !hud || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const phone = window.matchMedia('(max-width: 639px)').matches;
      const sh = sticky.clientHeight;
      const padBottom = parseFloat(getComputedStyle(hud.parentElement as HTMLElement).paddingBottom) || 0;
      const hudTop = sh - padBottom - hud.offsetHeight;
      // phones: the docked ring is wider than the screen (clipped at both edges) -> shrink it slightly about its own centre, then lift
      const scale = phone ? RING_PHONE_SCALE : 1;
      const originY = sh * 0.42;
      const bottom = originY + (sh * RING_BOTTOM_RATIO - originY) * scale;
      const lift = phone ? Math.max(0, Math.round(bottom - (hudTop - 16))) : 0;
      sticky.style.setProperty('--ring-lift', `${lift}px`);
      sticky.style.setProperty('--ring-scale', String(scale));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(hud);
    ro.observe(sticky);
    return () => ro.disconnect();
  }, []);

  const metal = useMemo(
    () => findSwatch(config.metals, metalId, config.metals[0]),
    [config.metals, metalId]
  );
  const gem = useMemo(
    () => findSwatch(config.gems, gemId, config.gems[0]),
    [config.gems, gemId]
  );

  // Keep labels in sync without React state thrash on every frame
  const progressLabelRef = useRef<HTMLSpanElement | null>(null);
  const phaseLabelRef = useRef<HTMLSpanElement | null>(null);
  const hintLabelRef = useRef<HTMLParagraphElement | null>(null);

  const onJourneyProgress = (p: number) => {
    progressRef.current = p;
    const now = performance.now();
    const nextDocked = p >= 0.78;
    if (nextDocked !== dockedRef.current) {
      dockedRef.current = nextDocked;
      setDocked(nextDocked);
    }
    // Throttle label DOM writes (~8fps) — never setState per frame
    if (now - lastUiRef.current < 120) return;
    lastUiRef.current = now;
    if (progressLabelRef.current) {
      progressLabelRef.current.textContent = `${Math.round(p * 100)}%`;
    }
    if (phaseLabelRef.current) {
      phaseLabelRef.current.textContent =
        p < 0.35 ? '01 Arrive' : p < 0.75 ? '02 Orbit' : '03 Studio';
    }
    if (hintLabelRef.current) {
      hintLabelRef.current.textContent = nextDocked ? 'Customize · drag to turn' : 'Scroll to dock ↓';
    }
  };

  // intent signals (hover / focus / press) start loading the try-on while the finger is still on its way down
  const warm = () => warmTryOn(pickArMetal(metal));

  const arButtons = (
    <div className="mt-3 flex gap-2 sm:mt-4 sm:flex-wrap" data-testid="ar-actions">
      <button
        type="button"
        onClick={() => setSheet('ar')}
        className="min-h-11 flex-1 rounded-full bg-[#f4efe4] px-3 py-2.5 text-[10px] sm:flex-none sm:px-4 font-bold uppercase tracking-[0.16em] text-[#07080c] active:scale-95"
        data-testid="open-ar"
      >
        View in AR
      </button>
      <button
        type="button"
        onClick={() => setSheet('tryon')}
        onPointerEnter={warm}
        onPointerDown={warm}
        onFocus={warm}
        onTouchStart={warm}
        className="min-h-11 flex-1 rounded-full border border-[#c8b58f]/60 bg-white/5 px-3 py-2.5 sm:flex-none sm:px-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[#f4efe4] active:scale-95"
        data-testid="open-tryon"
      >
        Try on your hand
      </button>
    </div>
  );

  const sheets =
    sheet && typeof document !== 'undefined'
      ? createPortal(
          <Suspense fallback={null}>
            {sheet === 'ar' ? (
              <ArViewSheet metal={metal} gem={gem} onClose={() => setSheet(null)} onTryOn={() => setSheet('tryon')} />
            ) : (
              <RingTryOn metal={metal} gem={gem} onClose={() => setSheet(null)} />
            )}
          </Suspense>,
          document.body
        )
      : null;

  // one scrollable line on phones (pan-x only inside the row, page still scrolls vertically), wrapping from sm up
  const swatchRow = 'flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mt-2 sm:flex-wrap sm:overflow-visible';
  const chipClass = (active: boolean, accent: 'copper' | 'ice') =>
    `inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] ${
      active
        ? accent === 'copper'
          ? 'border-[#c8b58f] bg-white/10 text-[#f4efe4]'
          : 'border-[#c8b58f] bg-white/10 text-[#f4efe4]'
        : isDarkMode
          ? 'border-white/15 text-[#ddd4c6]'
          : 'border-white/20 text-[#f3ebe0]'
    }`;

  if (compact || heroEmbed) {
    const shell = heroEmbed
      ? 'liquid-glass relative flex h-full min-h-[520px] flex-col overflow-hidden rounded-[2rem] border border-[rgba(200,181,143,0.32)] bg-[rgba(12,11,9,0.48)] p-4 backdrop-blur-xl sm:p-5'
      : 'liquid-glass relative overflow-hidden rounded-[2rem] border border-[rgba(200,181,143,0.28)] bg-[rgba(12,11,9,0.72)] p-4 backdrop-blur-xl';
    const canvasH = heroEmbed
      ? 'relative mt-3 min-h-[380px] flex-1 w-full overflow-hidden rounded-2xl'
      : 'relative mt-3 h-[340px] w-full overflow-hidden rounded-2xl';
    return (
      <div className={shell}>
        <p className="fx-kicker">{businessName ? `${businessName} · ` : ''}Showroom demo</p>
        <p className="mt-1 text-[11px] text-[#a8957a]">
          {heroEmbed ? 'Drag to orbit · swap metal & stone' : '3D ring · not the voice SOP'}
        </p>
        <div className={canvasH} style={{ touchAction: 'pan-y' }}>
          <RingCanvas
            metalColor={metal.color}
            gemColor={gem.color}
            mode="orbit"
            interactive={heroEmbed || compact}
          />
        </div>
        <p className="fx-kicker mt-4">Metal</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Metal">
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
        <p className="fx-kicker mt-4">Center stone</p>
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
        {arButtons}
        {sheets}
      </div>
    );
  }

  // —— One continuous scene: short scroll → same ring docks → HUD customize ——
  return (
    <div className="relative">
      <div ref={scrollRoot} className="relative h-[185vh] sm:h-[200vh]">
        <div
          ref={stickyRef}
          className="sticky top-0 z-[1] h-[100svh] min-h-[100svh] w-full overflow-hidden bg-[#0c0b09]"
          style={{ touchAction: 'pan-y' }}
        >
          {/* Docked on phones the studio HUD covers the lower part of the screen: lift the (full-size) canvas by a measured amount so the
              ring sits entirely above it. transform only (compositor), animated once when the ring docks; no canvas resize, no camera jump. */}
          <div
            className="absolute inset-0 transition-transform duration-500 ease-out"
            style={{ transformOrigin: '50% 42%', transform: docked ? `translate3d(0, calc(var(--ring-lift, 0px) * -1), 0) scale(var(--ring-scale, 1))` : 'translate3d(0,0,0) scale(1)', willChange: docked ? 'transform' : undefined }}
            data-testid="ring-lift"
          >
            <RingCanvas
              metalColor={metal.color}
              gemColor={gem.color}
              mode="scroll"
              interactive={docked}
              scrollRoot={scrollRoot}
              onProgress={onJourneyProgress}
              dockAt={0.78}
              className="absolute inset-0"
            />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_38%_48%,rgba(58,36,28,0.18),transparent_42%)]" />
          <div
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-48 transition-opacity duration-500 ${
              docked ? 'opacity-90' : 'opacity-70'
            } bg-gradient-to-t from-[#0c0b09] via-[#0c0b09]/70 to-transparent`}
          />

          {/* Entry chrome — fades as ring docks */}
          <div
            className={`relative z-10 flex h-full flex-col justify-between p-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:p-10 md:pb-10 transition-opacity duration-500 ${
              docked ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            <div className="max-w-sm">
              <p className="fx-kicker">
                {businessName ? `${businessName} · ` : ''}Showroom demo
              </p>
              <h3 className="fx-display mt-2 text-[1.65rem] leading-[0.95] text-[#f4efe4] sm:text-3xl md:text-4xl">
                {config.headline}
              </h3>
              <p className="mt-2 max-w-xs text-[12px] leading-relaxed text-[#ddd4c6]">
                One short scroll docks this ring into the studio — then customize metal and stone.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="fx-chip">
                  <span className="fx-dot" />
                  <span ref={phaseLabelRef}>01 Arrive</span>
                </span>
                <span className="fx-chip">
                  <span ref={progressLabelRef}>0%</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <p
                ref={hintLabelRef}
                className="pointer-events-none text-[11px] uppercase tracking-[0.22em] text-[#c8b58f]/90"
              >
                Scroll to dock ↓
              </p>
              <div className="pointer-events-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const el = scrollRoot.current;
                    if (!el) return;
                    let scroller: HTMLElement | null = el.parentElement;
                    while (scroller) {
                      const oy = getComputedStyle(scroller).overflowY;
                      if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') break;
                      scroller = scroller.parentElement;
                    }
                    const range = Math.max(1, el.offsetHeight - (scroller?.clientHeight || window.innerHeight));
                    if (scroller) {
                      const target = scroller.scrollTop + el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + range;
                      scroller.scrollTo({ top: target, behavior: 'smooth' });
                    } else {
                      const top = el.getBoundingClientRect().top + window.scrollY;
                      window.scrollTo({ top: top + range, behavior: 'smooth' });
                    }
                  }}
                  className="min-h-11 rounded-full border border-[#c8b58f]/50 bg-white/5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f4efe4] backdrop-blur-md active:scale-95"
                >
                  Jump to studio
                </button>
                <button
                  type="button"
                  onClick={scrollToNextSection}
                  className="min-h-11 rounded-full border border-white/20 bg-black/40 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#ddd4c6] backdrop-blur-md active:scale-95"
                >
                  Skip section
                </button>
              </div>
            </div>
          </div>

          {/* Studio HUD — same canvas, same ring, customize overlay */}
          <div
            id="ring-studio-interact"
            className={`absolute inset-0 z-20 flex flex-col justify-end p-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-8 transition-all duration-500 ${
              docked ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
          >
            <div
              ref={hudRef}
              className="liquid-glass mx-auto w-full max-w-lg rounded-2xl border border-[rgba(200,181,143,0.35)] bg-[rgba(12,11,9,0.55)] p-3 backdrop-blur-xl shadow-[0_-12px_48px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-4"
              data-testid="ring-hud"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="fx-kicker text-[#c8b58f]">Ring Builder</p>
                  <p className="mt-0.5 truncate text-[11px] text-[#ddd4c6]">
                    {metal.label} · {gem.label} · drag to turn
                  </p>
                </div>
                <button
                  type="button"
                  onClick={scrollToNextSection}
                  className="min-h-10 shrink-0 rounded-full bg-[#f4efe4] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#07080c] active:scale-95"
                >
                  Continue ↓
                </button>
              </div>
              {/* Phones: one horizontally scrollable row per group (label inline) so the card stays short and the ring stays visible */}
              <div className="mt-2 flex items-center gap-2 sm:mt-3 sm:block">
                <p className="fx-kicker w-11 shrink-0 sm:w-auto">Metal</p>
                <div className={swatchRow} role="group" aria-label="Metal">
                  {config.metals.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setMetalId(item.id)}
                      aria-pressed={metalId === item.id}
                      className={`${chipClass(metalId === item.id, 'copper')} shrink-0`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 sm:mt-3 sm:block">
                <p className="fx-kicker w-11 shrink-0 leading-tight sm:w-auto">Stone</p>
                <div className={swatchRow} role="group" aria-label="Center stone">
                  {config.gems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setGemId(item.id)}
                      aria-pressed={gemId === item.id}
                      className={`${chipClass(gemId === item.id, 'ice')} shrink-0`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              {arButtons}
              <p className="mt-3 hidden text-[11px] leading-relaxed text-[#a8957a] sm:block">{config.subhead}</p>
            </div>
          </div>
        </div>
      </div>
      {sheets}
    </div>
  );
};
