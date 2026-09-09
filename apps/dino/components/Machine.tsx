'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { LIVE_CODES, layoutKeys, type PlacedKey } from '@/lib/scene/keys';

/**
 * Half-width of the machine at a given depth. 0 is the face, 1 is the tail.
 *
 * Widest just behind the face, then a long taper closing to nothing at the very
 * back — the rear of the shell is a rounded end, so in a sweep like this the
 * last section is a point, the same way a sphere's is.
 */
const HALF_W = 1.125;

function halfWidthAt(t: number): number {
  const nose = 0.93 + 0.07 * Math.min(1, t / 0.14);
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
  return 3.9 - 1.6 * t;
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
export const SCREEN_SIZE = { w: 1.56, h: 1.17 };
/** World height of the tube's centre. */
export const SCREEN_Y = 1.37;
/**
 * How far the face leans back, in radians.
 *
 * Negative: the profile's front edge runs from x 0.09 at the bottom to 0.23 at
 * the top and shape X points backwards, so going up the face moves away from
 * the viewer. With the sign the other way the whole chin was rotated *into* the
 * shell, which is why the CD slot and speakers were invisible.
 */
export const FACE_TILT = -0.077;

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
 * shell, and the band has to be wide enough that the roll off its edge reads as
 * a radius rather than as a crease.
 */
const FACE_SLOPE = 0.14 / 1.82;
const PANEL = { cy: 1.35, halfW: 1.05, halfH: 0.95, radius: 0.34, band: 0.16 };

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
  halfW: SCREEN_SIZE.w / 2 + 0.03,
  halfH: SCREEN_SIZE.h / 2 + 0.03,
  radius: 0.12,
};

function inAperture(px: number, py: number): boolean {
  const dx = Math.max(0, Math.abs(px) - (APERTURE.halfW - APERTURE.radius));
  const dy = Math.max(0, Math.abs(py - APERTURE.cy) - (APERTURE.halfH - APERTURE.radius));
  return Math.hypot(dx, dy) - APERTURE.radius < 0;
}

