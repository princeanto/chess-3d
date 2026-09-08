'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { LIVE_CODES, layoutKeys, type PlacedKey } from '@/lib/scene/keys';

/**
 * A 1998 iMac G3, on a black studio sweep.
 *
 * The shape is the whole point of that machine: a bulbous translucent egg that
 * swells out behind the screen and tucks into a small foot. It is built by
 * deforming a sphere rather than assembling boxes — the silhouette has no
 * straight line in it anywhere except the screen bezel.
 *
 * Translucency is two shells: a dark opaque chassis inside a tinted transparent
 * body. Real `transmission` would be more correct and costs a render target
 * every frame; two shells give the same read — darker internals seen through
 * coloured plastic — for the price of one extra mesh.
 */

const BONDI = '#3f96a8';
const BONDI_DEEP = '#1d5a67';
const CHASSIS = '#14343b';
const BEZEL = '#dfe3e0';
const KEYCAP = '#e9ece9';
const KEYCAP_LIVE = '#bcd6dc';

export const SCREEN_SIZE = { w: 1.6, h: 1.2 };

/* ------------------------------ body shell ------------------------------ */

/**
 * The iMac is a wedge, not a ball.
 *
 * Its side view is the whole design: a near-vertical front face carrying the
 * screen, sweeping up over a domed top and back down to a rounded tail that
 * meets the desk. A deformed sphere cannot make that shape — so the silhouette
 * is drawn once as a profile and extruded sideways, with a deep bevel doing the
 * work of rounding the flanks.
 *
 * Shape X runs front to back (negative is backwards); shape Y is height. After
 * extruding along Z the whole thing is rotated so that Z becomes the machine's
 * width.
 */
const BODY_W = 2.34;
const BEVEL = 0.19;

/**
 * Shape X is measured *backwards* from the front face.
 *
 * The rotation that turns the extrusion sideways maps shape X onto world −Z, so
 * a profile drawn with negative X put the tail in front of the screen and the
 * body swallowed the display. Positive here, negative there.
 */
function bodyProfile(): THREE.Shape {
  const p = new THREE.Shape();
  p.moveTo(0.08, 0.46);
  p.lineTo(0.22, 1.94); // front face, leaning back the way the screen does
  p.quadraticCurveTo(0.3, 2.14, 0.6, 2.16); // brow, the highest point
  // One long sweep from the brow down to the tail. Anything with a vertical
  // section in the back reads as a box, however rounded its corners are.
  p.bezierCurveTo(1.32, 2.18, 1.98, 1.8, 2.3, 1.18);
  p.bezierCurveTo(2.54, 0.78, 2.44, 0.4, 2.02, 0.28); // tail, low and far back
  p.bezierCurveTo(1.26, 0.04, 0.66, 0.14, 0.32, 0.3); // underside
  p.quadraticCurveTo(0.15, 0.36, 0.08, 0.46);
  return p;
}

/**
 * How wide the machine is at a given depth. 0 is the face, 1 is the tail.
 *
 * A straight extrusion is a constant-width slab, and no amount of rounding
 * stops that reading as a box. The real thing bulges: narrower at the face than
 * at the shoulders, then drawing in hard toward the tail. This curve is what
 * turns the profile into a body.
 */
function widthAt(t: number): number {
  const face = Math.min(1, 0.8 + t * 0.62); // pinched at the bezel
  const tail = 1 - 0.46 * Math.pow(t, 1.75); // drawn in toward the back
  return face * tail;
}

function extrudedBody(inset: number): THREE.BufferGeometry {
  const depth = BODY_W - inset * 2;
  const g = new THREE.ExtrudeGeometry(bodyProfile(), {
    depth,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 12,
    curveSegments: 32,
  });
  // Centre across the width, then turn the extrusion axis into world X.
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);

  g.computeBoundingBox();
  const { min, max } = g.boundingBox!;
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const t = (max.z - pos.getZ(i)) / (max.z - min.z);
    pos.setX(i, pos.getX(i) * widthAt(t));
  }

  g.computeVertexNormals();
  return g;
}

