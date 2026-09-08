'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { LIVE_CODES, layoutKeys, type PlacedKey } from '@/lib/scene/keys';

/**
 * The computer.
 *
 * Built from primitives rather than a model file, so it ships with the app and
 * works offline like everything else here. The one trick worth knowing: a
 * four-sided CylinderGeometry is a square frustum, which gives the tapered box
 * a CRT housing needs — a plain BoxGeometry reads as a filing cabinet.
 */

const BEIGE = '#d8cfbd';
const BEIGE_DARK = '#bdb3a0';
const PLASTIC_DARK = '#3a3a3d';
const KEYCAP = '#e6e0d4';
const KEYCAP_LIVE = '#c9bfa8';

/**
 * A frustum: a box whose top face can differ in size from its bottom.
 *
 * Built from explicit vertices rather than by deforming a cylinder. The cylinder
 * trick looked clever and produced a slab in the wrong orientation — eight
 * corners written out are unambiguous, and non-indexed triangles give the flat
 * per-face normals a moulded plastic box needs.
 *
 * Runs from y = 0 up to y = height, so callers can rotate it into place.
 */
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
    [b[0], b[1], t[1], t[0]], // front
    [b[1], b[2], t[2], t[1]], // right
    [b[2], b[3], t[3], t[2]], // back
    [b[3], b[0], t[0], t[3]], // left
    [t[0], t[1], t[2], t[3]], // top
    [b[3], b[2], b[1], b[0]], // bottom
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

/** Frustum lying on its side, so the taper runs front-to-back. */
function DeepBox({
  front,
  back,
  depth,
  ...props
}: {
  front: [number, number];
  back: [number, number];
  depth: number;
} & React.ComponentProps<'mesh'>) {
  const geometry = useMemo(() => {
    const g = frustumY(front[0], front[1], back[0], back[1], depth);
    // +Y becomes -Z, so the wide end faces the viewer.
    g.rotateX(-Math.PI / 2);
    return g;
  }, [front, back, depth]);

  return <mesh geometry={geometry} {...props} />;
}

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

/* ------------------------------- keyboard ------------------------------- */

