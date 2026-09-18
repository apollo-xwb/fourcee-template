import type { AuditData, RingBuilderConfig, RingSwatch } from '../types/audit';

export const DEFAULT_RING_METALS: RingSwatch[] = [
  { id: 'yellow-gold', label: 'Yellow gold', color: '#d4af37' },
  { id: 'white-gold', label: 'White gold', color: '#e8eef4' },
  { id: 'rose-gold', label: 'Rose gold', color: '#c9a08a' },
  { id: 'platinum', label: 'Platinum', color: '#c2ccd6' },
];

export const DEFAULT_RING_GEMS: RingSwatch[] = [
  { id: 'diamond', label: 'Diamond', color: '#f4fbff' },
  { id: 'ruby', label: 'Ruby', color: '#c81e3a' },
  { id: 'sapphire', label: 'Sapphire', color: '#2f5ea8' },
  { id: 'emerald', label: 'Emerald', color: '#1f7a4d' },
  { id: 'champagne', label: 'Champagne', color: '#e6c37a' },
];

export const DEFAULT_RING_BUILDER: Required<RingBuilderConfig> = {
  enabled: true,
  headline: 'Private ring studio',
  subhead: 'Show a buyer the stone and metal before they ever reach the showroom.',
  metals: DEFAULT_RING_METALS,
  gems: DEFAULT_RING_GEMS,
  defaultMetalId: 'yellow-gold',
  defaultGemId: 'diamond',
};

/**
 * Optional JSON only. Missing key → code defaults (studio on).
 * `enabled: false` hides it. Accepts top-level `ringBuilder` or `liveDemo.ringBuilder`.
 */
export function resolveRingBuilder(data: AuditData | null | undefined): Required<RingBuilderConfig> | null {
  const incoming = data?.ringBuilder ?? data?.liveDemo?.ringBuilder;
  if (incoming?.enabled === false) return null;
  return {
    enabled: true,
    headline: incoming?.headline || DEFAULT_RING_BUILDER.headline,
    subhead: incoming?.subhead || DEFAULT_RING_BUILDER.subhead,
    metals: incoming?.metals?.length ? incoming.metals : DEFAULT_RING_BUILDER.metals,
    gems: incoming?.gems?.length ? incoming.gems : DEFAULT_RING_BUILDER.gems,
    defaultMetalId: incoming?.defaultMetalId || incoming?.metals?.[0]?.id || DEFAULT_RING_BUILDER.defaultMetalId,
    defaultGemId: incoming?.defaultGemId || incoming?.gems?.[0]?.id || DEFAULT_RING_BUILDER.defaultGemId,
  };
}
