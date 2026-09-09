'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { LIVE_CODES, layoutKeys, type PlacedKey } from '@/lib/scene/keys';
import Room from './Room';

/**
 * Half-width of the machine at a given depth. 0 is the face, 1 is the tail.
 *
 * Widest just behind the face, then a long taper closing to nothing at the very
 * back — the rear of the shell is a rounded end, so in a sweep like this the
 * last section is a point, the same way a sphere's is.
 */
const HALF_W = 1.125;

function halfWidthAt(t: number): number {
  /*
   * The nose has to close in plan as well as in section.
   *
   * At the front the profile's section has almost no height — it is the edge
   * where the face turns under — but the width was still 93% of maximum there,
   * so the machine's leading feature was a razor-thin blade 2.09 across whose
   * ends showed as beaks at the bottom corners of the front. Tapering to
   * nothing over the first 3% of the depth rounds that edge off in plan.
   */
  const nose = Math.pow(Math.min(1, t / 0.03), 0.42);
  return HALF_W * nose * Math.pow(Math.max(0, 1 - Math.pow(t, 2.4)), 0.4);
}

/**
 * Superellipse exponent of the cross-section at a given depth.
 *
 * The face is nearly a rounded square and the tail is nearly an ellipse, so the
 * exponent falls off going back. This one parameter carries most of the
 * character of the shell.
 */
function sectionExponent(t: number): number {
  return 3.5 - 1.4 * t;
}

/**
 * The shell, as a cross-section swept front to back.
 *
 * It used to be the side profile extruded sideways with a bevel, and that can
 * only ever produce a prism: the flanks came out as two big flat planes meeting
 * the top along a hard crease, which is why the machine kept reading as a boxy
 * loaf however carefully the profile itself was fitted. Sweeping a superellipse
 * whose width, height and squareness all vary with depth gives a genuinely
 * domed body with no crease in it anywhere.
 *
 * Built indexed so shared vertices average their normals. The extruded version
 * was non-indexed, so every triangle was flat-shaded and the shell faceted.
 */
/** How far the shell is lowered so its feet meet the desk. */
const BODY_DROP = 0.1;

/**
 * The two ends of the profile's front edge.
 *
 * Everything about the face is derived from these: its slope, its tilt, the
 * plane the panel is flattened onto and the depth the screen group sits at.
 * They used to be repeated as literals in four places and drifted apart every
 * time the profile moved.
 */
const FACE_BOTTOM = { x: 0.1, y: 0.47 };
const FACE_TOP = { x: 0.23, y: 2.26 };
const FACE_SLOPE = (FACE_TOP.x - FACE_BOTTOM.x) / (FACE_TOP.y - FACE_BOTTOM.y);

/*
 * The face.
 *
 * The CRT is pushed up the front, leaving a deep chin under it for the CD tray,
 * the power button and the two speakers. That chin is most of what makes the
 * front read as an iMac rather than as a generic monitor.
 *
 * The tube is sized so the bezel clears the top of the flat panel. An earlier
 * pass had it 1.26 tall in a face 1.82 tall, which left 0.045 of margin above
 * it — too little for the panel to reach the bezel's corners and still roll
 * into the dome, so the top of the surround was sitting on curved shell.
 */
export const SCREEN_SIZE = { w: 1.44, h: 1.08 };
/** World height of the tube's centre. */
export const SCREEN_Y = 1.38;
/**
 * How far the face leans back, in radians.
 *
 * Negative: the profile's front edge runs from x 0.09 at the bottom to 0.23 at
 * the top and shape X points backwards, so going up the face moves away from
 * the viewer. With the sign the other way the whole chin was rotated *into* the
 * shell, which is why the CD slot and speakers were invisible.
 */
export const FACE_TILT = -Math.atan(FACE_SLOPE);

/**
 * The flat front panel.
 *
 * The swept shell's front is a dome, not a plane: measured at the bezel's edge
 * it falls 0.007 behind the centreline halfway up and 0.014 by the top. A flat
 * bezel laid on it therefore only touched in the middle and stood off at the
 * corners with daylight behind it — which is what the screen looked like, a
 * panel hovering in front of the case.
 *
 * So the front is flattened into an actual panel: vertices inside a rounded
 * rectangle are drawn forward onto the face plane, blended over a band at the
 * edge so the shell rolls into it instead of meeting it at a knife edge.
 *
 * The rectangle has to cover the bezel's corners with the mask still at full
 * strength, or the surround ends up part on flat panel and part on curved
 * shell. It also has to *stop short of the silhouette*: at half-width 1.05
 * against a shell 1.04 wide at the face, the mask was still at full strength
 * where the front wraps to the side, so the panel ran edge to edge and its
 * boundary landed on the silhouette as a knife edge instead of rolling into the
 * dome. Full strength out to the bezel at 0.845, nothing left by 1.00.
 */
const PANEL = {
  cy: 1.31,
  halfW: 0.9225,
  halfH: 0.898,
  /*
   * Different corner radii top and bottom.
   *
   * The bezel comes within 0.07 of the panel's top corners, so a generous
   * radius there would pull the mask off the surround. Below the tube there is
   * a third of the face free, and with the same tight radius the panel's bottom
   * corners came to a point — the front ended in a beak where it should have
   * turned into the underside.
   */
  radiusTop: 0.12,
  radiusBottom: 0.34,
  band: 0.078,
};

/**
 * The hole the tube sits in.
 *
 * Cut a little wider than the bezel ring's inner opening so the ring's annulus
 * covers the cut edge. Without a real aperture the tube could only ever sit in
 * *front* of the panel — a black surround standing proud of the case — because
 * anything set back was simply occluded by the solid shell.
 */