/** Label textures are tiny and few, so drawing them per key is cheap. */
function useKeyLabel(label: string | undefined): THREE.CanvasTexture | null {
  return useMemo(() => {
    if (!label) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#4a4a4d';
    ctx.font = `600 ${label.length > 2 ? 34 : 62}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 64, 70);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }, [label]);
}

const KEY_H = 0.07;
const KEY_TRAVEL = 0.055;

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

  // Keycaps taper toward the top, like real ones.
  const geometry = useMemo(
    () =>
      frustumY(def.width, def.depth, def.width * 0.9, def.depth * 0.88, KEY_H),
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
        receiveShadow
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
        <meshStandardMaterial
          color={live ? KEYCAP_LIVE : KEYCAP}
          roughness={0.72}
          metalness={0}
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

  return (
    <group position={[0, 0, 2.1]} rotation={[-0.05, 0, 0]}>
      <mesh
        geometry={useMemo(
          () =>
            frustumY(
              width + 0.34,
              depth + 0.3,
              width + 0.24,
              depth + 0.2,
              0.16,
            ),
          [width, depth],
        )}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={BEIGE} roughness={0.78} />
      </mesh>
      <group position={[0, 0.2, 0]}>
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

/* --------------------------------- mouse -------------------------------- */

function Mouse() {
  const body = useMemo(() => {
    const g = new THREE.SphereGeometry(0.32, 24, 18);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const y = pos.getY(i);
      // Squash into a mouse: flat underside, domed top, longer than it is wide.
      pos.setY(i, y < 0 ? 0 : y * 0.62);
      pos.setZ(i, pos.getZ(i) * 1.45);
      pos.setX(i, pos.getX(i) * 0.92);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <group position={[2.35, 0.02, 2.1]} rotation={[0, -0.26, 0]}>
      <mesh geometry={body} castShadow receiveShadow>
        <meshStandardMaterial color={BEIGE} roughness={0.7} />
      </mesh>
      {/* Split for the two buttons. */}
      <mesh position={[0, 0.2, -0.24]} castShadow>
        <boxGeometry args={[0.012, 0.02, 0.32]} />
        <meshStandardMaterial color={BEIGE_DARK} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.215, -0.34]} castShadow>
        <boxGeometry args={[0.07, 0.03, 0.1]} />
        <meshStandardMaterial color={PLASTIC_DARK} roughness={0.6} />
      </mesh>
      {/* Cable, curving back toward the machine. */}
      <mesh
        position={[-0.42, 0.05, -0.66]}
        rotation={[Math.PI / 2, 0, 0.7]}
        castShadow
      >
        <torusGeometry args={[0.5, 0.018, 8, 24, Math.PI * 0.75]} />
        <meshStandardMaterial color="#cfc6b4" roughness={0.8} />
      </mesh>
    </group>
  );
}

/* -------------------------------- monitor ------------------------------- */

export const SCREEN_SIZE = { w: 2.44, h: 1.83 };

function Monitor({ children }: { children: React.ReactNode }) {
  const bezel = useMemo(() => {
    // A rounded outer rectangle with a rounded hole for the screen, extruded —
    // one solid piece, rather than four boxes with visible seams at the corners.
    const outer = new THREE.Shape();
    const w = 3.06;
    const h = 2.42;
    const r = 0.16;
    outer.moveTo(-w / 2 + r, -h / 2);
    outer.lineTo(w / 2 - r, -h / 2);
    outer.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    outer.lineTo(w / 2, h / 2 - r);
    outer.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    outer.lineTo(-w / 2 + r, h / 2);
    outer.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    outer.lineTo(-w / 2, -h / 2 + r);
    outer.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);

    const hole = new THREE.Path();
    const hw = SCREEN_SIZE.w;
    const hh = SCREEN_SIZE.h;
    const hr = 0.12;
    hole.moveTo(-hw / 2 + hr, -hh / 2);
    hole.lineTo(hw / 2 - hr, -hh / 2);
    hole.quadraticCurveTo(hw / 2, -hh / 2, hw / 2, -hh / 2 + hr);
    hole.lineTo(hw / 2, hh / 2 - hr);
    hole.quadraticCurveTo(hw / 2, hh / 2, hw / 2 - hr, hh / 2);
    hole.lineTo(-hw / 2 + hr, hh / 2);
    hole.quadraticCurveTo(-hw / 2, hh / 2, -hw / 2, hh / 2 - hr);
    hole.lineTo(-hw / 2, -hh / 2 + hr);
    hole.quadraticCurveTo(-hw / 2, -hh / 2, -hw / 2 + hr, -hh / 2);
    outer.holes.push(hole);

    const g = new THREE.ExtrudeGeometry(outer, {
      depth: 0.2,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.035,
      bevelSegments: 3,
      curveSegments: 8,
    });
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <group position={[0, 1.62, -0.55]}>
      {/* Deep tapering housing behind the bezel. */}
      <DeepBox
        front={[2.98, 2.34]}
        back={[1.9, 1.56]}
        depth={2.2}
        position={[0, 0, 0.02]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={BEIGE} roughness={0.76} />
      </DeepBox>

      <mesh geometry={bezel} position={[0, 0, -0.02]} castShadow receiveShadow>
        <meshStandardMaterial color={BEIGE} roughness={0.66} />
      </mesh>

      {children}

      {/* Vents across the top of the housing. */}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[-0.8 + i * 0.2, 1.19, -0.9]} castShadow>
          <boxGeometry args={[0.11, 0.016, 0.62]} />
          <meshStandardMaterial color={BEIGE_DARK} roughness={0.85} />
        </mesh>
      ))}

      {/* Badge, power LED and two knobs along the chin. */}
      <mesh position={[-1.0, -1.06, 0.16]}>
        <boxGeometry args={[0.44, 0.075, 0.012]} />
        <meshStandardMaterial color={BEIGE_DARK} roughness={0.6} />
      </mesh>
      <mesh position={[1.16, -1.06, 0.17]}>
        <sphereGeometry args={[0.032, 12, 8]} />
        <meshStandardMaterial
          color="#7CFF9B"
          emissive="#3ef06a"
          emissiveIntensity={2.4}
          toneMapped={false}
        />
      </mesh>
      {[0.72, 0.92].map((x) => (
        <mesh key={x} position={[x, -1.06, 0.16]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.05, 16]} />
          <meshStandardMaterial color={BEIGE_DARK} roughness={0.55} />
        </mesh>
      ))}

      {/* Stand: a tilting neck into a base disc. */}
      <mesh position={[0, -1.34, -0.5]} castShadow>
        <cylinderGeometry args={[0.3, 0.42, 0.3, 20]} />
        <meshStandardMaterial color={BEIGE_DARK} roughness={0.8} />
      </mesh>
      <mesh position={[0, -1.55, -0.5]} castShadow receiveShadow>
        <cylinderGeometry args={[0.86, 0.94, 0.14, 28]} />
        <meshStandardMaterial color={BEIGE} roughness={0.8} />
      </mesh>
    </group>
  );
}

/* --------------------------------- desk --------------------------------- */

function Desk() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[38, 38]} />
      <meshStandardMaterial color="#4e4335" roughness={0.95} metalness={0} />
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
      <Desk />
      <Monitor>{screen}</Monitor>
      <Keyboard pressedRef={pressedRef} onPress={onPress} onRelease={onRelease} />
      <Mouse />
    </group>
  );
}

export { DeepBox };
