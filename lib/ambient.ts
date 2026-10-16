/**
 * "Ambient" decoration (the animated ethereal shade and the dotted waves) starts on the visitor's first interaction (scroll, touch,
 * pointer move, key) or after a quiet fallback delay, never during the first paint / hydration. Same look once running; it just stops
 * those effects competing with the first render on phones (they were ~1.6 s of main-thread work under a mobile CPU).
 */
import { useSyncExternalStore } from 'react';

let on = false;
const subs = new Set<() => void>();
const fire = () => {
  if (on) return;
  on = true;
  subs.forEach((f) => f());
  EVENTS.forEach((e) => window.removeEventListener(e, fire, true));
};
const EVENTS = ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'scroll', 'keydown'] as const;
if (typeof window !== 'undefined') {
  EVENTS.forEach((e) => window.addEventListener(e, fire, { capture: true, passive: true }));
  window.setTimeout(fire, 9000);
}
export function useAmbient(): boolean {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => on,
    () => false
  );
}
