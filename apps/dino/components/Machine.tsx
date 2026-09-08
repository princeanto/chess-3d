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
function bodySurface(): THREE.BufferGeometry {
  const pts = bodyProfile().getPoints(900);
  const X0 = Math.min(...pts.map((p) => p.x));
  const X1 = Math.max(...pts.map((p) => p.x));
  const NZ = 112;
  const NA = 128;
  const eps = (X1 - X0) / 240;

  /** Vertical extent of the side profile at a given depth. */
  const spanAt = (x: number): [number, number] => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const q of pts) {
      if (Math.abs(q.x - x) <= eps) {
        lo = Math.min(lo, q.y);
        hi = Math.max(hi, q.y);
      }
    }
    return lo === Infinity ? [0, 0] : [lo, hi];
  };

  const position: number[] = [];
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
      position.push(
        Math.sign(c) * Math.pow(Math.abs(c), k) * rx,
        cy + Math.sign(sn) * Math.pow(Math.abs(sn), k) * ry,
        z,
      );
    }
  }

  const index: number[] = [];
  for (let i = 0; i < NZ; i += 1) {
    for (let j = 0; j < NA; j += 1) {
      const a = i * NA + j;
      const b = i * NA + ((j + 1) % NA);
      const c = (i + 1) * NA + j;
      const d = (i + 1) * NA + ((j + 1) % NA);
      index.push(a, c, b, b, c, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
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
  const colour: number[] = [];
  for (let v = 0; v < pos.count; v += 1) {
    const y = pos.getY(v);
    const z = pos.getZ(v);
    const isFrost = z > frontSeamZ(nor.getY(v)) || y < baseSeamY(z);
    const c = isFrost ? frost : hood;
    colour.push(c.r, c.g, c.b);
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

/*
 * The face.
 *
 * The CRT is pushed up the front, leaving a deep chin under it for the CD tray,
 * the power button and the two speakers. That chin is most of what makes the
 * front read as an iMac rather than as a generic monitor.
 */
export const SCREEN_SIZE = { w: 1.68, h: 1.26 };
/** World height of the tube's centre. */
export const SCREEN_Y = 1.42;
/**
 * How far the face leans back, in radians.
 *
 * Negative: the profile's front edge runs from x 0.09 at the bottom to 0.23 at
 * the top and shape X points backwards, so going up the face moves away from
 * the viewer. With the sign the other way the whole chin was rotated *into* the
 * shell, which is why the CD slot and speakers were invisible.
 */
export const FACE_TILT = -0.077;

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
 * World Z of the shell's front surface at the tube's height, plus a hair.
 *
 * The face slopes, so this is only correct at one height — which is why the
 * group carrying it is tilted to match rather than sitting square.
 */
const FRONT_Z = 0.03;

function Body() {
  const shell = useMemo(() => bodySurface(), []);
  const handleY = useMemo(() => crownAt(1.75), []);

  return (
    <group position={[0, -0.1, 0]}>
      <mesh geometry={shell} castShadow receiveShadow>
        <meshPhysicalMaterial
          vertexColors
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

      {/* Four small clear feet. */}
      {[
        [-0.72, -0.3],
        [0.72, -0.3],
        [-0.56, -1.85],
        [0.56, -1.85],
      ].map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, 0.14, z]}>
          <cylinderGeometry args={[0.07, 0.08, 0.08, 14]} />
          <meshPhysicalMaterial color="#cfd8da" roughness={0.5} transparent opacity={0.8} />
        </mesh>
      ))}
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
    <mesh geometry={geometry} position={[0, 0, -0.055]}>
      <meshPhysicalMaterial color="#23282b" roughness={0.5} clearcoat={0.4} />
    </mesh>
  );
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
      <mesh position={[0.5, ceiling - 0.32, z]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.042, 0.042, 0.014, 20]} />
        <meshStandardMaterial color="#9fabad" roughness={0.5} />
      </mesh>
      <mesh position={[0.5, ceiling - 0.46, z]}>
        <sphereGeometry args={[0.018, 12, 10]} />
        <meshBasicMaterial color="#7ef0b0" toneMapped={false} />
      </mesh>

      {/* Speakers: two grilles at the bottom corners of the face. */}
      {[-0.74, 0.74].map((x) => (
        <mesh key={x} position={[x, ceiling - 0.38, z]}>
          <circleGeometry args={[0.115, 28]} />
          <meshStandardMaterial map={grille} roughness={0.8} />
        </mesh>
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
