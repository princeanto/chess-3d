'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { frustumY, roundedShape } from './Machine';

/**
 * The room the machine sits in: a warm desk under a washed wall.
 *
 * Everything that carries the mood is painted into a canvas rather than lit —
 * the wall's glow, the pool on the desk, the wood's grain. A real light would
 * slide across all three as the camera moves between framed viewpoints, and the
 * whole point of those viewpoints is that they are composed. The lamps then add
 * real light on top, so the objects still take highlights and cast shadows.
 */

const DESK = { w: 8.4, d: 7.4, cz: 0.25, thickness: 0.14 };
const WALL_Z = -3.62;

/* ------------------------------- surfaces -------------------------------- */

function useWood(): THREE.CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#a3763f';
    ctx.fillRect(0, 0, 1024, 1024);

    // Grain: long wandering lines rather than straight ones, or it reads as
    // corduroy. Each is a shallow sine with its own phase and drift.
    for (let i = 0; i < 190; i += 1) {
      const y = Math.random() * 1024;
      const amp = 3 + Math.random() * 12;
      const phase = Math.random() * Math.PI * 2;
      const dark = Math.random() < 0.35;
      ctx.strokeStyle = dark
        ? `rgba(70, 42, 18, ${0.1 + Math.random() * 0.22})`
        : `rgba(214, 168, 116, ${0.07 + Math.random() * 0.16})`;
      ctx.lineWidth = 0.7 + Math.random() * 2.6;
      ctx.beginPath();
      for (let x = 0; x <= 1024; x += 16) {
        const yy = y + Math.sin(x / 260 + phase) * amp + Math.sin(x / 61) * 1.6;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // A pool of lamplight, baked in so it stays put.
    const pool = ctx.createRadialGradient(512, 330, 40, 512, 470, 620);
    pool.addColorStop(0, 'rgba(255, 226, 182, 0.3)');
    pool.addColorStop(0.45, 'rgba(190, 146, 96, 0.1)');
    pool.addColorStop(1, 'rgba(20, 13, 7, 0.66)');
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, 1024, 1024);

    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);
}

function useWall(): THREE.CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#171009';
    ctx.fillRect(0, 0, 1024, 1024);
    // The lamps throw two overlapping washes up the wall, brightest a little
    // above the desk and falling away toward the ceiling and the corners.
    for (const cx of [318, 706]) {
      const g = ctx.createRadialGradient(cx, 700, 20, cx, 660, 560);
      g.addColorStop(0, 'rgba(247, 231, 206, 0.92)');
      g.addColorStop(0.4, 'rgba(198, 166, 128, 0.4)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1024, 1024);
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

/* --------------------------------- desk ---------------------------------- */

function deskTop(texture: THREE.Texture): THREE.BufferGeometry {
  const bevel = 0.035;
  const shape = roundedShape(DESK.w, DESK.d, 0.3);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: DESK.thickness,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 22,
  });
  g.rotateX(-Math.PI / 2);
  // Sit the top face on zero, where everything else already stands.
  g.translate(0, -(DESK.thickness + bevel), DESK.cz);

  /*
   * Planar UVs, projected straight down.
   *
   * ExtrudeGeometry derives its own from the shape's coordinates, which would
   * lay the grain and the light pool on edge-on across the slab.
   */
  g.computeBoundingBox();
  const { min, max } = g.boundingBox!;
  const pos = g.attributes.position;
  const uv: number[] = [];
  for (let i = 0; i < pos.count; i += 1) {
    uv.push(
      (pos.getX(i) - min.x) / (max.x - min.x),
      (pos.getZ(i) - min.z) / (max.z - min.z),
    );
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  void texture;
  return g;
}

/* --------------------------------- props --------------------------------- */

/** One of the pair either side of the machine. */
function Lamp({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* Three splayed legs and a collar, the way these little stands are made. */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.12, 0.19, Math.sin(a) * 0.12]}
            rotation={[Math.sin(a) * 0.24, 0, -Math.cos(a) * 0.24]}
            castShadow
          >
            <cylinderGeometry args={[0.022, 0.026, 0.4, 10]} />
            <meshStandardMaterial color="#a9773f" roughness={0.65} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.36, 0]}>
        <torusGeometry args={[0.12, 0.018, 8, 24]} />
        <meshStandardMaterial color="#a9773f" roughness={0.65} />
      </mesh>

      {/* The shade, lit from within. */}
      <mesh position={[0, 0.63, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.19, 0.44, 28, 1, true]} />
        <meshStandardMaterial
          color="#ffe6bd"
          emissive="#ffb45e"
          emissiveIntensity={1.5}
          roughness={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.85, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.2, 28]} />
        <meshStandardMaterial color="#fff0d6" emissive="#ffc178" emissiveIntensity={1.1} />
      </mesh>

      <pointLight position={[0, 0.62, 0]} intensity={5.5} distance={6.5} decay={2} color="#ffb264" />
    </group>
  );
}

