/**
 * Camera viewpoints.
 *
 * The scene is deliberately not orbitable by dragging — every angle you can
 * reach is one that was framed on purpose. Each view carries both a position
 * and a look-at target, because a good three-quarter shot needs the camera
 * aimed slightly differently from a head-on one, not just moved.
 */

export interface View {
  id: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  /** Narrower for the head-on shot, so the screen fills more of the frame. */
  fov: number;
}

export const VIEWS: View[] = [
  {
    id: 'front',
    label: 'Front',
    position: [0, 2.6, 7.8],
    target: [0, 1.15, -0.35],
    fov: 34,
  },
  {
    id: 'left',
    label: 'Left',
    position: [-6.4, 3.1, 5.6],
    target: [-0.1, 1.0, -0.7],
    fov: 36,
  },
  {
    id: 'right',
    label: 'Right',
    position: [6.6, 3.0, 5.4],
    target: [0.1, 1.0, -0.7],
    fov: 36,
  },
  {
    id: 'desk',
    label: 'Overhead',
    position: [0, 7.0, 4.4],
    target: [0, 0.4, 0.6],
    fov: 38,
  },
];

export const DEFAULT_VIEW = 0;

/** easeInOutCubic — starts and stops still, which reads as a considered move. */
export const ease = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const VIEW_MS = 750;
