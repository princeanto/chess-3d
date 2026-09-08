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

export const SCREEN_SIZE = { w: 1.72, h: 1.29 };

/**
 * One number drives the whole machine. The shell's flattened front works out at
 * `BODY * 0.69` from its centre, so the bezel can be placed against it rather
 * than guessed at — the first attempt guessed, and the bezel floated half a
 * unit in front of the body.
 */
const BODY = 1.42;
const BODY_Y = BODY * 1.02;
/**
 * Where the flattened face actually ends up: the deformation compresses z=1 to
 * 0.42 + 0.58*0.26 = 0.571, and the shell is then scaled by 1.1 on z. Deriving
 * it rather than eyeballing it is the difference between a bezel seated in the
 * shell and one hovering in front of it.
 */
const FRONT_Z = BODY * (0.42 + 0.58 * 0.26) * 1.1;

/* ------------------------------ body shell ------------------------------ */

/**
 * The iMac silhouette, from a unit sphere.
 *
 * Three deformations in order: tuck the bottom into a foot, flatten the front
 * into a face the bezel can sit on, and swell the back rather than let it taper.
 */
function imacShell(scale: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 64, 48);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);

    // Tuck the base in so the machine stands on a small foot.
    if (v.y < -0.3) {
      const k = Math.min(1, (v.y + 0.3) / -0.7);
      const pinch = 1 - 0.62 * k * k;
      v.x *= pinch;
      v.z *= pinch * 0.92;
    }

    // Flatten the front. Compressing past a threshold leaves a broad face with
    // a soft edge, rather than a ball with a slice taken off it.
    if (v.z > 0.42) v.z = 0.42 + (v.z - 0.42) * 0.26;

    // The back swells; that bulge is the whole silhouette.
    if (v.z < 0) v.z *= 1.12;

    pos.setXYZ(i, v.x * scale * 1.04, v.y * scale * 1.02, v.z * scale * 1.1);
  }

  g.computeVertexNormals();
  return g;
}

function Body() {
  const outer = useMemo(() => imacShell(BODY), []);
  const inner = useMemo(() => imacShell(BODY * 0.94), []);

  return (
    <group position={[0, BODY_Y, -0.35]}>
      {/* Dark internals, seen through the tinted shell. */}
      <mesh geometry={inner}>
        <meshStandardMaterial color={CHASSIS} roughness={0.55} metalness={0.1} />
      </mesh>

      <mesh geometry={outer} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={BONDI}
          transparent
          opacity={0.62}
          roughness={0.16}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.06}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Carry handle over the crown. */}
      <mesh
        position={[0, BODY * 0.98, -BODY * 0.52]}
        rotation={[Math.PI / 2.3, 0, 0]}
        castShadow
      >
        <torusGeometry args={[0.26, 0.058, 16, 40, Math.PI]} />
        <meshPhysicalMaterial
          color={BONDI}
          transparent
          opacity={0.72}
          roughness={0.18}
          clearcoat={1}
        />
      </mesh>
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
    const outer = roundedShape(2.16, 1.72, 0.2);
    outer.holes.push(
      new THREE.Path(roundedShape(SCREEN_SIZE.w, SCREEN_SIZE.h, 0.11).getPoints(48)),
    );
    const g = new THREE.ExtrudeGeometry(outer, {
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 4,
      curveSegments: 12,
    });
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color={BEZEL} roughness={0.42} metalness={0.02} />
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
    <group position={[0, 0, 2.05]} rotation={[-0.05, 0, 0]} scale={0.62}>
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

function Mouse() {
  return (
    <group position={[1.72, 0, 2.05]} scale={0.78}>
      <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.23, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial
          color={BONDI}
          transparent
          opacity={0.7}
          roughness={0.15}
          clearcoat={1}
        />
      </mesh>
      <mesh position={[0, 0.045, 0]} castShadow>
        <cylinderGeometry args={[0.23, 0.22, 0.09, 32]} />
        <meshStandardMaterial color={BEZEL} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.095, 0.06]}>
        <cylinderGeometry args={[0.075, 0.075, 0.02, 24]} />
        <meshStandardMaterial color={CHASSIS} roughness={0.5} />
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
      {/* Seated against the shell's flattened face, not floating in front of it. */}
      <group position={[0, BODY_Y + 0.1, FRONT_Z - 0.35 - 0.11]}>
        <Bezel />
        {screen}
      </group>
      <Keyboard pressedRef={pressedRef} onPress={onPress} onRelease={onRelease} />
      <Mouse />
    </group>
  );
}