/** A bookshelf speaker, white cabinet with a soft dome and a woofer. */
function Speaker({ x, z, flip }: { x: number; z: number; flip: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, flip * 0.16, 0]}>
      <mesh position={[0, 0.52, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.66, 1.04, 0.72]} />
        <meshStandardMaterial color="#e9e6e0" roughness={0.62} />
      </mesh>
      {/* Woofer low, tweeter above it, both slightly proud of the baffle. */}
      <mesh position={[0, 0.36, 0.365]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 28]} />
        <meshStandardMaterial color="#1b1b1d" roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.36, 0.378]}>
        <sphereGeometry args={[0.075, 18, 12]} />
        <meshStandardMaterial color="#2a2a2d" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.79, 0.365]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.095, 0.095, 0.02, 24]} />
        <meshStandardMaterial color="#1b1b1d" roughness={0.75} />
      </mesh>
    </group>
  );
}

/** The little digital clock that sits by the keyboard. */
function Clock() {
  return (
    <group position={[-1.75, 0, 1.4]} rotation={[0, 0.12, 0]}>
      <mesh position={[0, 0.13, 0]} castShadow>
        <boxGeometry args={[0.38, 0.26, 0.16]} />
        <meshStandardMaterial color="#232326" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.145, 0.082]}>
        <planeGeometry args={[0.27, 0.12]} />
        <meshBasicMaterial color="#bfe0ea" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Felt mat under the keyboard and mouse. */
function DeskMat() {
  const geometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(roundedShape(6.6, 2.3, 0.09), {
      depth: 0.012,
      bevelEnabled: false,
      curveSegments: 8,
    });
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  return (
    <mesh geometry={geometry} position={[0.15, 0.004, 2.45]} receiveShadow>
      <meshStandardMaterial color="#2b2a28" roughness={0.94} />
    </mesh>
  );
}

