import { describe, expect, it } from 'vitest';
import { heroMayAnimate, heroPixelRatio } from '../lib/hero-field-budget';

describe('hero field budget', () => {
  it('caps the device pixel ratio at 2', () => {
    expect(heroPixelRatio(1)).toBe(1);
    expect(heroPixelRatio(2)).toBe(2);
    expect(heroPixelRatio(3)).toBe(2);
    expect(heroPixelRatio(0)).toBe(1);
    expect(heroPixelRatio(Number.NaN)).toBe(1);
  });

  it('does not animate when the visitor prefers reduced motion', () => {
    expect(heroMayAnimate(true)).toBe(false);
    expect(heroMayAnimate(false)).toBe(true);
  });
});