const APERTURE = {
  cy: SCREEN_Y + BODY_DROP,
  halfW: SCREEN_SIZE.w / 2 + 0.04,
  halfH: SCREEN_SIZE.h / 2 + 0.04,
  radius: 0.13,
};

function inAperture(px: number, py: number): boolean {
  const dx = Math.max(0, Math.abs(px) - (APERTURE.halfW - APERTURE.radius));
  const dy = Math.max(0, Math.abs(py - APERTURE.cy) - (APERTURE.halfH - APERTURE.radius));
  return Math.hypot(dx, dy) - APERTURE.radius < 0;
}

/** 1 well inside the panel, 0 well outside it. */
function panelMask(px: number, py: number): number {
  const r = py < PANEL.cy ? PANEL.radiusBottom : PANEL.radiusTop;
  const dx = Math.max(0, Math.abs(px) - (PANEL.halfW - r));
  const dy = Math.max(0, Math.abs(py - PANEL.cy) - (PANEL.halfH - r));
  const dist = Math.hypot(dx, dy) - r;
  const u = Math.min(1, Math.max(0, (PANEL.band - dist) / (2 * PANEL.band)));
  return u * u * (3 - 2 * u);
}

/** The profile, sampled once — every surface query below reads from it. */
const PROFILE = bodyProfile().getPoints(900);
const PROFILE_X0 = Math.min(...PROFILE.map((p) => p.x));
const PROFILE_X1 = Math.max(...PROFILE.map((p) => p.x));

/**
 * Vertical extent of the side profile at a given depth.
 *
 * Intersects the outline's segments rather than gathering sampled points near
 * `x`. three.js hands back only the two endpoints for a straight run, so the
 * flat base and the slanted face contributed no samples between them: from a
 * quarter to four fifths of the way back, nothing was found underneath and the
 * section collapsed to a blade along the crown. The machine came out solid at
 * the front, solid at the tail, and hollow through the middle.
 */
function spanAt(x: number): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < PROFILE.length; i += 1) {
    const a = PROFILE[i];
    const b = PROFILE[(i + 1) % PROFILE.length];
    const dx = b.x - a.x;
    if (dx === 0) {
      if (Math.abs(a.x - x) < 1e-9) {
        lo = Math.min(lo, a.y, b.y);
        hi = Math.max(hi, a.y, b.y);
      }
      continue;
    }
    const u = (x - a.x) / dx;
    if (u < 0 || u > 1) continue;
    const y = a.y + u * (b.y - a.y);
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  return lo === Infinity ? [0, 0] : [lo, hi];
}

/** World Z of the face plane at a given height in the shell's own frame. */
function faceZ(py: number): number {
  const x = FACE_BOTTOM.x + (py - FACE_BOTTOM.y) * FACE_SLOPE;
  return 0.11 - (x - PROFILE_X0);
}

/**
 * How far out the flank sits at a given height and depth.
 *
 * The same superellipse the shell is swept from, solved for x instead of walked
 * round. Anything that has to lie *on* the case — the port door, the speaker
 * pods — is placed with this rather than by eye, which is what stopped earlier
 * details floating off the surface or sinking into it.
 */
function flankX(y: number, z: number): number {
  const t = Math.min(1, Math.max(0, (0.11 - z) / (PROFILE_X1 - PROFILE_X0)));
  const [lo, hi] = spanAt(PROFILE_X0 + t * (PROFILE_X1 - PROFILE_X0));
  const cy = (lo + hi) / 2;
  const ry = (hi - lo) / 2;
  if (ry <= 0) return 0;
  const q = Math.min(1, Math.abs(y - cy) / ry);
  const w = 0.5 + 0.5 * ((y - cy) / ry);
  const ease = w * w * (3 - 2 * w);
  const n = 3.6 + (sectionExponent(t) - 3.6) * ease;
  return halfWidthAt(t) * Math.pow(Math.max(0, 1 - Math.pow(q, n)), 1 / n);
}

/**
 * An elliptical patch lying on the right flank, lifted just clear of it.
 *
 * Anything flat pressed against this shell shows its corners: the flank falls
 * away in both directions, so a rectangle big enough to read as a door had its
 * four corners sticking out through the case. Sampling `flankX` across the
 * patch makes it curve with the surface, and an ellipse has no corners to leave
 * behind in the first place.
 */
