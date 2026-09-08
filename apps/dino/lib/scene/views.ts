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
  /*
   * The default, and the only one framed on the picture rather than the object.
   *
   * Any shot wide enough to include the keyboard puts the screen at about a
   * fifth of the frame height, which leaves the runner around fifteen pixels
   * tall — too small to read. The keyboard sits two units below the screen and
   * well forward of it, so no framing holds both and still shows the game: this
   * one gives up the keyboard to make the game legible, and the other four are
   * there to show the machine.
   */
  {
    id: 'screen',
    label: 'Screen',
    position: [0, 1.46, 4.65],
    target: [0, 1.14, 0.2],
    fov: 34,
  },
  {
    id: 'front',
    label: 'Front',
    position: [0, 3.4, 8.6],
    target: [0, 0.95, 0.5],
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
