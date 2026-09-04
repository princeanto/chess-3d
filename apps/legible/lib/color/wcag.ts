/**
 * WCAG 2.2 thresholds and grading.
 *
 * Large text is ≥ 24px, or ≥ 18.66px when bold — the definition catches people
 * out, so it is stated on the tier itself rather than left in a footnote.
 * 1.4.11 (non-text contrast) has no AAA level; that is the spec, not an
 * omission.
 */

export type TierId = 'body-aa' | 'body-aaa' | 'large-aa' | 'large-aaa' | 'non-text';

export interface Tier {
  id: TierId;
  label: string;
  short: string;
  ratio: number;
  criterion: string;
  note: string;
}

export const TIERS: Record<TierId, Tier> = {
  'body-aa': {
    id: 'body-aa',
    label: 'Body text — AA',
    short: 'Body AA',
    ratio: 4.5,
    criterion: '1.4.3 Contrast (Minimum)',
    note: 'Text below 24px, or below 18.66px bold.',
  },
  'body-aaa': {
    id: 'body-aaa',
    label: 'Body text — AAA',
    short: 'Body AAA',
    ratio: 7,
    criterion: '1.4.6 Contrast (Enhanced)',
    note: 'The enhanced level, rarely mandated outside public-sector work.',
  },
  'large-aa': {
    id: 'large-aa',
    label: 'Large text — AA',
    short: 'Large AA',
    ratio: 3,
    criterion: '1.4.3 Contrast (Minimum)',
    note: 'Text at least 24px, or 18.66px bold.',
  },
  'large-aaa': {
    id: 'large-aaa',
    label: 'Large text — AAA',
    short: 'Large AAA',
    ratio: 4.5,
    criterion: '1.4.6 Contrast (Enhanced)',
    note: 'Enhanced level for large text.',
  },
  'non-text': {
    id: 'non-text',
    label: 'UI & graphics',
    short: 'UI 3:1',
    ratio: 3,
    criterion: '1.4.11 Non-text Contrast',
    note: 'Borders, icons, focus rings, chart strokes. No AAA level exists.',
  },
};

export const TIER_ORDER: TierId[] = [
  'body-aa',
  'body-aaa',
  'large-aa',
  'large-aaa',
  'non-text',
];

export const passes = (ratio: number, tier: TierId): boolean =>
  ratio >= TIERS[tier].ratio;

export interface Grade {
  ratio: number;
  results: Record<TierId, boolean>;
  /** The most demanding tier this pair satisfies, for a one-word verdict. */
  best: TierId | null;
}

export function grade(ratio: number): Grade {
  const results = {} as Record<TierId, boolean>;
  for (const id of TIER_ORDER) results[id] = passes(ratio, id);

  // Ordered by how much contrast each demands, not by the order above.
  const byDemand: TierId[] = ['body-aaa', 'body-aa', 'large-aaa', 'large-aa', 'non-text'];
  const best = byDemand.find((id) => results[id]) ?? null;

  return { ratio, results, best };
}

/** Shorthand used on matrix cells. */
export function badge(ratio: number): { text: string; tone: 'pass' | 'warn' | 'fail' } {
  if (ratio >= 7) return { text: 'AAA', tone: 'pass' };
  if (ratio >= 4.5) return { text: 'AA', tone: 'pass' };
  if (ratio >= 3) return { text: 'AA·L', tone: 'warn' };
  return { text: 'Fail', tone: 'fail' };
}