function flankPatch(cy: number, cz: number, ry: number, rz: number, lift: number) {
  const RINGS = 7;
  const SEGS = 44;
  const position: number[] = [flankX(cy, cz) + lift, cy, cz];
  for (let r = 1; r <= RINGS; r += 1) {
    for (let a = 0; a < SEGS; a += 1) {
      const th = (a / SEGS) * Math.PI * 2;
      const y = cy + (r / RINGS) * ry * Math.sin(th);
      const z = cz + (r / RINGS) * rz * Math.cos(th);
      position.push(flankX(y, z) + lift, y, z);
    }
  }
  const index: number[] = [];
  for (let a = 0; a < SEGS; a += 1) {
    index.push(0, 1 + a, 1 + ((a + 1) % SEGS));
  }
  for (let r = 1; r < RINGS; r += 1) {
    const base = 1 + (r - 1) * SEGS;
    const next = 1 + r * SEGS;
    for (let a = 0; a < SEGS; a += 1) {
      const a2 = (a + 1) % SEGS;
      index.push(base + a, next + a, base + a2, base + a2, next + a, next + a2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * Height of the shell's underside at a given offset from the centreline.
 *
 * The belly is a shallow curve, not a plane: it is lowest along the centreline
 * and lifts toward the flanks. Feet pinned to the lowest point therefore hung
 * clear of the case everywhere else, which is exactly how they looked — four
 * pegs standing under a machine they never touched.
 *
 * The section's exponent depends on height and the height is what is being
 * solved for, so this settles it by iteration; four passes is plenty.
 */
function undersideY(px: number, z: number): number {
  const t = Math.min(1, Math.max(0, (0.11 - z) / (PROFILE_X1 - PROFILE_X0)));
  const [lo, hi] = spanAt(PROFILE_X0 + t * (PROFILE_X1 - PROFILE_X0));
  const cy = (lo + hi) / 2;
  const ry = (hi - lo) / 2;
  const rx = halfWidthAt(t);
  if (ry <= 0 || rx <= 0) return cy;
  const q = Math.min(1, Math.abs(px) / rx);
  let y = cy - ry;
  for (let k = 0; k < 4; k += 1) {
    const w = 0.5 + 0.5 * ((y - cy) / ry);
    const ease = w * w * (3 - 2 * w);
    const n = 3.6 + (sectionExponent(t) - 3.6) * ease;
    y = cy - ry * Math.pow(Math.max(0, 1 - Math.pow(q, n)), 1 / n);
  }
  return y;
}

function bodySurface(): THREE.BufferGeometry {
  const pts = PROFILE;
  const X0 = PROFILE_X0;
  const X1 = PROFILE_X1;
  const NZ = 168;
  const NA = 184;

  const position: number[] = [];
  const uv: number[] = [];
  /** Vertices that fall in the tube's hole, on the panel rather than at the back. */
  const cut: boolean[] = [];
  for (let i = 0; i <= NZ; i += 1) {
    // Biased toward the front, where the slanted face needs the resolution.
    const t = Math.pow(i / NZ, 1.5);
    const x = X0 + t * (X1 - X0);
    const [lo, hi] = spanAt(x);
    const cy = (lo + hi) / 2;
    const ry = (hi - lo) / 2;
    const rx = halfWidthAt(t);
    const z = 0.11 - (x - X0);
    for (let j = 0; j < NA; j += 1) {
      const a = (j / NA) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      /*
       * The underside is flatter than the crown: the machine stands on a desk.
       * A symmetric section rounded the belly as much as the top and left the
       * shell balanced on a curve with its feet dangling below it. Blended
       * rather than switched at the equator — swapping exponents abruptly there
       * put a crease around the machine and sliced the bottom off square.
       */
      const w = 0.5 + 0.5 * sn;
      const ease = w * w * (3 - 2 * w);
      const k = 2 / (3.6 + (sectionExponent(t) - 3.6) * ease);
      const px = Math.sign(c) * Math.pow(Math.abs(c), k) * rx;
      const py = cy + Math.sign(sn) * Math.pow(Math.abs(sn), k) * ry;
      /*
       * Draw the front forward onto the face plane. Only ever forward, so the
       * silhouette the profile was fitted to is left alone.
       *
       * The depth window matters as much as the outline: without it every
       * vertex whose width and height happened to fall inside the panel was
       * dragged to the front, back of the machine included, and the shell grew
       * flat fins out of its flanks. The real gap to close is at most 0.014.
       */
      const zFace = faceZ(py);
      const gap = zFace - z;
      let pz = z;
      if (gap > 0 && gap < 0.18) {
        const near = 1 - gap / 0.18;
        pz = z + gap * panelMask(px, py) * near * near;
      }
      position.push(px, py, pz);
      cut.push(z > -0.06 && inAperture(px, py));
      // Projected straight down the machine's axis, so the ribs run vertically
      // across the face — which is the only place they are meant to read.
      uv.push((px / HALF_W) * 0.5 + 0.5, py * 0.5);
    }
  }

  const index: number[] = [];
  for (let i = 0; i < NZ; i += 1) {
    for (let j = 0; j < NA; j += 1) {
      const a = i * NA + j;
      const b = i * NA + ((j + 1) % NA);
      const c = (i + 1) * NA + j;
      const d = (i + 1) * NA + ((j + 1) % NA);
      /*
       * Drop the quad if *any* corner is inside the hole.
       *
       * Requiring all four kept a jagged fringe of shell reaching a quad's width
       * back inside the opening, and since the tube is recessed that fringe
       * showed as white shapes lying across the picture's corners. Erring
       * outward instead makes the hole up to a quad larger than the aperture,
       * which the bezel's annulus still covers with room to spare.
       */
      if (cut[a] || cut[b] || cut[c] || cut[d]) continue;
      index.push(a, c, b, b, c, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();

  /*
   * The two plastics as vertex colours rather than as two material groups.
   *
   * Splitting triangles between two materials made the seam a visible row of
   * saw teeth, because a triangle can only be wholly one plastic or the other.
   * Colouring per vertex lets the boundary fall inside a quad, and at this mesh
   * density that is a clean line a couple of pixels wide.
   */
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const frost = new THREE.Color(FROST);
  const hood = new THREE.Color(BONDI);
  const mix = new THREE.Color();
  const colour: number[] = [];
  const BAND = 0.06;
  for (let v = 0; v < pos.count; v += 1) {
    const y = pos.getY(v);
    const z = pos.getZ(v);
    /*
     * Signed distance to the seam, not a yes/no test.
     *
     * Colour only exists at vertices, so choosing one plastic or the other per
     * vertex left the boundary snapping from quad to quad — a staircase across
     * the back. Blending over a narrow band gives an even edge, and a slightly
     * soft one is closer to the real thing anyway: the blue is translucent and
     * fades into the frosted plastic rather than stopping at a printed line.
     */
    const d = Math.max(z - frontSeamZ(nor.getY(v)), baseSeamY(z) - y);
    const u = Math.min(1, Math.max(0, (d + BAND) / (2 * BAND)));
    mix.copy(hood).lerp(frost, u * u * (3 - 2 * u));
    colour.push(mix.r, mix.g, mix.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colour, 3));
  return g;
}

/**
 * A 1998 iMac G3, on a black studio sweep.
 *
 * Built against the machine's published dimensions — 15.2 wide by 15.8 high by
 * 17.6 deep — and against photographs, which is how the two things that actually
 * make it recognisable got found: the shell is *two* plastics, a frosted white
 * front and base with the coloured translucent hood over the back, and it does
 * not sit on a narrow pedestal. Earlier versions were a single blue rounded box
 * standing on a stalk, and neither of those reads as an iMac.
 *
 * Translucency is two shells: a dark opaque chassis inside a tinted body. Real
 * `transmission` would be more correct and costs a render target every frame;
 * two shells give the same read for the price of one extra mesh.
 */

const BONDI = '#3f96a8';
const BONDI_DEEP = '#1d5a67';
const FROST = '#d5dddf';
const KEYCAP = '#e9ece9';
const KEYCAP_LIVE = '#bcd6dc';


/* ------------------------------ body shell ------------------------------ */

/**
 * Shape X is measured *backwards* from the front face.
 *
 * The rotation that turns the extrusion sideways maps shape X onto world −Z, so
 * a profile drawn with negative X put the tail in front of the screen and the
 * body swallowed the display. Positive here, negative there.
 */
function bodyProfile(): THREE.Shape {
  const p = new THREE.Shape();
  p.moveTo(FACE_BOTTOM.x, FACE_BOTTOM.y);
  p.lineTo(FACE_TOP.x, FACE_TOP.y); // front face, leaning back like the screen
  p.quadraticCurveTo(0.34, 2.45, 0.68, 2.52); // brow
  /*
   * The back, fitted to a photograph rather than drawn by eye.
   *
   * The silhouette was checked by measuring the height of the top surface at
   * eight depths across a side-on photo of the real machine and comparing. The
   * front half had always been close; the back was up to 0.15 of the machine's
   * height too tall, which is what kept every version reading as a rounded
   * television. The crown plateaus over the front quarter, then falls away in
   * one long arc to a bulge at about 40% of the height, then tucks to the base.
   */
  p.bezierCurveTo(1.12, 2.56, 1.46, 2.37, 1.7, 2.17);
  p.bezierCurveTo(2.06, 1.88, 2.44, 1.6, 2.66, 1.32);
  p.bezierCurveTo(2.74, 1.14, 2.75, 0.94, 2.64, 0.68);
  p.bezierCurveTo(2.52, 0.38, 2.3, 0.19, 2.05, 0.18);
  /*
   * The base runs about half the machine's depth. An earlier version gave it a
   * quarter, which turned the shell into an egg balanced on a stalk.
   */
  p.lineTo(0.62, 0.18);
  /*
   * A real radius where the face meets the underside.
   *
   * The old corner turned two nearly perpendicular runs straight into each
   * other, and sweeping that put a hard fold right across the bottom of the
   * front — a crease you could see from any angle. Curving into the face's
   * bottom end leaves a couple of degrees between the tangents instead of forty.
   * Starting the face as high as 0.54 to get the radius cost the chin a third of
   * its depth and crowded the wordmark into the CD slot; 0.47 is enough.
   */
  p.bezierCurveTo(0.42, 0.19, 0.26, 0.24, 0.17, 0.31);
  p.bezierCurveTo(0.12, 0.36, 0.093, 0.41, FACE_BOTTOM.x, FACE_BOTTOM.y);
  return p;
}

/** Crown height directly above a given depth, used to seat things on the shell. */
function crownAt(shapeX: number): number {
  const pts = bodyProfile().getPoints(400);
  let best = -Infinity;
  for (const v of pts) {
    if (Math.abs(v.x - shapeX) < 0.06) best = Math.max(best, v.y);
  }
  return best;
}

/**
 * How wide the machine is at a given depth. 0 is the face, 1 is the tail.
 *
 * Widest at the front, not the middle. An earlier version pinched the face to
 * 82% of the maximum, which is backwards, and it cost the design its whole
 * front: the bezel came out as wide as the shell with no colour left showing
 * around it. Seen from above the real machine is broadest just behind the face
 * and draws steadily in toward the tail.
 */
function widthAt(t: number): number {
  const front = Math.min(1, 0.94 + t * 0.3);
  /*
   * The tail draws in, but nowhere near as far as it used to.
   *
   * Taking it to half width turned the back into a wedge with a vertical edge
   * down it — from behind the machine read as a cylinder lying on its side. In
   * plan the real shell stays broad most of the way back and finishes as a
   * rounded end, not a point.
   */
  const tail = 1 - 0.22 * Math.pow(t, 2.1);
  return front * tail;
}

/**
 * How far back the frosted front piece reaches, for a surface with this normal.
 *
 * Not a flat cut. The white moulding wraps a long way back over the crown but
 * only just past the corner on the flanks, and slicing it at one depth put a
 * hard pale triangle down the side of the machine. Leaning the seam on how
 * upward-facing the surface is follows the real part line closely enough.
 */
function frontSeamZ(normalY: number): number {
  return -0.16 - 0.62 * Math.max(0, normalY);
}

/**
 * Height of the base seam at a given depth.
 *
 * Not quite a level line — measuring the band across a side-on photo shows it
 * climbing from about 22% of the machine's height at the front to 35% at the
 * back. A first pass read 42% off the same photo, but that number was the rear
 * tip of the silhouette rather than the seam, and it put a pale wedge halfway
 * up the flank.
 */
function baseSeamY(z: number): number {
  const t = Math.min(1, Math.max(0, (0.1 - z) / 2.76));
  return 0.66 + 0.24 * t;
}

/**
 * World Z of the shell's front surface at the tube's height.
 *
 * Derived from the profile's front edge rather than guessed: that edge runs
 * from x 0.09 at y 0.44 to x 0.23 at y 2.26, shape X points backwards, and the
 * shell is dropped by BODY_DROP. The face slopes, so this is only correct at
 * one height, which is why the group carrying it is tilted to match.
 */
const FRONT_Z = faceZ(SCREEN_Y + BODY_DROP);

function Body() {
  const shell = useMemo(() => bodySurface(), []);
  const stripe = usePinstripe();
  const door = useMemo(() => flankPatch(0.86, -1.46, 0.24, 0.34, 0.008), []);
  const doorIcon = useMemo(() => flankPatch(0.86, -1.46, 0.07, 0.07, 0.016), []);
  const handleY = useMemo(() => crownAt(1.75), []);

  return (
    <group position={[0, -BODY_DROP, 0]}>
      <mesh geometry={shell} castShadow receiveShadow>
        <meshPhysicalMaterial
          vertexColors
          map={stripe}
          roughness={0.3}
          metalness={0}
          clearcoat={0.65}
          clearcoatRoughness={0.12}
        />
      </mesh>

      {/*
        The carry handle: a dark slot read through the translucent hood, which is
        how it looks on the real machine. Seated on the crown by measuring the
        profile rather than by a guessed height — guessing left it hovering over
        the case like a lunchbox lid.
      */}
      <group position={[0, handleY - 0.14, -1.72]} rotation={[0.5, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.46, 0.1, 0.22]} />
          <meshStandardMaterial color="#0a2429" roughness={0.95} />
        </mesh>
      </group>

      {/* The port door on the right flank, curved onto the case. */}
      <mesh geometry={door}>
        <meshPhysicalMaterial
          color={FROST}
          roughness={0.42}
          clearcoat={0.55}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={doorIcon}>
        <meshStandardMaterial
          color={BONDI_DEEP}
          roughness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/*
        Four small clear feet, each sized to close the gap under it. The group
        is lowered by BODY_DROP, so the desk sits at that height in local space.
      */}
      {[
        [-0.6, -0.34],
        [0.6, -0.34],
        [-0.48, -1.78],
        [0.48, -1.78],
      ].map(([x, z]) => {
        const top = undersideY(x, z);
        const height = Math.max(0.03, top + BODY_DROP);
        return (
          <mesh key={`${x},${z}`} position={[x, top - height / 2, z]}>
            <cylinderGeometry args={[0.07, 0.078, height, 14]} />
            <meshPhysicalMaterial
              color="#cfd8da"
              roughness={0.5}
              transparent
              opacity={0.8}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/* -------------------------------- screen -------------------------------- */

/** A slightly bulged plane — CRT glass is never flat. */
export function bulgedPlane(w: number, h: number, bulge: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h, 32, 24);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i) / (w / 2);
    const y = pos.getY(i) / (h / 2);
    pos.setZ(i, bulge * (1 - x * x) * (1 - y * y));
  }
  g.computeVertexNormals();
  return g;
}

export const roundedShape = (w: number, h: number, r: number): THREE.Shape => {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
};

/**
 * The black surround the tube sits in, cut into the frosted front.
 *
 * The front of the shell is already the right plastic, so this is a ring rather
 * than a plate laid over the machine. The plate version had to be big enough to
 * frame the tube, which put its corners past where the shell had already curved
 * away — from the side it floated in front of the case with daylight behind it.
 */
function BezelRing() {
  const geometry = useMemo(() => {
    /*
     * The border has to be wider than the hole can overshoot.
     *
     * The aperture is cut a quad wider than nominal, so at 0.065 a side the
     * ring stopped just short of the cut at the corners and left two notches
     * showing above the tube. 0.12 covers it with room.
     */
    const outer = roundedShape(SCREEN_SIZE.w + 0.24, SCREEN_SIZE.h + 0.24, 0.22);
    outer.holes.push(
      new THREE.Path(roundedShape(SCREEN_SIZE.w, SCREEN_SIZE.h, 0.1).getPoints(48)),
    );
    const g = new THREE.ExtrudeGeometry(outer, {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.035,
      bevelSegments: 5,
      curveSegments: 16,
    });
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    /*
     * Sunk so the ring's front face finishes flush with the shell.
     *
     * The extrusion runs from -0.04 to +0.09 in its own space. Sunk so the rim
     * finishes a whisker proud of the panel and the rest of it lines the hole,
     * which is what turns the ring into a well the tube can sit down inside
     * rather than a slab laid on the front of the machine.
     */
    <mesh geometry={geometry} position={[0, 0, -0.088]}>
      <meshPhysicalMaterial color="#23282b" roughness={0.5} clearcoat={0.4} />
    </mesh>
  );
}

/**
 * The fine vertical ribbing moulded into the frosted plastic.
 *
 * One row of pixels, repeated. It multiplies against the vertex colours, so it
 * lands on the coloured hood too — at this contrast that reads as surface
 * rather than as stripes, and the alternative was a second mesh floating over
 * the face, which is a mistake this file has already made once.
 */
function usePinstripe(): THREE.CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 2;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 32, 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    for (let x = 0; x < 32; x += 4) ctx.fillRect(x, 0, 2, 2);
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(9, 1);
    t.anisotropy = 8;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

/** Dots, for the speaker grilles. */
function useGrille(): THREE.CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1e4f58';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#07161a';
    for (let y = 0; y < 64; y += 6) {
      for (let x = 0; x < 64; x += 6) {
        ctx.beginPath();
        ctx.arc(x + ((y / 6) % 2 ? 3 : 0), y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

/** The iMac wordmark, as it is printed on the chin. */
function useWordmark(): THREE.CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 96);
    ctx.fillStyle = '#7d8a8d';
    ctx.font = '300 62px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('iMac', 128, 52);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
}

/**
 * What lives on the chin: the wordmark, the CD tray, the power button and the
 * two speakers.
 *
 * All of it sits a hair proud of the shell rather than being cut into it — real
 * booleans through the body would cost four more shapes and read identically at
 * any distance you can actually see the machine from.
 */
function Chin() {
  const grille = useGrille();
  const mark = useWordmark();
  // Local to the face group, whose origin is the tube's centre.
  const ceiling = -SCREEN_SIZE.h / 2;
  const z = 0.005;

  return (
    <group>
      <mesh position={[0, ceiling - 0.16, z]}>
        <planeGeometry args={[0.4, 0.15]} />
        <meshBasicMaterial map={mark} transparent toneMapped={false} />
      </mesh>

      {/* Tray-loading CD slot, centred under the wordmark. */}
      <mesh position={[0, ceiling - 0.3, z]}>
        <boxGeometry args={[0.74, 0.1, 0.015]} />
        <meshStandardMaterial color="#aab4b6" roughness={0.6} />
      </mesh>
      <mesh position={[0, ceiling - 0.3, z + 0.008]}>
        <boxGeometry args={[0.68, 0.02, 0.015]} />
        <meshStandardMaterial color="#394245" roughness={0.95} />
      </mesh>

      {/* Power button and its light: to the right of the tray, not the left. */}
      <mesh position={[0.5, ceiling - 0.3, z + 0.004]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.044, 0.044, 0.016, 20]} />
        <meshStandardMaterial color="#8b989b" roughness={0.55} />
      </mesh>
      {/* The light sits beside the button, not under it: any lower and it falls
          off the bottom of the chin, where the shell has already curved away. */}
      <mesh position={[0.5, ceiling - 0.4, z + 0.004]}>
        <sphereGeometry args={[0.018, 12, 10]} />
        <meshBasicMaterial color="#7ef0b0" toneMapped={false} />
      </mesh>

      {/*
        Speakers, in the pods that flare out of the bottom corners.
        
        They are not flat discs set into the panel: the shell swells forward
        around each one, which is most of what gives the front its face.
      */}
      {[-0.64, 0.64].map((x) => (
        <group key={x} position={[x, ceiling - 0.28, z]} scale={[1, 1, 0.26]}>
          <mesh castShadow>
            <sphereGeometry args={[0.13, 26, 20]} />
            <meshPhysicalMaterial color={FROST} roughness={0.42} clearcoat={0.5} />
          </mesh>
          {/*
            The grille is a cap of the same sphere, a hair larger, not a flat
            disc. Laid flat it either sank into the dome or stood proud of it
            with a white ring showing round the edge — a volume knob. The
            squash lives on the group so it lands on the pod's axis after the
            cap has been turned to face forward.
          */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <sphereGeometry args={[0.134, 30, 14, 0, Math.PI * 2, 0, 0.82]} />
            <meshStandardMaterial map={grille} roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------- keyboard ------------------------------- */

function useKeyLabel(label: string | undefined): THREE.CanvasTexture | null {
  return useMemo(() => {
    if (!label) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = '#3d4a4d';
    ctx.font = `600 ${label.length > 2 ? 32 : 60}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 64, 70);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }, [label]);
}

/** A box whose top face is smaller than its bottom — a keycap, or a case. */
export function frustumY(
  bw: number,
  bd: number,
  tw: number,
  td: number,
  height: number,
): THREE.BufferGeometry {
  const b = [
    [-bw / 2, 0, bd / 2],
    [bw / 2, 0, bd / 2],
    [bw / 2, 0, -bd / 2],
    [-bw / 2, 0, -bd / 2],
  ];
  const t = [
    [-tw / 2, height, td / 2],
    [tw / 2, height, td / 2],
    [tw / 2, height, -td / 2],
    [-tw / 2, height, -td / 2],
  ];
  const quads: number[][][] = [
    [b[0], b[1], t[1], t[0]],
    [b[1], b[2], t[2], t[1]],
    [b[2], b[3], t[3], t[2]],
    [b[3], b[0], t[0], t[3]],
    [t[0], t[1], t[2], t[3]],
    [b[3], b[2], b[1], b[0]],
  ];
  const positions: number[] = [];
  for (const [p0, p1, p2, p3] of quads) {
    positions.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

const KEY_H = 0.062;
const KEY_TRAVEL = 0.05;

/**
 * A keycap: a rounded square, drawn back a little at the top.
 *
 * Extruded with a bevel rather than built as a plain frustum. The frustum had
 * eight hard edges and a sharp square top, which at this size reads as a chiclet
 * cut out of a block; the bevel is what makes a moulded cap.
 */
function keycapGeometry(w: number, d: number): THREE.BufferGeometry {
  const inset = 0.016;
  const shape = roundedShape(w - inset, d - inset, Math.min(w, d) * 0.24);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: KEY_H - 0.024,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.011,
    bevelSegments: 3,
    curveSegments: 6,
  });
  // Extrusion runs along +Z; stand it up and sit its underside on zero.
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.012, 0);
  g.computeVertexNormals();
  return g;
}

function Keycap({
  def,
  pressedRef,
  onPress,
  onRelease,
}: {
  def: PlacedKey;
  pressedRef: React.MutableRefObject<Set<string>>;
  onPress: (code: string) => void;
  onRelease: (code: string) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const label = useKeyLabel(def.label);
  const live = def.code ? LIVE_CODES.has(def.code) : false;

  const geometry = useMemo(
    () => keycapGeometry(def.width, def.depth),
    [def.width, def.depth],
  );

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const down = def.code ? pressedRef.current.has(def.code) : false;
    const target = down ? -KEY_TRAVEL : 0;
    // Lerp rather than snap, so the travel has a little weight to it.
    g.position.y += (target - g.position.y) * Math.min(1, delta * 26);
  });

  return (
    <group ref={group} position={[def.x, 0, def.z]}>
      <mesh
        geometry={geometry}
        castShadow
        onPointerDown={(e) => {
          if (!def.code) return;
          e.stopPropagation();
          onPress(def.code);
        }}
        onPointerUp={(e) => {
          if (!def.code) return;
          e.stopPropagation();
          onRelease(def.code);
        }}
        onPointerOut={() => def.code && onRelease(def.code)}
      >
        <meshPhysicalMaterial
          color={live ? KEYCAP_LIVE : KEYCAP}
          roughness={0.36}
          clearcoat={0.55}
          clearcoatRoughness={0.16}
          transparent
          opacity={0.96}
        />
      </mesh>
      {label && (
        <mesh position={[0, KEY_H + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[def.width * 0.9, def.depth * 0.9]} />
          <meshBasicMaterial map={label} transparent />
        </mesh>
      )}
    </group>
  );
}

/**
 * The case: a rounded slab with the front edge bowed out.
 *
 * The keyboard used to be a tapered box, which is the one shape this whole desk
 * does not contain. Everything Apple put on it in 1998 is drawn with a radius,
 * so the case gets a rounded outline, a bowed front and a bevelled top edge.
 */
function keyboardCase(
  w: number,
  d: number,
  height: number,
  bevel: number,
): THREE.BufferGeometry {
  const hw = w / 2;
  const hd = d / 2;
  const r = 0.26;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hd);
  // The front edge bows toward the user rather than running straight across.
  shape.quadraticCurveTo(0, -hd - 0.12, hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

  const g = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.86,
    bevelSegments: 4,
    curveSegments: 18,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  g.computeVertexNormals();
  return g;
}

function Keyboard({
  pressedRef,
  onPress,
  onRelease,
}: {
  pressedRef: React.MutableRefObject<Set<string>>;
  onPress: (code: string) => void;
  onRelease: (code: string) => void;
}) {
  const { keys, width, depth } = useMemo(() => layoutKeys(), []);
  const shell = useMemo(
    () => keyboardCase(width + 0.44, depth + 0.5, 0.09, 0.03),
    [width, depth],
  );
  /*
   * The tray is a thin plate, not another slab.
   *
   * Reusing the case geometry for it made a second 0.17-tall block sitting on
   * the first, and it swallowed every key: the keyboard rendered as a bare
   * coloured tablet.
   */
  const well = useMemo(
    () => keyboardCase(width + 0.2, depth + 0.2, 0.018, 0.01),
    [width, depth],
  );
  const cable = useMemo(() => {
    /*
     * Out of the back edge and all the way to the machine.
     *
     * It used to stop about a unit short and simply end in the air. With the
     * keyboard pulled in close to the machine, the desk just in front of the
     * iMac is around z = -2.2 in this group's frame.
     */
    const back = -depth / 2;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.4, 0.12, back - 0.16),
      new THREE.Vector3(0.52, 0.14, back - 0.55),
      new THREE.Vector3(0.2, 0.05, back - 1.0),
      new THREE.Vector3(-0.1, 0.05, -2.2),
    ]);
    return new THREE.TubeGeometry(curve, 64, 0.026, 8, false);
  }, [depth]);

  return (
    <group position={[0, 0, 1.3]} rotation={[-0.045, 0, 0]} scale={0.5}>
      <mesh geometry={shell} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={BONDI_DEEP}
          transparent
          opacity={0.72}
          roughness={0.18}
          clearcoat={0.95}
          clearcoatRoughness={0.06}
        />
      </mesh>

      {/* The tray the keys sit in, a shade darker so they read as recessed. */}
      <mesh geometry={well} position={[0, 0.112, 0.02]} receiveShadow>
        <meshStandardMaterial color="#123a42" roughness={0.55} />
      </mesh>

      {/* Two flip-down feet under the back edge. */}
      {[-width * 0.34, width * 0.34].map((x) => (
        <mesh key={x} position={[x, 0.012, -depth / 2 - 0.14]} castShadow>
          <boxGeometry args={[0.34, 0.05, 0.16]} />
          <meshPhysicalMaterial color={BONDI_DEEP} roughness={0.3} clearcoat={0.7} />
        </mesh>
      ))}

      {/* A USB socket at each end of the back edge — where the mouse plugs in. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (width / 2 + 0.17), 0.1, -depth / 2 - 0.14]}
        >
          <boxGeometry args={[0.2, 0.06, 0.05]} />
          <meshStandardMaterial color="#0b2429" roughness={0.8} />
        </mesh>
      ))}

      <mesh geometry={cable} castShadow>
        <meshPhysicalMaterial
          color="#dfe6e8"
          transparent
          opacity={0.85}
          roughness={0.35}
          clearcoat={0.6}
        />
      </mesh>

      <group position={[0, 0.148, 0.02]}>
        {keys.map((k, i) => (
          <Keycap
            key={i}
            def={k}
            pressedRef={pressedRef}
            onPress={onPress}
            onRelease={onRelease}
          />
        ))}
      </group>
    </group>
  );
}

/* --------------------------- the puck mouse ----------------------------- */

/**
 * The puck's silhouette, as radius against height.
 *
 * A squat dome, widest a third of the way up and rolling in at the top — not
 * the cylinder-with-a-cap it used to be, which read as a bottle top.
 */
const PUCK: Array<[number, number]> = [
  [0.0, 0.0],
  [0.225, 0.0],
  [0.272, 0.012],
  [0.295, 0.042],
  [0.3, 0.078],
  [0.293, 0.115],
  [0.268, 0.146],
  [0.212, 0.168],
  [0.12, 0.179],
  [0.0, 0.183],
];

/** Just the upper surface, radius ascending, for seating the button on it. */
const PUCK_TOP = PUCK.slice(4).reverse();

function puckTopAt(radius: number): number {
  const r = Math.min(radius, PUCK_TOP[PUCK_TOP.length - 1][0]);
  for (let i = 1; i < PUCK_TOP.length; i += 1) {
    if (r <= PUCK_TOP[i][0]) {
      const [r0, y0] = PUCK_TOP[i - 1];
      const [r1, y1] = PUCK_TOP[i];
      return y0 + ((y1 - y0) * (r - r0)) / (r1 - r0);
    }
  }
  return PUCK_TOP[PUCK_TOP.length - 1][1];
}

/**
 * The button's outline, which is the whole trick of this object.
 *
 * It is not a disc. The frosted button runs to the shell's edge front and back
 * but is pinched at the sides, so the coloured plastic shows through as two
 * crescents — that waist is what makes the puck recognisable, and a plain round
 * button in the middle of a plain round body never will be.
 */
const BUTTON_R = 0.285;

function buttonRadius(angle: number): number {
  return BUTTON_R * (1 - 0.28 * Math.pow(Math.abs(Math.cos(angle)), 1.6));
}

/**
 * The button as a skin lying on the shell, lifted a hair so its edge reads as
 * the seam it is rather than as a painted line.
 */
function buttonSkin(): THREE.BufferGeometry {
  const RINGS = 16;
  const SEGS = 84;
  const LIFT = 0.006;
  // A wall at the rim first, then the dome inward from it.
  const bands: Array<[number, number]> = [
    [1, 0],
    [1, LIFT],
  ];
  for (let i = 1; i <= RINGS; i += 1) bands.push([1 - i / RINGS, LIFT]);

  const position: number[] = [];
  for (const [s, lift] of bands) {
    for (let j = 0; j < SEGS; j += 1) {
      const a = (j / SEGS) * Math.PI * 2;
      const r = buttonRadius(a) * s;
      position.push(Math.cos(a) * r, puckTopAt(r) + lift, Math.sin(a) * r);
    }
  }

  const index: number[] = [];
  for (let i = 0; i < bands.length - 1; i += 1) {
    for (let j = 0; j < SEGS; j += 1) {
      const a = i * SEGS + j;
      const b = i * SEGS + ((j + 1) % SEGS);
      const c = (i + 1) * SEGS + j;
      const d = (i + 1) * SEGS + ((j + 1) % SEGS);
      // Wound to face outward. The other way round the whole button was
      // back-face culled and the mouse rendered as a bare coloured disc.
      index.push(a, c, b, b, c, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * The round mouse that shipped with it.
 *
 * Famously bad to hold, unmistakable to look at — which is the point: it has to
 * be the puck, not a small ball, and not a disc with a dot on it.
 */
function Mouse() {
  const body = useMemo(() => {
    const g = new THREE.LatheGeometry(
      PUCK.map(([r, y]) => new THREE.Vector2(r, y)),
      72,
    );
    g.computeVertexNormals();
    return g;
  }, []);
  const button = useMemo(() => buttonSkin(), []);
  const cable = useMemo(() => {
    /*
     * Into the keyboard, not off toward the machine.
     *
     * The puck plugs into the socket on the end of the keyboard — that is what
     * the sockets are for — and it also means the cable ends somewhere instead
     * of trailing off and stopping in the air. Solved for the socket's position
     * through this group's own rotation, so it meets it rather than near it.
     */
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.1, -0.25),
      new THREE.Vector3(-0.22, 0.055, -0.36),
      new THREE.Vector3(-0.45, 0.035, -0.44),
      new THREE.Vector3(-0.6, 0.05, -0.4),
    ]);
    return new THREE.TubeGeometry(curve, 48, 0.013, 8, false);
  }, []);

  return (
    <group position={[1.9, 0, 1.3]} rotation={[0, -0.18, 0]}>
      <mesh geometry={body} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={BONDI}
          transparent
          opacity={0.78}
          roughness={0.14}
          clearcoat={1}
          clearcoatRoughness={0.04}
        />
      </mesh>

      <mesh geometry={button} castShadow>
        <meshPhysicalMaterial
          color="#eef3f4"
          transparent
          opacity={0.94}
          roughness={0.34}
          clearcoat={0.55}
          clearcoatRoughness={0.18}
        />
      </mesh>

      {/* The raised boss the Apple logo sits in, toward the back of the button. */}
      <mesh position={[0, puckTopAt(0.085) + 0.008, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.075, 0.006, 10, 40]} />
        <meshPhysicalMaterial color="#e2e9ea" roughness={0.4} clearcoat={0.5} />
      </mesh>

      <mesh geometry={cable} castShadow>
        <meshPhysicalMaterial
          color="#dfe6e8"
          transparent
          opacity={0.85}
          roughness={0.35}
          clearcoat={0.6}
        />
      </mesh>
    </group>
  );
}

export default function Machine({
  pressedRef,
  onPress,
  onRelease,
  screen,
}: {
  pressedRef: React.MutableRefObject<Set<string>>;
  onPress: (code: string) => void;
  onRelease: (code: string) => void;
  screen: React.ReactNode;
}) {
  return (
    <group>
      <Room />
      <Body />
      {/* The face plate sits on the flattened front of the shell, tilted with it. */}
      <group position={[0, SCREEN_Y, FRONT_Z]} rotation={[FACE_TILT, 0, 0]}>
        <BezelRing />
        <Chin />
        {screen}
      </group>
      <Keyboard pressedRef={pressedRef} onPress={onPress} onRelease={onRelease} />
      <Mouse />
    </group>
  );
}
