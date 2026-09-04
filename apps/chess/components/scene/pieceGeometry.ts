import * as THREE from 'three';
import { BISHOP, KING, KNIGHT, PAWN, QUEEN, ROOK } from '@/lib/chess/types';

/**
 * Procedural piece geometry.
 *
 * Every piece is a lathed silhouette plus a few solid details, so the set ships
 * with no model files, no loader and no licensing question — and the whole
 * family shares one base and collar profile, which is what makes a chess set
 * read as a set rather than six unrelated objects.
 *
 * Profiles are authored in (radius, height) with a square edge of 1.0 unit.
 */

type P = [number, number];

const line = (a: P, b: P, n = 2): P[] => {
  const out: P[] = [];
  for (let i = 1; i <= n; i += 1) {
    const t = i / n;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
};

/** Quadratic Bézier — the workhorse for ogee curves and flares. */
const bez = (a: P, c: P, b: P, n = 10): P[] => {
  const out: P[] = [];
  for (let i = 1; i <= n; i += 1) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
    ]);
  }
  return out;
};

/** Circular arc in profile space; angles in degrees. */
const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n = 14): P[] => {
  const out: P[] = [];
  for (let i = 1; i <= n; i += 1) {
    const a = ((a0 + (a1 - a0) * (i / n)) * Math.PI) / 180;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
};

const lathe = (points: P[], segments = 56): THREE.BufferGeometry => {
  const vec = points.map(([x, y]) => new THREE.Vector2(Math.max(x, 0.0001), y));
  const g = new THREE.LatheGeometry(vec, segments);
  g.computeVertexNormals();
  return g;
};

/** Shared foot: a broad disc with an ogee flare into the stem. */
function foot(radius: number, top: number): P[] {
  return [
    [0, 0],
    ...line([0, 0], [radius, 0], 3),
    ...line([radius, 0], [radius, 0.042], 2),
    ...bez([radius, 0.042], [radius, 0.1], [radius * 0.72, 0.125], 8),
    ...bez([radius * 0.72, 0.125], [radius * 0.5, 0.15], [top, 0.185], 8),
  ];
}

/** Shared collar: the ring every piece wears where the stem meets its head. */
function collar(stem: number, at: number, flare: number): P[] {
  return [
    ...bez([stem, at], [flare, at + 0.012], [flare, at + 0.042], 6),
    ...line([flare, at + 0.042], [flare * 0.97, at + 0.062], 2),
    ...bez([flare * 0.97, at + 0.062], [stem * 0.92, at + 0.086], [stem * 0.86, at + 0.1], 6),
  ];
}

function pawnProfile(): P[] {
  const pts: P[] = [...foot(0.315, 0.15)];
  pts.push(...bez([0.15, 0.185], [0.118, 0.3], [0.128, 0.4], 12));
  pts.push(...collar(0.128, 0.4, 0.192));
  pts.push(...bez([0.11, 0.5], [0.104, 0.53], [0.115, 0.552], 5));
  pts.push(...arc(0, 0.688, 0.163, -46, 90, 18));
  return pts;
}

function rookProfile(): P[] {
  const pts: P[] = [...foot(0.34, 0.2)];
  pts.push(...bez([0.2, 0.185], [0.178, 0.3], [0.186, 0.44], 10));
  pts.push(...collar(0.186, 0.44, 0.244));
  pts.push(...line([0.16, 0.54], [0.222, 0.58], 3));
  pts.push(...line([0.222, 0.58], [0.238, 0.7], 4));
  pts.push(...bez([0.238, 0.7], [0.262, 0.72], [0.262, 0.755], 5));
  pts.push(...line([0.262, 0.755], [0.198, 0.755], 3)); // rim, hollowed a little
  pts.push(...line([0.198, 0.755], [0.198, 0.705], 2));
  pts.push([0, 0.705]);
  return pts;
}

function bishopProfile(): P[] {
  const pts: P[] = [...foot(0.325, 0.17)];
  pts.push(...bez([0.17, 0.185], [0.14, 0.32], [0.152, 0.46], 12));
  pts.push(...collar(0.152, 0.46, 0.216));
  pts.push(...bez([0.131, 0.56], [0.126, 0.585], [0.15, 0.605], 5));
  pts.push(...bez([0.15, 0.605], [0.205, 0.65], [0.176, 0.79], 12));
  pts.push(...bez([0.176, 0.79], [0.156, 0.87], [0.072, 0.9], 10));
  pts.push(...bez([0.072, 0.9], [0.052, 0.905], [0.05, 0.925], 4));
  pts.push(...arc(0, 0.955, 0.052, -35, 90, 10)); // finial bud
  return pts;
}

function knightBaseProfile(): P[] {
  const pts: P[] = [...foot(0.325, 0.185)];
  pts.push(...bez([0.185, 0.185], [0.176, 0.205], [0.182, 0.225], 6));
  pts.push(...collar(0.182, 0.225, 0.228));
  pts.push(...bez([0.156, 0.325], [0.162, 0.346], [0.134, 0.358], 5));
  pts.push([0, 0.358]);
  return pts;
}

function queenProfile(): P[] {
  const pts: P[] = [...foot(0.355, 0.19)];
  pts.push(...bez([0.19, 0.185], [0.15, 0.36], [0.162, 0.56], 14));
  pts.push(...collar(0.162, 0.56, 0.228));
  pts.push(...bez([0.139, 0.66], [0.132, 0.7], [0.168, 0.745], 6));
  pts.push(...bez([0.168, 0.745], [0.235, 0.8], [0.243, 0.885], 12));
  pts.push(...line([0.243, 0.885], [0.222, 0.9], 2)); // crown rim
  pts.push(...bez([0.222, 0.9], [0.13, 0.915], [0.108, 0.955], 8));
  pts.push(...bez([0.108, 0.955], [0.086, 0.975], [0.075, 1.0], 5));
  pts.push(...arc(0, 1.035, 0.07, -30, 90, 12)); // orb
  return pts;
}

function kingProfile(): P[] {
  const pts: P[] = [...foot(0.36, 0.2)];
  pts.push(...bez([0.2, 0.185], [0.158, 0.4], [0.17, 0.62], 14));
  pts.push(...collar(0.17, 0.62, 0.236));
  pts.push(...bez([0.146, 0.72], [0.14, 0.765], [0.178, 0.81], 6));
  pts.push(...bez([0.178, 0.81], [0.245, 0.86], [0.248, 0.95], 12));
  pts.push(...line([0.248, 0.95], [0.226, 0.968], 2));
  pts.push(...bez([0.226, 0.968], [0.15, 0.985], [0.128, 1.02], 8));
  pts.push(...line([0.128, 1.02], [0.1, 1.045], 3));
  pts.push([0, 1.045]);
  return pts;
}

/* --------------------------- knight silhouette --------------------------- */

/**
 * The knight is the one piece a lathe cannot describe, so it is an extruded
 * side profile — the same solution a real carver uses.
 */
// A Staunton knight is mostly head: the carving should stand roughly twice the
// height of the footing it sits on, not perch on top of a tall pedestal.
const KNIGHT_DEPTH = 0.26;
const KNIGHT_SCALE = 1.4;
const KNIGHT_LIFT = 0.25;

function knightShape(): THREE.Shape {
  // Authored with the chest at y = 0 so the head seats into the collar, and read
  // nose-forward: arched neck, stepped mane, ears, brow, nose bridge, muzzle,
  // jaw, throat. The mane steps are cut into the silhouette rather than added as
  // separate blocks — carved, not glued on.
  const s = new THREE.Shape();
  s.moveTo(-0.188, 0.0);
  s.bezierCurveTo(-0.253, 0.052, -0.271, 0.116, -0.263, 0.174); // back of neck
  s.bezierCurveTo(-0.256, 0.238, -0.252, 0.281, -0.243, 0.316);

  s.lineTo(-0.219, 0.352); // mane, three carved steps
  s.lineTo(-0.259, 0.377);
  s.lineTo(-0.209, 0.405);
  s.lineTo(-0.247, 0.430);
  s.lineTo(-0.196, 0.455);

  s.lineTo(-0.216, 0.518); // near ear
  s.lineTo(-0.152, 0.452); // valley between the ears
  s.lineTo(-0.116, 0.528); // far ear
  s.lineTo(-0.066, 0.446);

  s.bezierCurveTo(-0.008, 0.462, 0.024, 0.457, 0.053, 0.443); // poll into brow
  s.bezierCurveTo(0.108, 0.424, 0.126, 0.410, 0.147, 0.391);
  s.bezierCurveTo(0.212, 0.334, 0.238, 0.301, 0.250, 0.267); // nose bridge
  s.bezierCurveTo(0.273, 0.227, 0.270, 0.209, 0.257, 0.191); // nose tip
  s.bezierCurveTo(0.243, 0.162, 0.226, 0.155, 0.206, 0.157); // nostril underside
  s.bezierCurveTo(0.177, 0.154, 0.164, 0.166, 0.153, 0.177); // upper lip
  s.bezierCurveTo(0.129, 0.197, 0.114, 0.194, 0.098, 0.186); // mouth line
  s.bezierCurveTo(0.062, 0.171, 0.048, 0.155, 0.036, 0.131); // jaw
  s.bezierCurveTo(0.012, 0.089, -0.001, 0.074, -0.015, 0.057); // jowl
  s.bezierCurveTo(-0.062, 0.019, -0.104, 0.004, -0.131, 0.003); // throat
  s.lineTo(-0.188, 0.0);
  s.closePath();
  return s;
}

/**
 * Lofts a 2D outline along Z with a varying cross-section instead of extruding
 * it straight. A straight extrusion reads as a flat plate from the playing
 * camera, which looks down on the piece; tapering toward both faces turns the
 * same silhouette into a rounded carving with a crest along the mane.
 */
let loftCentroid = { x: 0, y: 0 };

function loftShape(
  shape: THREE.Shape,
  depth: number,
  slices: number,
  widthAt: (t: number) => number,
): THREE.BufferGeometry {
  const outline = shape.getPoints(140);
  // getPoints closes the loop by repeating the first point; drop the duplicate.
  if (
    outline.length > 1 &&
    Math.abs(outline[0].x - outline[outline.length - 1].x) < 1e-6 &&
    Math.abs(outline[0].y - outline[outline.length - 1].y) < 1e-6
  ) {
    outline.pop();
  }

  // The authored path happens to run clockwise; normalise to counter-clockwise
  // so side quads and end caps can use one consistent winding. Getting this
  // wrong points every face inward and the solid renders as a hollow shell.
  let area = 0;
  for (let i = 0; i < outline.length; i += 1) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    area += a.x * b.y - b.x * a.y;
  }
  if (area < 0) outline.reverse();

  const n = outline.length;
  let cx = 0;
  let cy = 0;
  for (const p of outline) {
    cx += p.x;
    cy += p.y;
  }
  cx /= n;
  cy /= n;
  loftCentroid = { x: cx, y: cy };

  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= slices; i += 1) {
    const t = i / slices;
    const z = (t - 0.5) * depth;
    const k = widthAt(t);
    for (const p of outline) {
      positions.push(cx + (p.x - cx) * k, cy + (p.y - cy) * k, z);
    }
  }

  for (let i = 0; i < slices; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const j2 = (j + 1) % n;
      const a = i * n + j;
      const b = i * n + j2;
      const c = (i + 1) * n + j;
      const d = (i + 1) * n + j2;
      indices.push(a, b, d, a, d, c);
    }
  }

  // Proper triangulation for the two end caps — a centroid fan would fold over
  // the concave notches between the ears.
  const faces = THREE.ShapeUtils.triangulateShape(outline, []);
  const first = 0;
  const last = slices * n;
  for (const [a, b, c] of faces) {
    indices.push(first + c, first + b, first + a); // -Z cap faces away from +Z
    indices.push(last + a, last + b, last + c);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

let knightHeadGeometry: THREE.BufferGeometry | null = null;
function getKnightHead(): THREE.BufferGeometry {
  if (knightHeadGeometry) return knightHeadGeometry;
  const g = loftShape(
    knightShape(),
    KNIGHT_DEPTH,
    16,
    // Full width through the cheeks, tapering to a rounded edge at each face.
    (t) => KNIGHT_CHEEK + (1 - KNIGHT_CHEEK) * Math.sin(Math.PI * t) ** 0.65,
  );
  g.scale(KNIGHT_SCALE, KNIGHT_SCALE, 1);
  g.rotateY(Math.PI / 2); // nose down -Z; the loft is already centred on Z
  g.translate(0, KNIGHT_LIFT, 0);
  g.computeVertexNormals();
  knightHeadGeometry = g;
  return g;
}

/** Width of the loft at its end faces — where the cheeks, and so the eyes, are. */
const KNIGHT_CHEEK = 0.7;

/**
 * Shape-space point to world, matching the transforms in getKnightHead. The end
 * faces carry the outline scaled about its centroid, so a detail pinned to the
 * cheek has to be scaled the same way or it floats off the surface.
 */
function knightPoint(sx: number, sy: number, side: number): [number, number, number] {
  getKnightHead(); // ensures the centroid is populated
  const px = loftCentroid.x + (sx - loftCentroid.x) * KNIGHT_CHEEK;
  const py = loftCentroid.y + (sy - loftCentroid.y) * KNIGHT_CHEEK;
  return [
    side * (KNIGHT_DEPTH / 2 + 0.004),
    KNIGHT_SCALE * py + KNIGHT_LIFT,
    -KNIGHT_SCALE * px,
  ];
}

/* ------------------------------- assembly -------------------------------- */

export interface PieceParts {
  /** Lathed body. */
  body: THREE.BufferGeometry;
  /** Extra solids merged into the same material. */
  details: Array<{
    geometry: THREE.BufferGeometry;
    position: [number, number, number];
    rotation?: [number, number, number];
  }>;
  /** Silhouette height, used for capture animations and hover lift. */
  height: number;
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const sphere = (r: number) => new THREE.SphereGeometry(r, 24, 16);

function rookDetails(): PieceParts['details'] {
  const details: PieceParts['details'] = [];
  const merlons = 8;
  for (let i = 0; i < merlons; i += 1) {
    const a = (i / merlons) * Math.PI * 2 + Math.PI / merlons;
    const r = 0.229;
    details.push({
      geometry: box(0.083, 0.088, 0.072),
      position: [Math.cos(a) * r, 0.8, Math.sin(a) * r],
      rotation: [0, -a, 0],
    });
  }
  return details;
}

function queenDetails(): PieceParts['details'] {
  const details: PieceParts['details'] = [];
  const points = 8;
  for (let i = 0; i < points; i += 1) {
    const a = (i / points) * Math.PI * 2;
    const r = 0.232;
    details.push({ geometry: sphere(0.042), position: [Math.cos(a) * r, 0.9, Math.sin(a) * r] });
  }
  return details;
}

function kingDetails(): PieceParts['details'] {
  return [
    { geometry: box(0.055, 0.2, 0.055), position: [0, 1.13, 0] },
    { geometry: box(0.145, 0.052, 0.052), position: [0, 1.152, 0] },
  ];
}

function bishopDetails(): PieceParts['details'] {
  // The mitre's cut, angled the way a real bishop's is.
  return [
    {
      geometry: box(0.016, 0.15, 0.1),
      position: [0.0, 0.822, 0.028],
      rotation: [0.44, 0, 0],
    },
  ];
}

/**
 * Profiles are authored at a convenient scale, then stretched vertically to
 * tournament proportions: a Staunton king stands about 1.65 square-widths tall,
 * a pawn about 0.9. Stretching in Y only keeps the bases correctly sized —
 * scaling uniformly would have them spilling over the square edges.
 */
const HEIGHT_SCALE: Record<number, number> = {
  [PAWN]: 1.28,
  [KNIGHT]: 1.3,
  [BISHOP]: 1.34,
  [ROOK]: 1.26,
  [QUEEN]: 1.36,
  [KING]: 1.4,
};

function stretch(parts: PieceParts, k: number): PieceParts {
  parts.body.scale(1, k, 1);
  parts.body.computeVertexNormals();
  return {
    body: parts.body,
    height: parts.height * k,
    details: parts.details.map((d) => {
      const geometry = d.geometry.clone();
      geometry.scale(1, k, 1);
      geometry.computeVertexNormals();
      return {
        geometry,
        position: [d.position[0], d.position[1] * k, d.position[2]] as [number, number, number],
        rotation: d.rotation,
      };
    }),
  };
}

const cache = new Map<number, PieceParts>();

export function getPieceParts(type: number): PieceParts {
  const hit = cache.get(type);
  if (hit) return hit;

  let parts: PieceParts;
  switch (type) {
    case PAWN:
      parts = { body: lathe(pawnProfile()), details: [], height: 0.85 };
      break;
    case ROOK:
      parts = { body: lathe(rookProfile()), details: rookDetails(), height: 0.85 };
      break;
    case KNIGHT:
      parts = {
        body: lathe(knightBaseProfile()),
        details: [
          { geometry: getKnightHead(), position: [0, 0, 0] },
          // Eyes set proud of each cheek — the one detail that reads as a face
          // rather than a wedge at playing distance.
          { geometry: sphere(0.024), position: knightPoint(0.034, 0.35, 1) },
          { geometry: sphere(0.024), position: knightPoint(0.034, 0.35, -1) },
        ],
        height: 1.0,
      };
      break;
    case BISHOP:
      parts = { body: lathe(bishopProfile()), details: bishopDetails(), height: 1.01 };
      break;
    case QUEEN:
      parts = { body: lathe(queenProfile()), details: queenDetails(), height: 1.11 };
      break;
    case KING:
    default:
      parts = { body: lathe(kingProfile()), details: kingDetails(), height: 1.25 };
      break;
  }

  const scaled = stretch(parts, HEIGHT_SCALE[type] ?? 1.3);
  cache.set(type, scaled);
  return scaled;
}

export const PIECE_HEIGHTS: Record<number, number> = {
  [PAWN]: 0.85 * HEIGHT_SCALE[PAWN],
  [KNIGHT]: 1.0 * HEIGHT_SCALE[KNIGHT],
  [BISHOP]: 1.01 * HEIGHT_SCALE[BISHOP],
  [ROOK]: 0.85 * HEIGHT_SCALE[ROOK],
  [QUEEN]: 1.11 * HEIGHT_SCALE[QUEEN],
  [KING]: 1.25 * HEIGHT_SCALE[KING],
};
