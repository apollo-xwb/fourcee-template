import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RingSwatch } from '../types/audit';
import { arGlbUrl, arUsdzUrl, buildRingShareUrl, pickArMetal, supportsQuickLook } from '../lib/ar-assets';
import { QrCodeSvg } from './QrCodeSvg';
import { useModalA11y } from '../lib/use-modal-a11y';

const ModelViewer = 'model-viewer' as unknown as React.ElementType;

const IS_IOS = typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const IS_ANDROID = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
const IS_IOS_SAFARI = IS_IOS && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');

type ArStatus = 'checking' | 'quick-look' | 'android' | 'unavailable';

interface Props {
  metal: RingSwatch;
  gem: RingSwatch;
  onClose: () => void;
  onTryOn: () => void;
}

/**
 * "View in AR" — the EXISTING ring, millimetre-true (≈22 mm), via:
 *  - iOS Safari: AR Quick Look (native <a rel="ar"> -> .usdz)
 *  - Android Chrome: WebXR, falling back to Google Scene Viewer (.glb) — handled by <model-viewer ar-modes>
 *  - everything else (desktop): interactive 3D preview + QR code that opens this same ring on a phone.
 */
export const ArViewSheet: React.FC<Props> = ({ metal, gem, onClose, onTryOn }) => {
  const key = pickArMetal(metal);
  const glb = arGlbUrl(key);
  const usdz = arUsdzUrl(key);
  const thumb = `${import.meta.env.BASE_URL}assets/ar/ring-thumb-${key}.png`.replace(/\/{2,}/g, '/');
  const viewerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [mvReady, setMvReady] = useState(false);
  const [mvError, setMvError] = useState(false);
  const [status, setStatus] = useState<ArStatus>('checking');
  const quickLook = IS_IOS_SAFARI && (supportsQuickLook() || IS_IOS);
  const shareUrl = useMemo(() => buildRingShareUrl(metal.id, gem.id, 'ar'), [metal.id, gem.id]);

  useEffect(() => {
    let alive = true;
    import('@google/model-viewer')
      .then(() => alive && setMvReady(true))
      .catch((err) => {
        console.error('[ArViewSheet] model-viewer failed to load', err);
        if (alive) setMvError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // focus trap + inert background + Escape + focus return to the trigger (see lib/use-modal-a11y.ts)
  useModalA11y(dialogRef, onClose, closeRef);

  // model-viewer decides asynchronously (WebXR support is a promise) and does not expose which mode it chose,
  // so report only what we can observe: canActivateAR.
  useEffect(() => {
    if (!mvReady) return;
    const el = viewerRef.current as (HTMLElement & { canActivateAR?: boolean }) | null;
    if (!el) return;
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      if (el.canActivateAR) {
        setStatus(quickLook ? 'quick-look' : 'android');
        window.clearInterval(id);
      } else if (tries > 16) {
        setStatus(quickLook ? 'quick-look' : 'unavailable');
        window.clearInterval(id);
      }
    }, 150);
    return () => window.clearInterval(id);
  }, [mvReady, glb, quickLook]);

  const statusCopy: Record<ArStatus, string> = {
    checking: 'Checking what your device supports…',
    'quick-look': 'AR Quick Look is available on this iPhone/iPad.',
    android: 'AR is available on this phone (WebXR or Google Scene Viewer). Tap View in AR.',
    unavailable: IS_IOS || IS_ANDROID ? 'This browser cannot open AR. Try Safari (iPhone) or Chrome (Android).' : 'AR opens on phones. Scan the code to continue on your phone.',
  };

  const btn = 'inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/40 bg-white px-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-neutral-200';
  const ghost = 'inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/30 px-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-white/10';

  return (
    <div className="fixed inset-0 z-[1500] flex items-end justify-center sm:items-center" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ar-sheet-title" data-testid="ar-sheet">
      <button type="button" aria-label="Close AR sheet" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} tabIndex={-1} />
      <div className="relative z-10 flex max-h-[96svh] w-full max-w-xl flex-col overflow-y-auto rounded-t-[2rem] border border-white/15 bg-black/80 p-5 text-white shadow-2xl backdrop-blur-2xl sm:rounded-[2rem] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="fx-kicker">Augmented reality</p>
            <h3 id="ar-sheet-title" className="fx-display mt-1 text-3xl leading-none text-white">See it in your space</h3>
            <p className="mt-2 text-sm text-neutral-300">
              {metal.label}, true size (about 22&nbsp;mm across). AR shows your chosen metal only; the stone appears clear. The {gem.label.toLowerCase()} colour you picked is shown in the 3D studio and the hand try-on.
            </p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/25 text-lg text-white hover:bg-white/10">
            ×
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950">
          {mvError ? (
            <p className="p-8 text-center text-sm text-neutral-300">The 3D viewer could not load. Check your connection and try again.</p>
          ) : mvReady ? (
            <ModelViewer
              ref={viewerRef}
              src={glb}
              ios-src={usdz}
              alt={`${metal.label} ring with a clear stone, 3D model`}
              poster={thumb}
              ar
              ar-modes="webxr scene-viewer quick-look"
              ar-scale="fixed"
              ar-placement="floor"
              camera-controls
              touch-action="pan-y"
              environment-image="neutral"
              shadow-intensity="0.6"
              exposure="1.05"
              camera-orbit="25deg 65deg auto"
              interaction-prompt="none"
              style={{ width: '100%', height: 'min(46svh, 340px)', background: 'transparent', ['--poster-color' as string]: 'transparent' }}
              data-testid="model-viewer"
            >
              {quickLook ? (
                <span slot="ar-button" hidden />
              ) : (
                <button slot="ar-button" type="button" className={`${btn} absolute bottom-3 right-3`} data-testid="ar-launch-button">
                  View in AR
                </button>
              )}
            </ModelViewer>
          ) : (
            <p className="p-8 text-center text-xs uppercase tracking-[0.2em] text-neutral-300">Loading 3D viewer</p>
          )}
        </div>

        <p className="mt-3 text-sm text-neutral-200" role="status" aria-live="polite" data-testid="ar-status" data-ar-status={status}>
          {statusCopy[quickLook ? 'quick-look' : status]}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {quickLook && (
            <a
              rel="ar"
              href={`${usdz}#allowsContentScaling=0`}
              className={`${btn} gap-3`}
              data-testid="quick-look-link"
              aria-label="Open in AR Quick Look"
            >
              <img src={thumb} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
              <span>View in AR</span>
            </a>
          )}
          <button type="button" onClick={onTryOn} className={ghost} data-testid="open-tryon-from-ar">
            Try on your finger
          </button>
        </div>

        {!IS_IOS && !IS_ANDROID && (
          <div className="mt-5 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <QrCodeSvg value={shareUrl} size={112} label="QR code that opens this ring in AR on your phone" />
            <div>
              <p className="text-sm font-semibold text-white">Continue on your phone</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-300">Scan with your camera. The same ring opens ready for AR, over HTTPS.</p>
            </div>
          </div>
        )}
        <p className="mt-4 text-[11px] leading-relaxed text-neutral-400">
          AR needs a supported phone: iPhone with Safari (AR Quick Look) or an ARCore Android phone with Chrome. The ring file is the same design as the 3D studio.
        </p>
      </div>
    </div>
  );
};
