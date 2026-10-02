import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { RingSwatch } from '../types/audit';
import { HAND_MODEL_URL, MEDIAPIPE_WASM_URL, arGlbUrl, pickArMetal } from '../lib/ar-assets';
import { computeRingPose, smoothPose, type RingPose } from '../lib/hand-pose';
import { RingOverlay } from '../lib/ring-overlay';
import { useModalA11y } from '../lib/use-modal-a11y';

type Phase = 'idle' | 'starting' | 'live' | 'photo' | 'error';
type HandLandmarkerT = import('@mediapipe/tasks-vision').HandLandmarker;

interface Props {
  metal: RingSwatch;
  gem: RingSwatch;
  onClose: () => void;
}

const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/**
 * Camera try-on fallback: MediaPipe hand landmarks -> the EXISTING ring on the ring finger.
 * All processing is on-device (WASM + WebGL). No frame is uploaded or stored.
 */
export const RingTryOn: React.FC<Props> = ({ metal, gem, onClose }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('Allow camera access, then show the back of your hand with the ring finger up.');
  const [facing, setFacing] = useState<'user' | 'environment'>(isTouch ? 'environment' : 'user');
  const [handSeen, setHandSeen] = useState(false);
  const [fps, setFps] = useState(0);
  const [frameSize, setFrameSize] = useState<{ w: number; h: number }>({ w: 1280, h: 720 });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const photoRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<RingOverlay | null>(null);
  const landmarkerRef = useRef<HandLandmarkerT | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const poseRef = useRef<RingPose | null>(null);
  const missRef = useRef(0);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef<'VIDEO' | 'IMAGE'>('VIDEO');
  const liveRef = useRef(false);
  const mirror = phase === 'live' && facing === 'user';

  const stopStream = useCallback(() => {
    liveRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // overlay lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let overlay: RingOverlay;
    try {
      overlay = new RingOverlay(canvas);
    } catch (err) {
      console.error('[RingTryOn] WebGL unavailable', err);
      setPhase('error');
      setMessage('This browser could not start 3D graphics (WebGL). Try the AR button instead.');
      return;
    }
    overlayRef.current = overlay;
    overlay.load(arGlbUrl(pickArMetal(metal))).then(
      () => !disposed && overlay.render(),
      (err) => {
        console.error('[RingTryOn] ring model failed to load', err);
        if (!disposed) {
          setPhase('error');
          setMessage('The ring model could not load.');
        }
      }
    );
    return () => {
      disposed = true;
      overlay.dispose();
      overlayRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    overlayRef.current?.setColors(metal.color, gem.color);
  }, [metal.color, gem.color]);

  // focus trap + inert background + Escape + focus return to the trigger (see lib/use-modal-a11y.ts)
  useModalA11y(dialogRef, onClose, closeRef);

  useEffect(
    () => () => {
      stopStream();
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    },
    [stopStream]
  );

  const ensureLandmarker = useCallback(async (mode: 'VIDEO' | 'IMAGE') => {
    if (!landmarkerRef.current) {
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
      const make = (delegate: 'GPU' | 'CPU') =>
        HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate },
          runningMode: mode,
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      try {
        landmarkerRef.current = await make('GPU');
      } catch {
        landmarkerRef.current = await make('CPU');
      }
      modeRef.current = mode;
    } else if (modeRef.current !== mode) {
      await landmarkerRef.current.setOptions({ runningMode: mode });
      modeRef.current = mode;
    }
    return landmarkerRef.current;
  }, []);

  const applyResult = useCallback((result: { landmarks: { x: number; y: number; z: number }[][]; handedness: { categoryName: string }[][] }, w: number, h: number, smooth: boolean) => {
    const lm = result.landmarks?.[0];
    if (!lm) {
      missRef.current += 1;
      if (missRef.current > 8) {
        poseRef.current = null;
        overlayRef.current?.setPose(null);
        setHandSeen(false);
      }
      return false;
    }
    missRef.current = 0;
    const raw = computeRingPose(lm, w, h, result.handedness?.[0]?.[0]?.categoryName);
    if (!raw) return false;
    poseRef.current = smooth ? smoothPose(poseRef.current, raw) : raw;
    // read-only test hook (used by e2e to compare the drawn ring against the landmarks)
    (window as unknown as Record<string, unknown>).__ringTryOn = { landmarks: lm, pose: poseRef.current, w, h };
    overlayRef.current?.setPose(poseRef.current);
    setHandSeen(true);
    return true;
  }, []);

  const startCamera = useCallback(
    async (nextFacing = facing) => {
      stopStream();
      setPhase('starting');
      setHandSeen(false);
      setMessage('Starting camera…');
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase('error');
        setMessage('Camera access needs a secure (https) page and a supported browser. You can upload a photo of your hand instead.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const w = video.videoWidth || 1280;
        const h = video.videoHeight || 720;
        setFrameSize({ w, h });
        overlayRef.current?.resize(w, h, 1);
        setMessage('Loading hand tracking (about 19 MB on first use)…');
        const landmarker = await ensureLandmarker('VIDEO');
        setPhase('live');
        setMessage('Show the back of your hand, fingers up. The ring snaps to your ring finger.');
        liveRef.current = true;
        let last = -1;
        let frames = 0;
        let t0 = performance.now();
        const tick = () => {
          if (!liveRef.current) return;
          rafRef.current = requestAnimationFrame(tick);
          if (video.readyState < 2 || video.currentTime === last) return;
          last = video.currentTime;
          const res = landmarker.detectForVideo(video, performance.now());
          applyResult(res as never, video.videoWidth, video.videoHeight, true);
          overlayRef.current?.render();
          frames += 1;
          const now = performance.now();
          if (now - t0 > 1000) {
            setFps(Math.round((frames * 1000) / (now - t0)));
            frames = 0;
            t0 = now;
          }
        };
        tick();
      } catch (err) {
        console.error('[RingTryOn] camera start failed', err);
        stopStream();
        const name = (err as DOMException)?.name;
        setPhase('error');
        setMessage(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'Camera permission was blocked. Allow it in your browser settings, or upload a photo of your hand instead.'
            : name === 'NotFoundError'
              ? 'No camera found on this device. Upload a photo of your hand instead.'
              : 'The camera or hand tracking could not start. Upload a photo of your hand instead.'
        );
      }
    },
    [applyResult, ensureLandmarker, facing, stopStream]
  );

  const onPhoto = useCallback(
    async (file: File | null) => {
      if (!file) return;
      stopStream();
      setPhase('starting');
      setMessage('Analysing photo on your device…');
      try {
        const bitmap = await createImageBitmap(file);
        const maxSide = 1280;
        const k = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const w = Math.round(bitmap.width * k);
        const h = Math.round(bitmap.height * k);
        const pc = photoRef.current!;
        pc.width = w;
        pc.height = h;
        pc.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
        bitmap.close();
        setFrameSize({ w, h });
        overlayRef.current?.resize(w, h, 1);
        const landmarker = await ensureLandmarker('IMAGE');
        poseRef.current = null;
        const res = landmarker.detect(pc);
        setPhase('photo');
        const ok = applyResult(res as never, w, h, false);
        overlayRef.current?.render();
        setMessage(ok ? 'Ring placed on the ring finger. Save the picture or try another photo.' : 'No hand found. Use a clear photo of the back of your hand with fingers visible.');
      } catch (err) {
        console.error('[RingTryOn] photo failed', err);
        setPhase('error');
        setMessage('That photo could not be analysed. Try a clearer image.');
      }
    },
    [applyResult, ensureLandmarker, stopStream]
  );

  const savePicture = useCallback(() => {
    const overlay = overlayRef.current;
    const out = document.createElement('canvas');
    out.width = frameSize.w;
    out.height = frameSize.h;
    const ctx = out.getContext('2d')!;
    ctx.save();
    if (mirror) {
      ctx.translate(out.width, 0);
      ctx.scale(-1, 1);
    }
    if (phase === 'photo' && photoRef.current) ctx.drawImage(photoRef.current, 0, 0);
    else if (videoRef.current) ctx.drawImage(videoRef.current, 0, 0, out.width, out.height);
    overlay?.render();
    if (canvasRef.current) ctx.drawImage(canvasRef.current, 0, 0, out.width, out.height);
    ctx.restore();
    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ring-try-on.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, 'image/png');
  }, [frameSize, mirror, phase]);

  const flip = () => {
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    if (phase === 'live' || phase === 'starting') void startCamera(next);
  };

  const btn = 'inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/40 bg-white px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-neutral-200';
  const ghost = 'inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/30 px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-white/10';
  const mediaVisible = phase === 'live' || phase === 'photo';

  return (
    <div className="fixed inset-0 z-[1500] flex items-end justify-center sm:items-center" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tryon-title" data-testid="tryon-sheet">
      <button type="button" aria-label="Close try-on" className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} tabIndex={-1} />
      <div className="relative z-10 flex max-h-[96svh] w-full max-w-2xl flex-col overflow-y-auto rounded-t-[2rem] border border-white/15 bg-black/85 p-5 text-white shadow-2xl backdrop-blur-2xl sm:rounded-[2rem] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="fx-kicker">Camera try-on</p>
            <h3 id="tryon-title" className="fx-display mt-1 text-3xl leading-none text-white">Try it on your hand</h3>
            <p className="mt-2 text-sm text-neutral-300">{metal.label} · {gem.label}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/25 text-lg hover:bg-white/10">
            ×
          </button>
        </div>

        <div
          className="relative mx-auto mt-4 w-full overflow-hidden rounded-2xl border border-white/10 bg-neutral-950"
          style={{ aspectRatio: `${frameSize.w} / ${frameSize.h}`, maxHeight: '52svh', transform: mirror ? 'scaleX(-1)' : undefined }}
          data-testid="tryon-stage"
          data-phase={phase}
          data-hand={handSeen ? 'detected' : 'none'}
        >
          <video ref={videoRef} playsInline muted autoPlay className={`absolute inset-0 h-full w-full object-cover ${phase === 'live' ? '' : 'hidden'}`} data-testid="tryon-video" />
          <canvas ref={photoRef} className={`absolute inset-0 h-full w-full object-cover ${phase === 'photo' ? '' : 'hidden'}`} data-testid="tryon-photo" />
          <canvas ref={canvasRef} className={`absolute inset-0 h-full w-full object-cover ${mediaVisible ? '' : 'invisible'}`} data-testid="tryon-overlay" aria-label="Ring drawn on your finger" />
          {!mediaVisible && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-neutral-300">{phase === 'starting' ? 'Starting…' : 'Camera preview appears here'}</div>
          )}
        </div>

        <p className="mt-3 min-h-[2.5rem] text-sm text-neutral-200" role="status" aria-live="polite" data-testid="tryon-status">{message}</p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {(phase === 'idle' || phase === 'error') && (
            <button type="button" className={btn} onClick={() => void startCamera()} data-testid="tryon-start">
              Start camera
            </button>
          )}
          {phase === 'live' && (
            <>
              <button type="button" className={btn} onClick={savePicture} data-testid="tryon-save">Save picture</button>
              <button type="button" className={ghost} onClick={flip}>Flip camera</button>
              <button type="button" className={ghost} onClick={() => { stopStream(); setPhase('idle'); setMessage('Camera stopped.'); }}>Stop</button>
            </>
          )}
          {phase === 'photo' && (
            <>
              <button type="button" className={btn} onClick={savePicture} data-testid="tryon-save">Save picture</button>
              <button type="button" className={ghost} onClick={() => void startCamera()}>Use camera</button>
            </>
          )}
          <label className={`${ghost} cursor-pointer`}>
            Upload a hand photo
            <input type="file" accept="image/*" className="sr-only" data-testid="tryon-file" onChange={(e) => { void onPhoto(e.target.files?.[0] ?? null); e.target.value = ''; }} />
          </label>
          {phase === 'live' && <span className="ml-auto font-mono text-[11px] text-neutral-400" data-testid="tryon-fps">{fps} fps</span>}
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-neutral-400">
          Your camera feed is processed on this device only. Nothing is uploaded or saved unless you tap Save picture. Sizing is approximate (average hand proportions): a visual preview, not a fitting.
        </p>
      </div>
    </div>
  );
};
