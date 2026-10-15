import React, { useEffect, useRef, useState } from 'react';

type Src = { webm?: string; mp4: string };

/**
 * Muted looping clip. Nothing (not even the poster) is fetched until the clip is within ~600px of the viewport, so below-the-fold video
 * never competes with the first paint; it plays only while on screen. `src` may be one MP4 or a WebM + MP4 pair (WebM first).
 */
export const LazyVideo: React.FC<{ src: string | Src; poster: string; label: string; className?: string; style?: React.CSSProperties }> = ({ src, poster, label, className, style }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // React sets `muted` as a property only, so the prerendered/hydrated <video> came up unmuted (and iOS refuses to autoplay that)
    el.muted = true;
    el.defaultMuted = true;
    el.setAttribute('muted', '');
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setNear(true);
        requestAnimationFrame(() => el.play?.().catch(() => {}));
      } else el.pause?.();
    }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const s: Src = typeof src === 'string' ? { mp4: src } : src;
  return (
    <video
      ref={ref}
      className={className}
      style={style}
      poster={near ? poster : undefined}
      muted
      loop
      playsInline
      autoPlay={near}
      preload={near ? 'metadata' : 'none'}
      aria-label={label}
    >
      {near && s.webm ? <source src={s.webm} type="video/webm" /> : null}
      {near ? <source src={s.mp4} type="video/mp4" /> : null}
    </video>
  );
};

/** One Fourcee film slot: 16:9 cut on tablets/desktop, 9:16 cut on phones (only the one that matches is ever fetched). */
export const FourceeFilm: React.FC<{ base: string; label: string; className?: string }> = ({ base, label, className }) => {
  const [wide, setWide] = useState(false); // decided after mount (same markup as the prerendered shell); nothing loads before that
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const v = `${base}-${wide ? '16x9' : '9x16'}`;
  return (
    <div className={`relative overflow-hidden rounded-[1.75rem] border border-[rgba(200,181,143,0.35)] bg-[#0c0b09] shadow-[0_24px_60px_rgba(12,11,9,0.18)] ${wide ? 'aspect-video' : 'mx-auto aspect-[9/16] max-w-[420px]'} ${className ?? ''}`} data-testid={`film-${base.split('/').pop()}`}>
      <LazyVideo key={v} src={{ webm: `${v}.webm`, mp4: `${v}.mp4` }} poster={`${v}.webp`} label={label} className="absolute inset-0 h-full w-full object-cover" />
    </div>
  );
};
