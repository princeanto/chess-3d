import type { Brush } from '@/lib/draw';

const common = { width: 18, height: 18, viewBox: '0 0 18 18', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export function BrushIcon({ brush }: { brush: Brush }) {
  switch (brush) {
    case 'pencil':
      return <svg {...common}><path d="M3 15l1-3.5L12.5 3a1.4 1.4 0 012 2L6 13.5 3 15z" /><path d="M11 4.5l2.5 2.5" /></svg>;
    case 'marker':
      return <svg {...common}><path d="M4 14l2-5 5.5-5.5a1.8 1.8 0 012.5 2.5L8.5 11.5 4 14z" /><path d="M3 16h6" strokeWidth={2.4} /></svg>;
    case 'eraser':
      return <svg {...common}><path d="M7 15l-3.2-3.2a1.5 1.5 0 010-2.1L10 3.5a1.5 1.5 0 012.1 0l2.4 2.4a1.5 1.5 0 010 2.1L8 14.5" /><path d="M7 15h8M6.5 7l4.5 4.5" /></svg>;
    case 'line':
      return <svg {...common}><path d="M3.5 14.5l11-11" /></svg>;
    case 'rect':
      return <svg {...common}><rect x="3" y="4" width="12" height="10" rx="0.5" /></svg>;
    default:
      return <svg {...common}><circle cx="9" cy="9" r="6" /></svg>;
  }
}

export const UndoIcon = () => <svg {...common}><path d="M6 4L3 7l3 3" /><path d="M3 7h7.5a4 4 0 010 8H7" /></svg>;
export const RedoIcon = () => <svg {...common}><path d="M12 4l3 3-3 3" /><path d="M15 7H7.5a4 4 0 000 8H11" /></svg>;
export const ClearIcon = () => <svg {...common}><path d="M3.5 5h11M7 5V3.5h4V5M5 5l.8 10h6.4L13 5" /></svg>;