/** Two floating shelves with a row of books and a trailing plant. */
function Shelves() {
  const books = useMemo(() => {
    const rng = (n: number) => ((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1;
    const colours = ['#7d4a33', '#2f4a52', '#8a7442', '#3e3a46', '#6b3f3a', '#4a5a3c'];
    let cursor = 0.6;
    return Array.from({ length: 11 }, (_, i) => {
      const w = 0.09 + rng(i) * 0.1;
      const h = 0.52 + rng(i + 40) * 0.3;
      const x = cursor + w / 2;
      cursor += w + 0.012;
      return { x, w, h, colour: colours[i % colours.length], lean: rng(i + 80) * 0.06 };
    });
  }, []);

  return (
    <group>
      {[3.9, 5.22].map((y) => (
        <mesh key={y} position={[0, y, WALL_Z + 0.3]} castShadow receiveShadow>
          <boxGeometry args={[7.4, 0.1, 0.56]} />
          <meshStandardMaterial color="#8a5f33" roughness={0.7} />
        </mesh>
      ))}

      {books.map((b, i) => (
        <mesh
          key={i}
          position={[b.x, 5.27 + b.h / 2, WALL_Z + 0.3]}
          rotation={[0, 0, b.lean]}
          castShadow
        >
          <boxGeometry args={[b.w, b.h, 0.4]} />
          <meshStandardMaterial color={b.colour} roughness={0.8} />
        </mesh>
      ))}

      {/* A framed print, leaning against the wall on the upper shelf. */}
      <mesh position={[2.45, 5.75, WALL_Z + 0.22]} rotation={[0.07, 0, 0]} castShadow>
        <boxGeometry args={[0.94, 0.86, 0.04]} />
        <meshStandardMaterial color="#efe6d6" roughness={0.7} />
      </mesh>

      <Plant />
    </group>
  );
}

/**
 * The pothos trailing off the top shelf.
 *
 * Leaves are flattened spheres strung along two hanging curves. At this size
 * that reads as foliage, and it costs a fraction of what real leaf cards with
 * cut-out alpha would.
 */
function Plant() {
  const leaves = useMemo(() => {
    const strands = [
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.5, 5.2, WALL_Z + 0.42),
        new THREE.Vector3(-1.36, 4.75, WALL_Z + 0.6),
        new THREE.Vector3(-1.44, 4.2, WALL_Z + 0.52),
        new THREE.Vector3(-1.28, 3.65, WALL_Z + 0.62),
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.05, 5.2, WALL_Z + 0.4),
        new THREE.Vector3(-0.9, 4.65, WALL_Z + 0.56),
        new THREE.Vector3(-1.02, 4.05, WALL_Z + 0.46),
        new THREE.Vector3(-0.86, 3.4, WALL_Z + 0.58),
      ]),
    ];
    const out: Array<{ p: THREE.Vector3; s: number; r: number }> = [];
    strands.forEach((curve, si) => {
      for (let i = 0; i <= 12; i += 1) {
        const p = curve.getPoint(i / 12);
        out.push({
          p,
          s: 0.11 + ((i * 7 + si * 3) % 5) * 0.014,
          r: (i * 1.7 + si) % Math.PI,
        });
      }
    });
    return out;
  }, []);

  return (
    <group>
      {/* The pot, sitting back on the shelf. */}
      <mesh position={[-1.28, 5.48, WALL_Z + 0.3]} castShadow>
        <cylinderGeometry args={[0.26, 0.21, 0.36, 20]} />
        <meshStandardMaterial color="#e6e2da" roughness={0.75} />
      </mesh>
      {leaves.map((l, i) => (
        <mesh key={i} position={l.p} rotation={[0.5, l.r, 0.3]} scale={[1, 0.34, 1]}>
          <sphereGeometry args={[l.s, 10, 8]} />
          <meshStandardMaterial color={i % 3 === 0 ? '#3f6b3a' : '#33562f'} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/* --------------------------------- room ---------------------------------- */

export default function Room() {
  const wood = useWood();
  const wall = useWall();
  const top = useMemo(() => deskTop(wood), [wood]);
  const leg = useMemo(() => frustumY(0.19, 0.19, 0.13, 0.13, 2.7), []);
  const legX = DESK.w / 2 - 0.62;
  const legZ = DESK.d / 2 - 0.62;

  return (
    <group>
      {/* The wall, with its wash painted on rather than lit. */}
      <mesh position={[0, 2.6, WALL_Z]} receiveShadow>
        <planeGeometry args={[24, 13]} />
        <meshStandardMaterial map={wall} roughness={0.95} />
      </mesh>

      <mesh geometry={top} receiveShadow castShadow>
        <meshStandardMaterial map={wood} roughness={0.52} metalness={0.02} />
      </mesh>

      {[
        [-legX, DESK.cz - legZ],
        [legX, DESK.cz - legZ],
        [-legX, DESK.cz + legZ],
        [legX, DESK.cz + legZ],
      ].map(([x, z]) => (
        <mesh key={`${x},${z}`} geometry={leg} position={[x, -2.87, z]} castShadow>
          <meshStandardMaterial color="#5a3d21" roughness={0.72} />
        </mesh>
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.88, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#160f09" roughness={0.9} />
      </mesh>

      <DeskMat />
      <Lamp x={-2.55} z={-0.95} />
      <Lamp x={2.55} z={-0.95} />
      <Speaker x={-3.45} z={-1.1} flip={1} />
      <Speaker x={3.45} z={-1.1} flip={-1} />
      <Clock />
      <Shelves />
    </group>
  );
}
