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
    position: [0, 1.55, 5.15],
    target: [0, 1.32, 0.2],
    fov: 34,
  },
  {
    id: 'front',
    label: 'Front',
    position: [0, 3.5, 8.6],
    target: [0, 1.15, 0.5],
    fov: 34,
  },
  {
    id: 'left',
    label: 'Left',
    position: [-6.4, 3.2, 5.6],
    target: [-0.1, 1.2, -0.7],
    fov: 36,
  },
  {
    id: 'right',
    label: 'Right',
    position: [6.6, 3.1, 5.4],
    target: [0.1, 1.2, -0.7],
    fov: 36,
  },
  {
    id: 'back',
    label: 'Back',
    position: [-3.4, 2.6, -5.6],
    target: [0, 1.2, -1.2],
    fov: 36,
  },
  {
    /*
     * The whole room as a diorama.
     *
     * Isometric in feel rather than in fact: a long lens from a long way out is
     * close enough to parallel, and it keeps one perspective camera for every
     * viewpoint instead of swapping projections mid-flight. The distance is
     * what buys the parallelism — 50 units out at 19 degrees, not 30 at 27.
     */
    id: 'room',
    label: 'Room',
    position: [30, 26, 33],
    target: [0, 0.5, 1.5],
    fov: 19,
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