/** The frosted lower section: the same profile, clipped below the waistline. */
function lowerShell(): THREE.BufferGeometry {
  const p = new THREE.Shape();
  p.moveTo(0.16, 0.5);
  p.lineTo(0.2, 0.86);
  p.bezierCurveTo(1.06, 0.96, 1.8, 0.82, 2.16, 0.62);
  p.bezierCurveTo(2.34, 0.44, 2.26, 0.34, 1.92, 0.34);
  p.bezierCurveTo(1.24, 0.14, 0.68, 0.22, 0.36, 0.36);
  p.quadraticCurveTo(0.22, 0.42, 0.16, 0.5);
  const depth = BODY_W - 0.04;
  const g = new THREE.ExtrudeGeometry(p, {
    depth,
    bevelEnabled: true,
    bevelThickness: BEVEL * 0.7,
    bevelSize: BEVEL * 0.7,
    bevelSegments: 10,
    curveSegments: 24,
  });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);

  // Follow the same bulge, or the chin sits proud of the shell at the shoulders.
  g.computeBoundingBox();
  const { min, max } = g.boundingBox!;
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const t = (max.z - pos.getZ(i)) / (max.z - min.z);
    pos.setX(i, pos.getX(i) * widthAt(t) * 0.93);
  }

  g.computeVertexNormals();
  return g;
}

/**
 * World Z of the front face. The profile starts at X = 0 and the bevel pushes
 * outward by its own size, so the front-most surface sits exactly one bevel
 * proud of the origin.
 */
const FRONT_Z = BEVEL;

function Body() {
  const shell = useMemo(() => extrudedBody(0), []);
  const chassis = useMemo(() => extrudedBody(0.34), []);
  const lower = useMemo(() => lowerShell(), []);

  return (
    <group>
      {/* Dark internals, seen through the tinted shell. */}
      <mesh geometry={chassis} position={[0, 0.09, -0.22]}>
        <meshStandardMaterial color={CHASSIS} roughness={0.6} metalness={0.08} />
      </mesh>

      {/* Frosted lower third — the coloured plastic is only the top and back. */}
      <mesh geometry={lower} castShadow receiveShadow>
        <meshPhysicalMaterial color="#eef2f3" roughness={0.4} clearcoat={0.6} />
      </mesh>

      <mesh geometry={shell} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={BONDI}
          transparent
          opacity={0.9}
          roughness={0.2}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.05}
        />
      </mesh>

      {/* Recessed carry handle on the crown, toward the back. */}
      <mesh position={[0, 2.14, -1.3]} rotation={[0.5, 0, 0]} castShadow>
        <torusGeometry args={[0.26, 0.05, 14, 36, Math.PI]} />
        <meshStandardMaterial color={BONDI_DEEP} roughness={0.4} />
      </mesh>

      {/* Feet. */}
      {[-0.78, 0.78].map((x) => (
        <mesh key={x} position={[x, 0.05, -1.7]} castShadow>
          <cylinderGeometry args={[0.11, 0.13, 0.12, 16]} />
          <meshStandardMaterial color="#e8eef0" roughness={0.6} />
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

function Bezel() {
  const geometry = useMemo(() => {
    const outer = roundedShape(1.98, 1.8, 0.3);
    outer.holes.push(
      new THREE.Path(roundedShape(SCREEN_SIZE.w, SCREEN_SIZE.h, 0.11).getPoints(48)),
    );
    const g = new THREE.ExtrudeGeometry(outer, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.08,
      bevelSegments: 6,
      curveSegments: 16,
    });
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh geometry={geometry} castShadow>
      <meshPhysicalMaterial color={BEZEL} roughness={0.36} clearcoat={0.55} />
    </mesh>
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
      {/* Bezel and picture sit on the flattened front of the shell. */}
      {/* The white face plate sits on the front of the wedge, tilted with it. */}
      <group position={[0, 1.2, FRONT_Z - 0.04]} rotation={[0.075, 0, 0]}>
        <Bezel />
        {screen}
      </group>
      <Keyboard pressedRef={pressedRef} onPress={onPress} onRelease={onRelease} />
      <Mouse />
    </group>
  );
}
