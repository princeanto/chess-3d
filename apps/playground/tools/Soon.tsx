'use client';

/**
 * A tool that has not been built yet, saying so.
 *
 * Not a fake: nothing here pretends to work. It names what is coming, and points
 * back to the thing that does.
 */

import { useStore } from '@/lib/store';
import type { ToolInfo } from '@/lib/tools';
import { Button } from '@/components/ui';

const NEXT: Record<string, string> = {
  type: 'Huge type, seven presets, and a Randomize that knows when to stop.',
  shape: 'Thirteen kinds of pattern, each one reproducible from its seed.',
  draw: 'Pencil, marker, shapes, grids, and radial symmetry up to twelve ways.',
  make: 'Posters, wallpapers and cards, with a Surprise me that has taste.',
  play: 'A brief when you need one, and a timer to keep you honest.',
};

export default function Soon({ tool }: { tool: ToolInfo }) {
  const store = useStore();
  return (
    <section className="soon">
      <p className="soon-line">{tool.label} lands in the next update.</p>
      <p className="soon-sub">{NEXT[tool.id]}</p>
      <p className="soon-sub">
        Meanwhile, the palette you make in Color will be waiting here when it arrives.
      </p>
      <div className="soon-swatches" aria-hidden="true">
        {store.palette.map((hex, i) => (
          <i key={i} style={{ background: hex }} />
        ))}
      </div>
      <Button variant="solid" onClick={() => store.setTool('color')}>
        Back to Color
      </Button>
    </section>
  );
}
