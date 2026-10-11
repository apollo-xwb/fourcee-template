/** Pure budget for the decorative hero field. The scene module imports this; unit tests do not import three. */

/** Device pixel ratio for the hero WebGL buffer. Never above 2. */
export function heroPixelRatio(dpr: number): number {
  if (!Number.isFinite(dpr) || dpr <= 0) return 1;
  return Math.min(dpr, 2);
}

/** WebGL animation is off when the visitor asks for reduced motion. The CSS poster stays. */
export function heroMayAnimate(reducedMotion: boolean): boolean {
  return !reducedMotion;
}
