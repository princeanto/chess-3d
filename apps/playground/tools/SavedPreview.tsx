'use client';

/**
 * A small picture of a saved thing, redrawn from its recipe.
 *
 * Patterns become an <img> of their SVG: the browser rasterises an image once
 * and never lays out its shapes, so a page of dense patterns stays light. Type
 * stays inline, because an SVG inside an <img> cannot see the page's fonts.
 */

import { useEffect, useMemo, useState } from 'react';
import type { Saved } from '@/lib/saved';
import { toCss, type Gradient } from '@/lib/gradient';
import { RANGES, patternSvg, type PatternState } from '@/lib/pattern';
import { DEFAULT_TYPE, typeSvg, type TypeState } from '@/lib/typeset';
import { ensureFont, fontById, knowGoogleFont } from '@/lib/fonts';
import type { GoogleFamily } from '@/lib/googleFonts';

const fill: React.CSSProperties = { display: 'block', width: '100%', height: '100%' };

function TypePreview({ recipe }: { recipe: Record<string, unknown> }) {
  const state = useMemo(() => ({ ...DEFAULT_TYPE, ...(recipe as Partial<TypeState>) }), [recipe]);
  const google = recipe.googleFont as GoogleFamily | undefined;
  const [, setReady] = useState(0);
  useEffect(() => {
    if (!google) return;
    knowGoogleFont(google);
    ensureFont(fontById(state.font)).then(() => setReady((n) => n + 1), () => undefined);
  }, [google, state.font]);
  const svg = typeSvg(state, typeof state.size === 'number' ? state.size : 120);
  return <span style={fill} dangerouslySetInnerHTML={{ __html: svg.replace('<svg ', '<svg style="display:block;width:100%;height:100%" ') }} />;
}

export default function SavedPreview({ item }: { item: Saved }) {
  const { recipe } = item;
  const pattern = useMemo(() => {
    if (item.tool !== 'shape' || !RANGES[(recipe as Partial<PatternState>).kind as keyof typeof RANGES]) return null;
    return `data:image/svg+xml,${encodeURIComponent(patternSvg(recipe as unknown as PatternState, 360))}`;
  }, [item.tool, recipe]);

  if (item.tool === 'make' && typeof recipe.preview === 'string') {
    return <span style={fill} dangerouslySetInnerHTML={{ __html: recipe.preview.replace('<svg ', '<svg style="display:block;width:100%;height:100%" ') }} />;
  }
  if (item.tool === 'play') {
    const text = (recipe.challenge as { text?: string } | undefined)?.text ?? '';
    return (
      <span style={{ ...fill, display: 'grid', placeItems: 'center', padding: '10%', boxSizing: 'border-box', background: 'var(--ink)', color: 'var(--bg)', fontWeight: 800, fontSize: 13, lineHeight: 1.15, letterSpacing: '-0.02em', textAlign: 'center' }}>
        {text}
      </span>
    );
  }
  if (item.thumb) return <img src={item.thumb} alt="" style={{ ...fill, objectFit: 'contain' }} />;
  if (pattern) return <img src={pattern} alt="" loading="lazy" style={{ ...fill, objectFit: 'cover' }} />;
  if (item.tool === 'type') return <TypePreview recipe={recipe} />;
  if (item.tool === 'color' && item.kind === 'Gradient' && recipe.gradient) {
    return <span style={{ ...fill, background: toCss(recipe.gradient as Gradient) }} />;
  }
  const colors = (Array.isArray(recipe.colors) ? recipe.colors : item.colors) as string[];
  return (
    <span style={{ ...fill, display: 'flex' }}>
      {colors.map((hex, i) => <i key={i} style={{ flex: 1, background: hex }} />)}
    </span>
  );
}