/** 1 well inside the panel, 0 well outside it. */
function panelMask(px: number, py: number): number {
  const dx = Math.max(0, Math.abs(px) - (PANEL.halfW - PANEL.radius));
  const dy = Math.max(0, Math.abs(py - PANEL.cy) - (PANEL.halfH - PANEL.radius));
  const dist = Math.hypot(dx, dy) - PANEL.radius;
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
  const n = 5 + (sectionExponent(t) - 5) * ease;
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
    const n = 5 + (sectionExponent(t) - 5) * ease;
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
      const k = 2 / (5 + (sectionExponent(t) - 5) * ease);
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
      const zFace = 0.11 - (py - 0.44) * FACE_SLOPE;
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
      // Drop the quad only when the whole of it is inside the hole, so the rim
      // keeps a complete row of triangles for the bezel to land on.
      if (cut[a] && cut[b] && cut[c] && cut[d]) continue;
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
  p.moveTo(0.09, 0.44);
  p.lineTo(0.23, 2.26); // front face, leaning back the way the screen does
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
  p.bezierCurveTo(0.4, 0.19, 0.24, 0.28, 0.16, 0.36);
  p.quadraticCurveTo(0.11, 0.4, 0.09, 0.44);
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
const FRONT_Z = 0.11 - (SCREEN_Y + BODY_DROP - 0.44) * (0.14 / 1.82);

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

const roundedShape = (w: number, h: number, r: number): THREE.Shape => {
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
    const outer = roundedShape(SCREEN_SIZE.w + 0.13, SCREEN_SIZE.h + 0.13, 0.16);
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
      <mesh position={[0, ceiling - 0.13, z]}>
        <planeGeometry args={[0.42, 0.16]} />
        <meshBasicMaterial map={mark} transparent toneMapped={false} />
      </mesh>

      {/* Tray-loading CD slot, centred under the wordmark. */}
      <mesh position={[0, ceiling - 0.32, z]}>
        <boxGeometry args={[0.78, 0.11, 0.015]} />
        <meshStandardMaterial color="#aab4b6" roughness={0.6} />
      </mesh>
      <mesh position={[0, ceiling - 0.32, z + 0.008]}>
        <boxGeometry args={[0.72, 0.022, 0.015]} />
        <meshStandardMaterial color="#394245" roughness={0.95} />
      </mesh>

      {/* Power button and its light: to the right of the tray, not the left. */}
      <mesh position={[0.5, ceiling - 0.3, z + 0.004]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.044, 0.044, 0.016, 20]} />
        <meshStandardMaterial color="#8b989b" roughness={0.55} />
      </mesh>
      {/* The light sits beside the button, not under it: any lower and it falls
          off the bottom of the chin, where the shell has already curved away. */}
      <mesh position={[0.5, ceiling - 0.42, z + 0.004]}>
        <sphereGeometry args={[0.018, 12, 10]} />
        <meshBasicMaterial color="#7ef0b0" toneMapped={false} />
      </mesh>

      {/*
        Speakers, in the pods that flare out of the bottom corners.
        
        They are not flat discs set into the panel: the shell swells forward
        around each one, which is most of what gives the front its face.
      */}
      {[-0.64, 0.64].map((x) => (
        <group key={x} position={[x, ceiling - 0.26, z]} scale={[1, 1, 0.26]}>
          <mesh castShadow>
            <sphereGeometry args={[0.15, 26, 20]} />
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
            <sphereGeometry args={[0.154, 30, 14, 0, Math.PI * 2, 0, 0.82]} />
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
    () => frustumY(def.width, def.depth, def.width * 0.9, def.depth * 0.88, KEY_H),
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
          roughness={0.38}
          clearcoat={0.6}
          transparent
          opacity={0.94}
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
  const base = useMemo(
    () => frustumY(width + 0.3, depth + 0.26, width + 0.22, depth + 0.18, 0.13),
    [width, depth],
  );

  return (
    <group position={[0, 0, 2.35]} rotation={[-0.045, 0, 0]} scale={0.5}>
      <mesh geometry={base} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={BONDI_DEEP}
          transparent
          opacity={0.68}
          roughness={0.2}
          clearcoat={0.9}
        />
      </mesh>
      <group position={[0, 0.16, 0]}>
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
 * The round mouse that shipped with it: a flat translucent disc with a white
 * circular button set into the top. Famously bad to hold, unmistakable to look
 * at — and the reason it has to be a disc rather than the little ball that was
 * standing in for it.
 */
function Mouse() {
  return (
    <group position={[1.9, 0, 2.35]} rotation={[0, -0.18, 0]}>
      {/* Translucent outer ring. */}
      <mesh position={[0, 0.055, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.32, 0.11, 44]} />
        <meshPhysicalMaterial
          color={BONDI}
          transparent
          opacity={0.66}
          roughness={0.14}
          clearcoat={1}
        />
      </mesh>
      {/* White inner body, slightly domed. */}
      <mesh position={[0, 0.105, 0]} castShadow>
        <sphereGeometry args={[0.27, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2.6]} />
        <meshPhysicalMaterial color="#eef2f3" roughness={0.34} clearcoat={0.7} />
      </mesh>
      {/* The single round button, a shade proud of the shell. */}
      <mesh position={[0, 0.125, 0.02]}>
        <cylinderGeometry args={[0.155, 0.155, 0.016, 32]} />
        <meshPhysicalMaterial color="#f6f8f8" roughness={0.3} clearcoat={0.8} />
      </mesh>
      {/* Cable, running back toward the machine. */}
      <mesh position={[-0.22, 0.04, -0.42]} rotation={[Math.PI / 2, 0, 0.5]}>
        <torusGeometry args={[0.4, 0.014, 8, 24, Math.PI * 0.7]} />
        <meshStandardMaterial color="#dfe6e8" roughness={0.6} />
      </mesh>
    </group>
  );
}

/* ----------------------------- studio sweep ----------------------------- */

/**
 * A black studio floor. The pool of light is baked into a texture rather than
 * lit, so it stays exactly where it is framed no matter which viewpoint the
 * camera moves to — a real light would slide across the floor as it orbits.
 */
function Studio() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 512, 512);
    const g = ctx.createRadialGradient(256, 240, 16, 256, 256, 248);
    g.addColorStop(0, '#292c30');
    g.addColorStop(0.42, '#141517');
    g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[26, 26]} />
      <meshStandardMaterial map={texture} roughness={0.4} metalness={0.06} />
    </mesh>
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
      <Studio />
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
