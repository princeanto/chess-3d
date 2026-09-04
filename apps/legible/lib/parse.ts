/**
 * Lenient palette parsing.
 *
 * People arrive with whatever their design system already produces — a block of
 * CSS custom properties, a Tailwind config fragment, a JSON export, or a column
 * of hex codes pasted out of Figma. Making them reformat it first is the fastest
 * way to lose them, so this accepts all of those and extracts name/hex pairs
 * from whatever it is given.
 */

import { isHex, parseHex, toHex } from './color/srgb';

export interface ParsedSwatch {
  name: string;
  hex: string;
}

const HEX_TOKEN = /#[0-9a-fA-F]{3,8}\b/g;

/** Normalises to a lowercase 6-digit hex, dropping alpha. */
function canonical(raw: string): string | null {
  const rgb = parseHex(raw);
  if (!rgb) return null;
  return toHex(rgb).toLowerCase();
}

function flattenJson(value: unknown, prefix: string, out: ParsedSwatch[], depth = 0) {
  if (depth > 3) return;
  if (typeof value === 'string') {
    const hex = canonical(value);
    if (hex) out.push({ name: prefix || hex, hex });
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      // Tailwind writes the base shade as DEFAULT; the parent name is the useful one.
      const name = key === 'DEFAULT' ? prefix : prefix ? `${prefix}-${key}` : key;
      flattenJson(child, name, out, depth + 1);
    }
  }
}

/**
 * Pulls swatches out of arbitrary input. Returns them in the order encountered,
 * de-duplicated by colour — two names for the same hex would produce identical
 * matrix rows, which is noise rather than information.
 */
export function parsePalette(input: string): ParsedSwatch[] {
  const text = input.trim();
  if (!text) return [];

  const found: ParsedSwatch[] = [];

  // JSON first: it carries the best names, and its braces would otherwise
  // survive the line parser as junk.
  if (/^[[{]/.test(text)) {
    try {
      flattenJson(JSON.parse(text), '', found);
    } catch {
      // Not valid JSON after all — fall through to the line parser.
    }
  }

  if (found.length === 0) {
    for (const line of text.split(/[\n;]/)) {
      const hexes = line.match(HEX_TOKEN);
      if (!hexes) continue;

      // A name is whatever sits left of the separator: --token, $token, "token",
      // token:, token =. Only claim one when the line holds a single colour.
      let name = '';
      if (hexes.length === 1) {
        const before = line.slice(0, line.indexOf(hexes[0]));
        const m = before.match(/([A-Za-z0-9_$-]+)\s*[:=]\s*$/);
        if (m) name = m[1].replace(/^--/, '').replace(/^\$/, '');
      }

      for (const raw of hexes) {
        const hex = canonical(raw);
        if (hex) found.push({ name: name || hex, hex });
      }
    }
  }

  const seen = new Set<string>();
  const unique: ParsedSwatch[] = [];
  for (const swatch of found) {
    if (seen.has(swatch.hex)) continue;
    seen.add(swatch.hex);
    unique.push(swatch);
  }
  return unique;
}

export const looksLikeHex = isHex;

/**
 * Guesses whether a token is text, a surface, or both, from its name.
 *
 * Without this every colour pairs with every other, which for a twelve-token
 * system means most of the grid describes combinations nobody would ship — and
 * worse, it makes "fix all" try to satisfy constraints no colour could meet.
 * Design systems name things consistently enough that the name is a good signal,
 * and the role is a visible control the moment the guess is wrong.
 *
 * Surface wins ties: `surface-ink` is a dark background, not a text colour.
 */
export function inferRole(name: string): 'both' | 'text' | 'surface' {
  const n = name.toLowerCase();
  if (/\b(surface|background|bg|canvas|paper|base|fill|elevation)\b|^bg-|-bg$/.test(n)) {
    return 'surface';
  }
  // Status and semantic colours are overwhelmingly used as text, icons and
  // borders. Treating them as surfaces too would fill the grid with pairings
  // like muted-grey-on-critical-red that nobody ships, and drag the summary
  // percentage down with combinations that were never intended.
  if (
    /\b(text|ink|fg|foreground|label|body|heading|caption|link|positive|negative|success|error|danger|warning|critical|info|muted)\b|^text-/.test(
      n,
    )
  ) {
    return 'text';
  }
  return 'both';
}

/**
 * A light system, deliberately.
 *
 * Adding a near-black surface here would make every text colour conflict — no
 * single value is legible on both white and near-black — and the first thing a
 * visitor saw would be a wall of "needs a decision". That behaviour is correct
 * and worth reaching, but it is not the opening move. Add a dark surface and the
 * conflict reporting appears on its own.
 */
export const SAMPLE_PALETTE = `--surface:       #ffffff
--surface-sunk:  #f4f5f7
--text-primary:  #1b1d22
--text-muted:    #8b8f98
--brand-500:     #2f6fed
--brand-600:     #1b4fc4
--positive:      #17a06a
--warning:       #e0a010
--critical:      #e0483c`;
